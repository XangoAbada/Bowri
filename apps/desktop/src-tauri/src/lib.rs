use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{FromRow, SqlitePool};
use std::env;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use thiserror::Error;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::timeout;
use uuid::Uuid;

const PROVIDER_ID: &str = "codex-cli-bridge";
const IMAGE_PROVIDER_ID: &str = "openai-images-api";
const COVER_GENERATION_EVENT: &str = "cover-generation-progress";
const OPENAI_IMAGES_GENERATIONS_URL: &str = "https://api.openai.com/v1/images/generations";

#[derive(Clone)]
pub struct AppState {
    db: SqlitePool,
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Process(String),
    #[error("Codex CLI przekroczył limit czasu po {0} sekundach")]
    Timeout(u64),
}

fn command_error(error: AppError) -> String {
    error.to_string()
}

#[derive(Debug, Clone)]
struct CodexCommandSpec {
    program: OsString,
    prefix_args: Vec<OsString>,
    display_path: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub language: String,
    pub created_at: String,
    pub updated_at: String,
    pub active_book_id: Option<String>,
    pub settings_json: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub working_title: String,
    pub premise: String,
    pub logline: String,
    pub genre: String,
    pub subgenre: String,
    pub target_audience: String,
    pub tone: String,
    pub style_guide: String,
    pub point_of_view: String,
    pub target_word_count: Option<i64>,
    pub cover_image_path: String,
    pub cover_prompt: String,
    pub cover_negative_prompt: String,
    pub cover_generated_at: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub language: String,
    pub updated_at: String,
    pub active_book_id: Option<String>,
    pub working_title: String,
    pub cover_image_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetails {
    pub project: Project,
    pub book: Book,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookConceptInput {
    pub title: Option<String>,
    pub working_title: Option<String>,
    pub premise: Option<String>,
    pub logline: Option<String>,
    pub genre: Option<String>,
    pub subgenre: Option<String>,
    pub target_audience: Option<String>,
    pub tone: Option<String>,
    pub style_guide: Option<String>,
    pub point_of_view: Option<String>,
    pub target_word_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCliStatus {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub auth_likely_ready: Option<bool>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexModelCatalog {
    pub models: Vec<Value>,
    pub fallback: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCodexPromptRequest {
    pub project_id: String,
    pub action: String,
    pub prompt_package_id: String,
    pub prompt_package_json: Value,
    pub prompt: String,
    pub codex_path: Option<String>,
    pub timeout_seconds: Option<u64>,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateNewProjectTitleRequest {
    pub action: String,
    pub prompt_package_id: String,
    pub prompt_package_json: Value,
    pub prompt: String,
    pub codex_path: Option<String>,
    pub timeout_seconds: Option<u64>,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateBookCoverInput {
    pub project_id: String,
    pub book_id: String,
    pub prompt_package_id: String,
    pub prompt_package_json: Value,
    pub prompt: String,
    pub cover_prompt: String,
    pub cover_negative_prompt: String,
    pub codex_path: Option<String>,
    pub timeout_seconds: Option<u64>,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverGenerationProgress {
    pub project_id: String,
    pub book_id: String,
    pub ai_run_id: String,
    pub phase: String,
    pub message: String,
    pub partial_image_data_url: Option<String>,
    pub progress: Option<u8>,
}

#[derive(Debug, Clone)]
struct GeneratedImageStreamResult {
    raw_output: String,
    image_bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
struct ImageGenerationStreamEvent {
    #[serde(rename = "type")]
    event_type: Option<String>,
    b64_json: Option<String>,
    partial_image_index: Option<u8>,
    data: Option<Vec<ImageGenerationData>>,
    response: Option<ImageGenerationResponse>,
}

#[derive(Debug, Deserialize)]
struct ImageGenerationData {
    b64_json: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ImageGenerationResponse {
    output: Option<Vec<ImageGenerationOutput>>,
}

#[derive(Debug, Deserialize)]
struct ImageGenerationOutput {
    result: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRunResult {
    pub id: String,
    pub provider_id: String,
    pub prompt_package_id: String,
    pub action: String,
    pub status: String,
    pub raw_output: Option<String>,
    pub stderr: Option<String>,
    pub error_message: Option<String>,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookCoverResult {
    pub book: Book,
    pub ai_run: AiRunResult,
    pub image_path: String,
    pub prompt: String,
    pub negative_prompt: String,
    pub generated_at: String,
}

pub async fn init_database(app_data_dir: PathBuf) -> Result<SqlitePool, AppError> {
    tokio::fs::create_dir_all(&app_data_dir).await?;
    let database_path = app_data_dir.join("storyforge2.sqlite");
    init_database_at(database_path).await
}

async fn init_database_at(database_path: PathBuf) -> Result<SqlitePool, AppError> {
    let options = SqliteConnectOptions::new()
        .filename(database_path)
        .create_if_missing(true)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

pub async fn create_project_in_pool(
    pool: &SqlitePool,
    input: CreateProjectInput,
) -> Result<ProjectDetails, AppError> {
    let trimmed_name = input.name.trim();
    if trimmed_name.is_empty() {
        return Err(AppError::Process(
            "Nazwa projektu nie może być pusta".into(),
        ));
    }

    let project_id = Uuid::new_v4().to_string();
    let book_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let language = input.language.unwrap_or_else(|| "pl".to_string());
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO projects (id, name, language, created_at, updated_at, active_book_id, settings_json)
        VALUES (?, ?, ?, ?, ?, ?, '{}')
        "#,
    )
    .bind(&project_id)
    .bind(trimmed_name)
    .bind(&language)
    .bind(&now)
    .bind(&now)
    .bind(&book_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO books (id, project_id, working_title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&book_id)
    .bind(&project_id)
    .bind(trimmed_name)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    get_project_details(pool, &project_id).await
}

pub async fn list_projects_in_pool(pool: &SqlitePool) -> Result<Vec<ProjectSummary>, AppError> {
    let projects = sqlx::query_as::<_, ProjectSummary>(
        r#"
        SELECT
          p.id,
          p.name,
          p.language,
          p.updated_at,
          p.active_book_id,
          COALESCE(b.working_title, '') AS working_title,
          COALESCE(b.cover_image_path, '') AS cover_image_path
        FROM projects p
        LEFT JOIN books b ON b.id = p.active_book_id
        ORDER BY p.updated_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;
    Ok(projects)
}

pub async fn get_project_details(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<ProjectDetails, AppError> {
    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(project_id)
        .fetch_one(pool)
        .await?;

    let book_id = project
        .active_book_id
        .clone()
        .ok_or_else(|| AppError::Process("Projekt nie ma aktywnej książki".into()))?;

    let book = sqlx::query_as::<_, Book>("SELECT * FROM books WHERE id = ?")
        .bind(book_id)
        .fetch_one(pool)
        .await?;

    Ok(ProjectDetails { project, book })
}

pub async fn update_book_concept_in_pool(
    pool: &SqlitePool,
    book_id: &str,
    input: BookConceptInput,
) -> Result<Book, AppError> {
    let now = Utc::now().to_rfc3339();
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        UPDATE books
        SET
          title = COALESCE(?, title),
          working_title = COALESCE(?, working_title),
          premise = COALESCE(?, premise),
          logline = COALESCE(?, logline),
          genre = COALESCE(?, genre),
          subgenre = COALESCE(?, subgenre),
          target_audience = COALESCE(?, target_audience),
          tone = COALESCE(?, tone),
          style_guide = COALESCE(?, style_guide),
          point_of_view = COALESCE(?, point_of_view),
          target_word_count = COALESCE(?, target_word_count),
          updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(input.title)
    .bind(input.working_title)
    .bind(input.premise)
    .bind(input.logline)
    .bind(input.genre)
    .bind(input.subgenre)
    .bind(input.target_audience)
    .bind(input.tone)
    .bind(input.style_guide)
    .bind(input.point_of_view)
    .bind(input.target_word_count)
    .bind(&now)
    .bind(book_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE projects
        SET updated_at = ?
        WHERE id = (SELECT project_id FROM books WHERE id = ?)
        "#,
    )
    .bind(&now)
    .bind(book_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    sqlx::query_as::<_, Book>("SELECT * FROM books WHERE id = ?")
        .bind(book_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn update_book_cover_metadata_in_pool(
    pool: &SqlitePool,
    book_id: &str,
    image_path: &str,
    prompt: &str,
    negative_prompt: &str,
    generated_at: &str,
) -> Result<Book, AppError> {
    let now = Utc::now().to_rfc3339();
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        UPDATE books
        SET
          cover_image_path = ?,
          cover_prompt = ?,
          cover_negative_prompt = ?,
          cover_generated_at = ?,
          updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(image_path)
    .bind(prompt)
    .bind(negative_prompt)
    .bind(generated_at)
    .bind(&now)
    .bind(book_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE projects
        SET updated_at = ?
        WHERE id = (SELECT project_id FROM books WHERE id = ?)
        "#,
    )
    .bind(&now)
    .bind(book_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    sqlx::query_as::<_, Book>("SELECT * FROM books WHERE id = ?")
        .bind(book_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn generate_book_cover_in_pool(
    app: &AppHandle,
    pool: &SqlitePool,
    input: GenerateBookCoverInput,
) -> Result<BookCoverResult, AppError> {
    if input.cover_prompt.trim().is_empty() {
        return Err(AppError::Process(
            "Prompt okĹ‚adki nie moĹĽe byÄ‡ pusty".into(),
        ));
    }

    let details = get_project_details(pool, &input.project_id).await?;
    if details.book.id != input.book_id {
        return Err(AppError::Process(
            "OkĹ‚adka moĹĽe byÄ‡ generowana tylko dla aktywnej ksiÄ…ĹĽki projektu".into(),
        ));
    }

    let ai_run_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let prompt_package_json = serde_json::to_string(&input.prompt_package_json)?;
    let timeout_seconds = input.timeout_seconds.unwrap_or(240);

    sqlx::query(
        r#"
        INSERT INTO ai_runs
          (id, project_id, provider_id, action, prompt_package_json, status, created_at)
        VALUES (?, ?, ?, 'generate_cover_image', ?, 'running', ?)
        "#,
    )
    .bind(&ai_run_id)
    .bind(&input.project_id)
    .bind(IMAGE_PROVIDER_ID)
    .bind(&prompt_package_json)
    .bind(&created_at)
    .execute(pool)
    .await?;

    emit_cover_progress(
        app,
        &input,
        &ai_run_id,
        "queued",
        "Przygotowuje zadanie generowania okladki.",
        None,
        Some(5),
    );

    let started_at = Instant::now();
    let run_result =
        execute_openai_image_generation(app, &input, &ai_run_id, timeout_seconds).await;
    let duration_ms = started_at.elapsed().as_millis();
    let completed_at = Utc::now().to_rfc3339();

    let stream_result = match run_result {
        Ok(stream_result) => {
            complete_ai_run(
                pool,
                &ai_run_id,
                "success",
                Some(&stream_result.raw_output),
                None,
                &completed_at,
            )
            .await?;
            stream_result
        }
        Err(error) => {
            let error_message = error.to_string();
            emit_cover_progress(app, &input, &ai_run_id, "error", &error_message, None, None);
            complete_ai_run(
                pool,
                &ai_run_id,
                if matches!(error, AppError::Timeout(_)) {
                    "timeout"
                } else {
                    "error"
                },
                None,
                Some(&error_message),
                &completed_at,
            )
            .await?;
            return Err(error);
        }
    };

    let app_data_dir = app.path().app_data_dir().map_err(|error| {
        AppError::Process(format!(
            "Nie udaĹ‚o siÄ™ ustaliÄ‡ katalogu danych aplikacji: {error}"
        ))
    })?;
    let final_dir = app_data_dir
        .join("covers")
        .join(&input.project_id)
        .join(&input.book_id);
    tokio::fs::create_dir_all(&final_dir).await?;
    let final_image_path = final_dir.join(format!("cover-{ai_run_id}.png"));
    tokio::fs::write(&final_image_path, &stream_result.image_bytes).await?;

    let metadata = tokio::fs::metadata(&final_image_path).await?;
    if metadata.len() == 0 {
        return Err(AppError::Process(
            "OpenAI Image API returned an empty image file.".into(),
        ));
    }

    let final_image_path_text = final_image_path.to_string_lossy().to_string();
    let book = update_book_cover_metadata_in_pool(
        pool,
        &input.book_id,
        &final_image_path_text,
        &input.cover_prompt,
        &input.cover_negative_prompt,
        &completed_at,
    )
    .await?;

    emit_cover_progress(
        app,
        &input,
        &ai_run_id,
        "saved",
        "Okladka zapisana.",
        None,
        Some(100),
    );

    Ok(BookCoverResult {
        book,
        ai_run: AiRunResult {
            id: ai_run_id,
            provider_id: IMAGE_PROVIDER_ID.into(),
            prompt_package_id: input.prompt_package_id,
            action: "generate_cover_image".into(),
            status: "success".into(),
            raw_output: Some(stream_result.raw_output),
            stderr: None,
            error_message: None,
            duration_ms,
        },
        image_path: final_image_path_text,
        prompt: input.cover_prompt,
        negative_prompt: input.cover_negative_prompt,
        generated_at: completed_at,
    })
}

#[tauri::command]
async fn create_project(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> Result<ProjectDetails, String> {
    create_project_in_pool(&state.db, input)
        .await
        .map_err(command_error)
}

#[tauri::command]
async fn list_projects(state: State<'_, AppState>) -> Result<Vec<ProjectSummary>, String> {
    list_projects_in_pool(&state.db)
        .await
        .map_err(command_error)
}

#[tauri::command]
async fn get_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ProjectDetails, String> {
    get_project_details(&state.db, &project_id)
        .await
        .map_err(command_error)
}

#[tauri::command]
async fn update_book_concept(
    state: State<'_, AppState>,
    book_id: String,
    input: BookConceptInput,
) -> Result<Book, String> {
    update_book_concept_in_pool(&state.db, &book_id, input)
        .await
        .map_err(command_error)
}

#[tauri::command]
async fn generate_book_cover(
    app: AppHandle,
    state: State<'_, AppState>,
    input: GenerateBookCoverInput,
) -> Result<BookCoverResult, String> {
    generate_book_cover_in_pool(&app, &state.db, input)
        .await
        .map_err(command_error)
}

#[tauri::command]
async fn check_codex_cli(codex_path: Option<String>) -> Result<CodexCliStatus, String> {
    let path = codex_path.unwrap_or_else(|| "codex".to_string());
    let command_spec = resolve_codex_command(&path).await;
    let mut command = Command::new(&command_spec.program);
    command
        .args(&command_spec.prefix_args)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = command.output().await;

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let version = if stdout.is_empty() { stderr } else { stdout };
            Ok(CodexCliStatus {
                available: true,
                path: Some(command_spec.display_path),
                version: if version.is_empty() { None } else { Some(version) },
                auth_likely_ready: None,
                message: Some("Codex CLI jest dostępny. Logowanie zostanie zweryfikowane przy pierwszym uruchomieniu codex exec.".into()),
            })
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Ok(CodexCliStatus {
                available: false,
                path: Some(command_spec.display_path),
                version: None,
                auth_likely_ready: None,
                message: Some(if stderr.is_empty() {
                    "Codex CLI zwrócił niezerowy status dla --version.".into()
                } else {
                    stderr
                }),
            })
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(CodexCliStatus {
            available: false,
            path: Some(command_spec.display_path),
            version: None,
            auth_likely_ready: None,
            message: Some("Nie znaleziono Codex CLI w PATH ani pod skonfigurowaną ścieżką.".into()),
        }),
        Err(error) => Ok(CodexCliStatus {
            available: false,
            path: Some(command_spec.display_path),
            version: None,
            auth_likely_ready: None,
            message: Some(format!("Nie udało się uruchomić Codex CLI: {error}")),
        }),
    }
}

#[tauri::command]
async fn list_codex_models(codex_path: Option<String>) -> Result<CodexModelCatalog, String> {
    let path = codex_path.unwrap_or_else(|| "codex".to_string());
    let command_spec = resolve_codex_command(&path).await;
    let mut command = Command::new(&command_spec.program);
    command
        .args(&command_spec.prefix_args)
        .arg("debug")
        .arg("models")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match command.output().await {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let parsed: Value = serde_json::from_str(&stdout)
                .map_err(AppError::from)
                .map_err(command_error)?;
            let models = parsed
                .get("models")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();

            Ok(CodexModelCatalog {
                models,
                fallback: false,
                error_message: None,
            })
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Ok(fallback_model_catalog(if stderr.is_empty() {
                "Codex CLI zwrócił niezerowy status dla debug models.".into()
            } else {
                stderr
            }))
        }
        Err(error) => Ok(fallback_model_catalog(format!(
            "Nie udało się odczytać katalogu modeli Codex: {error}"
        ))),
    }
}

#[tauri::command]
async fn run_codex_prompt(
    app: AppHandle,
    state: State<'_, AppState>,
    request: RunCodexPromptRequest,
) -> Result<AiRunResult, String> {
    run_codex_prompt_in_pool(&app, &state.db, request)
        .await
        .map_err(command_error)
}

#[tauri::command]
async fn generate_new_project_title(
    app: AppHandle,
    request: GenerateNewProjectTitleRequest,
) -> Result<AiRunResult, String> {
    generate_new_project_title_with_codex(&app, request)
        .await
        .map_err(command_error)
}

pub async fn generate_new_project_title_with_codex(
    app: &AppHandle,
    request: GenerateNewProjectTitleRequest,
) -> Result<AiRunResult, AppError> {
    if request.prompt.trim().is_empty() {
        return Err(AppError::Process("Prompt cannot be empty.".into()));
    }

    let ai_run_id = Uuid::new_v4().to_string();
    let timeout_seconds = request.timeout_seconds.unwrap_or(180);
    let codex_request = RunCodexPromptRequest {
        project_id: "new-project-title".into(),
        action: request.action,
        prompt_package_id: request.prompt_package_id,
        prompt_package_json: request.prompt_package_json,
        prompt: request.prompt,
        codex_path: request.codex_path,
        timeout_seconds: request.timeout_seconds,
        model: request.model,
        reasoning_effort: request.reasoning_effort,
    };

    let started_at = Instant::now();
    let run_result = execute_codex(app, &codex_request, timeout_seconds).await;
    let duration_ms = started_at.elapsed().as_millis();

    let (status, raw_output, stderr, error_message) = match run_result {
        Ok((stdout, stderr)) => (
            "success".to_string(),
            Some(stdout),
            if stderr.trim().is_empty() {
                None
            } else {
                Some(stderr)
            },
            None,
        ),
        Err(AppError::Timeout(seconds)) => (
            "timeout".to_string(),
            None,
            None,
            Some(format!(
                "Codex CLI przekroczył limit czasu po {seconds} sekundach"
            )),
        ),
        Err(error) => ("error".to_string(), None, None, Some(error.to_string())),
    };

    Ok(AiRunResult {
        id: ai_run_id,
        provider_id: PROVIDER_ID.into(),
        prompt_package_id: codex_request.prompt_package_id,
        action: codex_request.action,
        status,
        raw_output,
        stderr,
        error_message,
        duration_ms,
    })
}

pub async fn run_codex_prompt_in_pool(
    app: &AppHandle,
    pool: &SqlitePool,
    request: RunCodexPromptRequest,
) -> Result<AiRunResult, AppError> {
    let ai_run_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let prompt_package_json = serde_json::to_string(&request.prompt_package_json)?;
    let timeout_seconds = request.timeout_seconds.unwrap_or(180);

    sqlx::query(
        r#"
        INSERT INTO ai_runs
          (id, project_id, provider_id, action, prompt_package_json, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'running', ?)
        "#,
    )
    .bind(&ai_run_id)
    .bind(&request.project_id)
    .bind(PROVIDER_ID)
    .bind(&request.action)
    .bind(&prompt_package_json)
    .bind(&created_at)
    .execute(pool)
    .await?;

    let started_at = Instant::now();
    let run_result = execute_codex(app, &request, timeout_seconds).await;
    let duration_ms = started_at.elapsed().as_millis();
    let completed_at = Utc::now().to_rfc3339();

    let (status, raw_output, stderr, error_message) = match run_result {
        Ok((stdout, stderr)) => (
            "success".to_string(),
            Some(stdout),
            if stderr.trim().is_empty() {
                None
            } else {
                Some(stderr)
            },
            None,
        ),
        Err(AppError::Timeout(seconds)) => (
            "timeout".to_string(),
            None,
            None,
            Some(format!(
                "Codex CLI przekroczył limit czasu po {seconds} sekundach"
            )),
        ),
        Err(error) => ("error".to_string(), None, None, Some(error.to_string())),
    };

    sqlx::query(
        r#"
        UPDATE ai_runs
        SET raw_output = ?, status = ?, error_message = ?, completed_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&raw_output)
    .bind(&status)
    .bind(&error_message)
    .bind(&completed_at)
    .bind(&ai_run_id)
    .execute(pool)
    .await?;

    Ok(AiRunResult {
        id: ai_run_id,
        provider_id: PROVIDER_ID.into(),
        prompt_package_id: request.prompt_package_id,
        action: request.action,
        status,
        raw_output,
        stderr,
        error_message,
        duration_ms,
    })
}

async fn complete_ai_run(
    pool: &SqlitePool,
    ai_run_id: &str,
    status: &str,
    raw_output: Option<&str>,
    error_message: Option<&str>,
    completed_at: &str,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        UPDATE ai_runs
        SET raw_output = ?, status = ?, error_message = ?, completed_at = ?
        WHERE id = ?
        "#,
    )
    .bind(raw_output)
    .bind(status)
    .bind(error_message)
    .bind(completed_at)
    .bind(ai_run_id)
    .execute(pool)
    .await?;

    Ok(())
}

fn emit_cover_progress(
    app: &AppHandle,
    request: &GenerateBookCoverInput,
    ai_run_id: &str,
    phase: &str,
    message: &str,
    partial_image_data_url: Option<String>,
    progress: Option<u8>,
) {
    let _ = app.emit(
        COVER_GENERATION_EVENT,
        CoverGenerationProgress {
            project_id: request.project_id.clone(),
            book_id: request.book_id.clone(),
            ai_run_id: ai_run_id.to_string(),
            phase: phase.to_string(),
            message: message.to_string(),
            partial_image_data_url,
            progress,
        },
    );
}

async fn execute_openai_image_generation(
    app: &AppHandle,
    request: &GenerateBookCoverInput,
    ai_run_id: &str,
    timeout_seconds: u64,
) -> Result<GeneratedImageStreamResult, AppError> {
    let api_key = env::var("OPENAI_API_KEY")
        .or_else(|_| env::var("OPENAI_API_TOKEN"))
        .map(|value| value.trim().to_string())
        .unwrap_or_default();
    if api_key.is_empty() {
        return Err(AppError::Process(
            "OPENAI_API_KEY is not set. Set it before starting StoryForge2 to generate covers."
                .into(),
        ));
    }

    let image_prompt = build_openai_cover_prompt(request);
    let request_body = serde_json::json!({
        "model": "gpt-image-2",
        "prompt": image_prompt,
        "size": "1024x1536",
        "quality": "medium",
        "stream": true,
        "partial_images": 2
    });

    emit_cover_progress(
        app,
        request,
        ai_run_id,
        "request",
        "Lacze z OpenAI Images API.",
        None,
        Some(12),
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_seconds))
        .build()
        .map_err(|error| AppError::Process(format!("OpenAI HTTP client error: {error}")))?;

    let response = client
        .post(OPENAI_IMAGES_GENERATIONS_URL)
        .bearer_auth(api_key)
        .json(&request_body)
        .send()
        .await
        .map_err(|error| AppError::Process(format!("OpenAI Image API request failed: {error}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|error| format!("Cannot read error response: {error}"));
        return Err(AppError::Process(format!(
            "OpenAI Image API returned HTTP {status}: {}",
            summarize_openai_error_text(&body)
        )));
    }

    emit_cover_progress(
        app,
        request,
        ai_run_id,
        "streaming",
        "Generuje obraz i czekam na pierwszy podglad.",
        None,
        Some(20),
    );

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut last_image_b64: Option<String> = None;
    let mut event_summaries: Vec<Value> = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|error| {
            AppError::Process(format!("OpenAI Image API stream failed: {error}"))
        })?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_index) = buffer.find('\n') {
            let mut line = buffer[..newline_index].to_string();
            if line.ends_with('\r') {
                line.pop();
            }
            buffer = buffer[newline_index + 1..].to_string();

            handle_openai_image_stream_line(
                app,
                request,
                ai_run_id,
                &line,
                &mut last_image_b64,
                &mut event_summaries,
            )?;
        }
    }

    if !buffer.trim().is_empty() {
        handle_openai_image_stream_line(
            app,
            request,
            ai_run_id,
            &buffer,
            &mut last_image_b64,
            &mut event_summaries,
        )?;
    }

    let image_b64 = last_image_b64.ok_or_else(|| {
        AppError::Process("OpenAI Image API stream finished without image data.".into())
    })?;
    let image_bytes = general_purpose::STANDARD
        .decode(image_b64.as_bytes())
        .map_err(|error| AppError::Process(format!("Cannot decode generated image: {error}")))?;
    if image_bytes.is_empty() {
        return Err(AppError::Process(
            "OpenAI Image API returned empty decoded image bytes.".into(),
        ));
    }

    emit_cover_progress(
        app,
        request,
        ai_run_id,
        "final",
        "Odebrano finalny obraz.",
        None,
        Some(92),
    );

    Ok(GeneratedImageStreamResult {
        raw_output: serde_json::json!({
            "providerId": IMAGE_PROVIDER_ID,
            "endpoint": OPENAI_IMAGES_GENERATIONS_URL,
            "model": "gpt-image-2",
            "size": "1024x1536",
            "quality": "medium",
            "stream": true,
            "partialImages": 2,
            "events": event_summaries
        })
        .to_string(),
        image_bytes,
    })
}

fn handle_openai_image_stream_line(
    app: &AppHandle,
    request: &GenerateBookCoverInput,
    ai_run_id: &str,
    line: &str,
    last_image_b64: &mut Option<String>,
    event_summaries: &mut Vec<Value>,
) -> Result<(), AppError> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with("event:") {
        return Ok(());
    }

    let data = trimmed
        .strip_prefix("data:")
        .map(str::trim)
        .unwrap_or(trimmed);
    if data.is_empty() || data == "[DONE]" {
        return Ok(());
    }

    let value: Value = serde_json::from_str(data)?;
    if value.get("error").is_some() {
        return Err(AppError::Process(format!(
            "OpenAI Image API stream error: {}",
            summarize_openai_error_value(&value)
        )));
    }

    let event: ImageGenerationStreamEvent = serde_json::from_value(value)?;
    let image_b64 = image_b64_from_event(&event).map(str::to_string);
    event_summaries.push(summarize_image_stream_event(&event, image_b64.is_some()));

    if let Some(image_b64) = image_b64 {
        let image_index = event.partial_image_index.unwrap_or(0);
        let progress = match image_index {
            0 => 45,
            1 => 70,
            _ => 85,
        };
        let image_data_url = image_data_url_from_b64(&image_b64);
        *last_image_b64 = Some(image_b64);
        emit_cover_progress(
            app,
            request,
            ai_run_id,
            "partial",
            &format!("Odebrano podglad okładki {}.", u16::from(image_index) + 1),
            Some(image_data_url),
            Some(progress),
        );
    }

    Ok(())
}

fn build_openai_cover_prompt(request: &GenerateBookCoverInput) -> String {
    let mut parts = vec![
        request.cover_prompt.trim().to_string(),
        "Create one polished portrait PNG book-cover image with a 2:3 composition. Do not render readable title text; StoryForge2 overlays the title separately.".to_string(),
    ];

    let negative_prompt = request.cover_negative_prompt.trim();
    if !negative_prompt.is_empty() {
        parts.push(format!("Avoid: {negative_prompt}"));
    }

    parts.join("\n\n")
}

fn image_b64_from_event(event: &ImageGenerationStreamEvent) -> Option<&str> {
    event
        .b64_json
        .as_deref()
        .or_else(|| {
            event
                .data
                .as_ref()?
                .iter()
                .find_map(|item| item.b64_json.as_deref())
        })
        .or_else(|| {
            event
                .response
                .as_ref()?
                .output
                .as_ref()?
                .iter()
                .find_map(|item| item.result.as_deref())
        })
}

fn image_data_url_from_b64(image_b64: &str) -> String {
    format!("data:image/png;base64,{image_b64}")
}

fn summarize_image_stream_event(event: &ImageGenerationStreamEvent, has_image: bool) -> Value {
    serde_json::json!({
        "type": event.event_type.as_deref(),
        "partialImageIndex": event.partial_image_index,
        "hasImage": has_image
    })
}

fn summarize_openai_error_text(body: &str) -> String {
    serde_json::from_str::<Value>(body)
        .map(|value| summarize_openai_error_value(&value))
        .unwrap_or_else(|_| body.trim().chars().take(500).collect())
}

fn summarize_openai_error_value(value: &Value) -> String {
    let error = value.get("error").unwrap_or(value);
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Unknown OpenAI error");
    let code = error.get("code").and_then(Value::as_str);
    let error_type = error.get("type").and_then(Value::as_str);

    match (error_type, code) {
        (Some(error_type), Some(code)) => format!("{message} ({error_type}/{code})"),
        (Some(error_type), None) => format!("{message} ({error_type})"),
        (None, Some(code)) => format!("{message} ({code})"),
        (None, None) => message.to_string(),
    }
}

#[allow(dead_code)]
async fn execute_codex_image_generation(
    app: &AppHandle,
    request: &GenerateBookCoverInput,
    ai_run_id: &str,
    timeout_seconds: u64,
) -> Result<(String, String, PathBuf), AppError> {
    let app_data_dir = app.path().app_data_dir().map_err(|error| {
        AppError::Process(format!(
            "Nie udaĹ‚o siÄ™ ustaliÄ‡ katalogu danych aplikacji: {error}"
        ))
    })?;
    let workspace = app_data_dir
        .join("codex-workspaces")
        .join(&request.project_id)
        .join("cover-runs")
        .join(ai_run_id);
    tokio::fs::create_dir_all(&workspace).await?;
    ensure_git_workspace(&workspace).await;

    let image_path = workspace.join("cover.png");
    let image_path_text = image_path.to_string_lossy().to_string();
    let prompt = request.prompt.replace("{OUTPUT_FILE}", &image_path_text);

    tokio::fs::write(workspace.join("prompt.md"), prompt.as_bytes()).await?;
    tokio::fs::write(
        workspace.join("context.json"),
        serde_json::to_string_pretty(&request.prompt_package_json)?.as_bytes(),
    )
    .await?;

    let codex_path = request
        .codex_path
        .clone()
        .unwrap_or_else(|| "codex".to_string());
    let command_spec = resolve_codex_command(&codex_path).await;
    let instruction = "Run the StoryForge2 cover image prompt from stdin. Use Codex image generation when requested. Save the image exactly where the prompt asks and return only the requested JSON.";

    let mut command = Command::new(command_spec.program);
    command
        .args(command_spec.prefix_args)
        .arg("exec")
        .arg("--enable")
        .arg("image_generation");

    if let Some(model) = request
        .model
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--model").arg(model);
    }

    if let Some(reasoning_effort) = request
        .reasoning_effort
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command
            .arg("-c")
            .arg(format!("model_reasoning_effort=\"{reasoning_effort}\""));
    }

    command
        .arg("--ephemeral")
        .arg("--sandbox")
        .arg("workspace-write")
        .arg(instruction)
        .current_dir(&workspace)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let output = timeout(Duration::from_secs(timeout_seconds), async {
        let mut child = command.spawn()?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(prompt.as_bytes()).await?;
        }
        child.wait_with_output().await.map_err(AppError::from)
    })
    .await
    .map_err(|_| AppError::Timeout(timeout_seconds))??;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    tokio::fs::write(workspace.join("response.raw.md"), stdout.as_bytes()).await?;
    tokio::fs::write(
        workspace.join("last-run.json"),
        serde_json::json!({
            "action": "generate_cover_image",
            "model": request.model,
            "reasoningEffort": request.reasoning_effort,
            "status": output.status.code(),
            "stderr": stderr,
            "imagePath": image_path_text,
            "completedAt": Utc::now().to_rfc3339()
        })
        .to_string()
        .as_bytes(),
    )
    .await?;

    if !output.status.success() {
        return Err(AppError::Process(if stderr.trim().is_empty() {
            "Codex CLI zwrĂłciĹ‚ niezerowy status podczas generowania okĹ‚adki.".into()
        } else {
            stderr
        }));
    }

    let actual_image_path = resolve_generated_cover_path(&image_path, &stdout, &stderr).await?;
    let metadata = tokio::fs::metadata(&actual_image_path)
        .await
        .map_err(|error| {
            AppError::Process(format!(
                "Codex CLI nie utworzyĹ‚ pliku okĹ‚adki pod Ĺ›cieĹĽkÄ… {image_path_text}: {error}"
            ))
        })?;
    if metadata.len() == 0 {
        return Err(AppError::Process(format!(
            "Codex CLI utworzyĹ‚ pusty plik okĹ‚adki pod Ĺ›cieĹĽkÄ… {image_path_text}"
        )));
    }

    Ok((stdout, stderr, actual_image_path))
}

#[allow(dead_code)]
async fn resolve_generated_cover_path(
    requested_path: &Path,
    stdout: &str,
    stderr: &str,
) -> Result<PathBuf, AppError> {
    if tokio::fs::metadata(requested_path).await.is_ok() {
        return Ok(requested_path.to_path_buf());
    }

    if let Some(path) = cover_path_from_json(stdout)
        .or_else(|| cover_path_from_json(stderr))
        .filter(|path| path.exists())
    {
        return Ok(path);
    }

    Err(AppError::Process(format!(
        "Codex CLI zakonczyl generowanie, ale nie znaleziono pliku okladki. Oczekiwana sciezka: {}. Jesli Codex zapisal obraz w innym miejscu, odpowiedz musi zawierac JSON z polem imagePath.",
        requested_path.to_string_lossy()
    )))
}

#[allow(dead_code)]
fn cover_path_from_json(output: &str) -> Option<PathBuf> {
    let candidate = extract_json_candidate(output)?;
    let parsed: Value = serde_json::from_str(candidate).ok()?;
    let path = parsed.get("imagePath").and_then(Value::as_str)?;
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed.starts_with("data:") {
        return None;
    }

    Some(PathBuf::from(trimmed))
}

#[allow(dead_code)]
fn extract_json_candidate(output: &str) -> Option<&str> {
    let start = output.find('{')?;
    let end = output.rfind('}')?;
    if start >= end {
        return None;
    }

    Some(&output[start..=end])
}

async fn execute_codex(
    app: &AppHandle,
    request: &RunCodexPromptRequest,
    timeout_seconds: u64,
) -> Result<(String, String), AppError> {
    let app_data_dir = app.path().app_data_dir().map_err(|error| {
        AppError::Process(format!(
            "Nie udało się ustalić katalogu danych aplikacji: {error}"
        ))
    })?;
    let workspace = app_data_dir
        .join("codex-workspaces")
        .join(&request.project_id);
    tokio::fs::create_dir_all(&workspace).await?;
    ensure_git_workspace(&workspace).await;

    tokio::fs::write(workspace.join("prompt.md"), request.prompt.as_bytes()).await?;
    tokio::fs::write(
        workspace.join("context.md"),
        serde_json::to_string_pretty(&request.prompt_package_json)?.as_bytes(),
    )
    .await?;

    let codex_path = request
        .codex_path
        .clone()
        .unwrap_or_else(|| "codex".to_string());
    let command_spec = resolve_codex_command(&codex_path).await;
    let instruction = "Run the StoryForge2 writing-assistant prompt from stdin. Return only the requested output contract.";

    let mut command = Command::new(command_spec.program);
    command.args(command_spec.prefix_args).arg("exec");

    if let Some(model) = request
        .model
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command.arg("--model").arg(model);
    }

    if let Some(reasoning_effort) = request
        .reasoning_effort
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        command
            .arg("-c")
            .arg(format!("model_reasoning_effort=\"{reasoning_effort}\""));
    }

    command
        .arg("--ephemeral")
        .arg("--sandbox")
        .arg("read-only")
        .arg(instruction)
        .current_dir(&workspace)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let output = timeout(Duration::from_secs(timeout_seconds), async {
        let mut child = command.spawn()?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(request.prompt.as_bytes()).await?;
        }
        child.wait_with_output().await.map_err(AppError::from)
    })
    .await
    .map_err(|_| AppError::Timeout(timeout_seconds))??;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    tokio::fs::write(workspace.join("response.raw.md"), stdout.as_bytes()).await?;
    tokio::fs::write(
        workspace.join("last-run.json"),
        serde_json::json!({
            "action": request.action,
            "model": request.model,
            "reasoningEffort": request.reasoning_effort,
            "status": output.status.code(),
            "stderr": stderr,
            "completedAt": Utc::now().to_rfc3339()
        })
        .to_string()
        .as_bytes(),
    )
    .await?;

    if output.status.success() {
        Ok((stdout, stderr))
    } else {
        Err(AppError::Process(if stderr.trim().is_empty() {
            "Codex CLI zwrócił niezerowy status.".into()
        } else {
            stderr
        }))
    }
}

async fn ensure_git_workspace(workspace: &Path) {
    if workspace.join(".git").exists() {
        return;
    }

    let _ = Command::new("git")
        .arg("init")
        .current_dir(workspace)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .await;
}

async fn resolve_codex_command(path: &str) -> CodexCommandSpec {
    let resolved = resolve_codex_path(path).unwrap_or_else(|| PathBuf::from(path));
    command_spec_for_path(resolved)
}

fn resolve_codex_path(path: &str) -> Option<PathBuf> {
    let path_buf = PathBuf::from(path);
    if has_path_separator(path) {
        return resolve_explicit_codex_path(path_buf);
    }

    let path_var = env::var_os("PATH")?;
    let mut candidates = Vec::new();
    for dir in env::split_paths(&path_var) {
        for candidate in command_candidates(&dir.join(path)) {
            if candidate.is_file() {
                candidates.push(candidate);
            }
        }
    }

    candidates.sort_by_key(|candidate| command_candidate_priority(candidate));
    candidates.into_iter().next()
}

fn resolve_explicit_codex_path(path: PathBuf) -> Option<PathBuf> {
    let mut candidates = command_candidates(&path)
        .into_iter()
        .filter(|candidate| candidate.is_file())
        .collect::<Vec<_>>();
    candidates.sort_by_key(|candidate| command_candidate_priority(candidate));
    candidates.into_iter().next()
}

fn command_candidates(base: &Path) -> Vec<PathBuf> {
    if base.extension().is_some() {
        return vec![base.to_path_buf()];
    }

    let mut candidates = Vec::new();
    if cfg!(windows) {
        candidates.push(base.with_extension("exe"));
        candidates.push(base.with_extension("cmd"));
        candidates.push(base.with_extension("bat"));
        candidates.push(base.with_extension("ps1"));
    }
    candidates.push(base.to_path_buf());
    candidates
}

fn command_spec_for_path(path: PathBuf) -> CodexCommandSpec {
    let display_path = path.to_string_lossy().to_string();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if cfg!(windows) && matches!(extension.as_str(), "cmd" | "bat") {
        return CodexCommandSpec {
            program: OsString::from("cmd.exe"),
            prefix_args: vec![OsString::from("/C"), path.into_os_string()],
            display_path,
        };
    }

    if cfg!(windows) && extension == "ps1" {
        return CodexCommandSpec {
            program: OsString::from("powershell.exe"),
            prefix_args: vec![
                OsString::from("-NoProfile"),
                OsString::from("-ExecutionPolicy"),
                OsString::from("Bypass"),
                OsString::from("-File"),
                path.into_os_string(),
            ],
            display_path,
        };
    }

    CodexCommandSpec {
        program: path.into_os_string(),
        prefix_args: Vec::new(),
        display_path,
    }
}

fn command_candidate_priority(path: &Path) -> u16 {
    let path_text = path.to_string_lossy().to_ascii_lowercase();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let mut priority: u16 = match extension.as_str() {
        "cmd" => 10,
        "bat" => 11,
        "ps1" => 20,
        "exe" => 30,
        _ => 40,
    };

    if cfg!(windows) && path_text.contains("\\appdata\\roaming\\npm\\") {
        priority = priority.saturating_sub(8);
    }

    if cfg!(windows) && path_text.contains("\\windowsapps\\") {
        priority += 1000;
    }

    priority
}

fn fallback_model_catalog(error_message: String) -> CodexModelCatalog {
    CodexModelCatalog {
        models: vec![serde_json::json!({
            "slug": "gpt-5.5",
            "display_name": "GPT-5.5",
            "description": "Model fallback używany, gdy katalog modeli Codex CLI jest niedostępny.",
            "default_reasoning_level": "medium",
            "supported_reasoning_levels": [
                { "effort": "low", "description": "Fast responses with lighter reasoning" },
                { "effort": "medium", "description": "Balances speed and reasoning depth" },
                { "effort": "high", "description": "Greater reasoning depth" },
                { "effort": "xhigh", "description": "Extra high reasoning depth" }
            ]
        })],
        fallback: true,
        error_message: Some(error_message),
    }
}

fn has_path_separator(path: &str) -> bool {
    path.contains('\\') || path.contains('/') || path.contains(':')
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().map_err(|error| {
                Box::<dyn std::error::Error>::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Nie udało się ustalić katalogu danych aplikacji: {error}"),
                ))
            })?;
            let pool =
                tauri::async_runtime::block_on(init_database(app_data_dir)).map_err(|error| {
                    Box::<dyn std::error::Error>::from(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        error.to_string(),
                    ))
                })?;
            app.manage(AppState { db: pool });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_project,
            list_projects,
            get_project,
            update_book_concept,
            generate_book_cover,
            check_codex_cli,
            list_codex_models,
            generate_new_project_title,
            run_codex_prompt
        ])
        .run(tauri::generate_context!())
        .expect("error while running StoryForge2");
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_pool() -> SqlitePool {
        let database_path =
            std::env::temp_dir().join(format!("storyforge2-test-{}.sqlite", Uuid::new_v4()));
        init_database_at(database_path).await.unwrap()
    }

    #[tokio::test]
    async fn migration_creates_core_tables() {
        let pool = test_pool().await;
        let table_count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM sqlite_master
            WHERE type = 'table'
              AND name IN ('projects', 'books', 'ai_runs', 'ai_proposals')
            "#,
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(table_count.0, 4);
    }

    #[tokio::test]
    async fn create_project_persists_default_book() {
        let pool = test_pool().await;
        let created = create_project_in_pool(
            &pool,
            CreateProjectInput {
                name: "Nowa powiesc".into(),
                language: None,
            },
        )
        .await
        .unwrap();

        let listed = list_projects_in_pool(&pool).await.unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, created.project.id);
        assert_eq!(created.book.working_title, "Nowa powiesc");
        assert_eq!(created.book.cover_image_path, "");
        assert_eq!(listed[0].cover_image_path, "");
    }

    #[tokio::test]
    async fn project_summary_includes_cover_metadata() {
        let pool = test_pool().await;
        let created = create_project_in_pool(
            &pool,
            CreateProjectInput {
                name: "Ksiazka z okladka".into(),
                language: None,
            },
        )
        .await
        .unwrap();

        let generated_at = Utc::now().to_rfc3339();
        let book = update_book_cover_metadata_in_pool(
            &pool,
            &created.book.id,
            "C:\\covers\\cover.png",
            "dark editorial cover",
            "watermark",
            &generated_at,
        )
        .await
        .unwrap();

        let listed = list_projects_in_pool(&pool).await.unwrap();
        assert_eq!(book.cover_image_path, "C:\\covers\\cover.png");
        assert_eq!(book.cover_prompt, "dark editorial cover");
        assert_eq!(book.cover_negative_prompt, "watermark");
        assert_eq!(
            book.cover_generated_at.as_deref(),
            Some(generated_at.as_str())
        );
        assert_eq!(listed[0].cover_image_path, "C:\\covers\\cover.png");
    }

    #[tokio::test]
    async fn cover_path_can_be_resolved_from_codex_json_output() {
        let image_path =
            std::env::temp_dir().join(format!("storyforge2-cover-{}.png", Uuid::new_v4()));
        tokio::fs::write(&image_path, b"png").await.unwrap();

        let stdout = serde_json::json!({
            "version": 1,
            "kind": "book_cover_image",
            "imagePath": image_path.to_string_lossy()
        })
        .to_string();
        let requested_path =
            std::env::temp_dir().join(format!("storyforge2-requested-{}.png", Uuid::new_v4()));

        let resolved = resolve_generated_cover_path(&requested_path, &stdout, "")
            .await
            .unwrap();

        assert_eq!(resolved, image_path);
        let _ = tokio::fs::remove_file(resolved).await;
    }

    #[test]
    fn image_stream_event_extracts_partial_image_preview() {
        let event: ImageGenerationStreamEvent = serde_json::from_value(serde_json::json!({
            "type": "image_generation.partial_image",
            "partial_image_index": 1,
            "b64_json": "cG5n"
        }))
        .unwrap();

        assert_eq!(image_b64_from_event(&event), Some("cG5n"));
        assert_eq!(
            summarize_image_stream_event(&event, true),
            serde_json::json!({
                "type": "image_generation.partial_image",
                "partialImageIndex": 1,
                "hasImage": true
            })
        );
        assert_eq!(
            image_data_url_from_b64("cG5n"),
            "data:image/png;base64,cG5n"
        );
    }

    #[test]
    fn image_stream_event_extracts_final_response_image() {
        let event: ImageGenerationStreamEvent = serde_json::from_value(serde_json::json!({
            "type": "response.completed",
            "response": {
                "output": [
                    {
                        "type": "image_generation_call",
                        "result": "ZmluYWw="
                    }
                ]
            }
        }))
        .unwrap();

        assert_eq!(image_b64_from_event(&event), Some("ZmluYWw="));
    }
}
