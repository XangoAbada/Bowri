import { BookOpen, FolderOpen, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { createProject, listProjects } from "../../shared/api/commands";
import { formatLocalDateTime } from "../../shared/date";

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    retry: 0
  });

  const createMutation = useMutation({
    mutationFn: () => createProject({ name, language: "pl" }),
    onSuccess: async (details) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await navigate({
        to: "/projects/$projectId/concept",
        params: { projectId: details.project.id }
      });
    }
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) {
      return;
    }
    createMutation.mutate();
  }

  return (
    <main className="dashboard">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">StoryForge2</p>
          <h1>Projekty</h1>
          <p className="muted-text">
            Lokalny warsztat pisarski z kanonem, SQLite i Codex CLI Bridge.
          </p>
        </div>
        <form className="new-project-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Nowy projekt
            <div className="inline-control">
              <BookOpen size={16} aria-hidden="true" />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Roboczy tytul ksiazki"
              />
              <button
                type="submit"
                className="icon-button strong"
                aria-label="Utworz projekt"
                title="Utworz projekt"
                disabled={createMutation.isPending || name.trim().length === 0}
              >
                <Plus size={17} />
              </button>
            </div>
          </label>
          {createMutation.isError ? (
            <p className="warning-text">Nie udalo sie utworzyc projektu.</p>
          ) : null}
        </form>
      </section>

      <section className="project-list-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Biblioteka</p>
            <h2>Ostatnie projekty</h2>
          </div>
          <FolderOpen size={20} aria-hidden="true" />
        </div>

        {projectsQuery.isLoading ? <p className="muted-text">Laduje projekty...</p> : null}

        {projectsQuery.isError ? (
          <div className="empty-state">
            <h3>Backend desktopowy nie odpowiada</h3>
            <p>
              Uruchom aplikacje przez Tauri, aby korzystac z lokalnej bazy
              SQLite i komend Rust.
            </p>
          </div>
        ) : null}

        {projectsQuery.data?.length === 0 ? (
          <div className="empty-state">
            <h3>Jeszcze nie ma projektow</h3>
            <p>Utworz pierwszy projekt, a StoryForge2 zalozy ksiazke i baze.</p>
          </div>
        ) : null}

        <div className="project-grid">
          {projectsQuery.data?.map((project) => (
            <Link
              className="project-card"
              to="/projects/$projectId/concept"
              params={{ projectId: project.id }}
              key={project.id}
            >
              <span className="project-card-icon">
                <BookOpen size={18} />
              </span>
              <strong>{project.name}</strong>
              <small>{project.workingTitle || "Bez tytulu roboczego"}</small>
              <time>{formatLocalDateTime(project.updatedAt)}</time>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
