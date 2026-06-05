# Faza 1: Fundament Aplikacji

Cel fazy: stworzyc uruchamialny szkielet StoryForge2 z lokalna baza, podstawowym UI i dzialajacym sprawdzeniem Codex CLI.

## Zakres

Implementowac:

- repozytorium Git;
- Tauri 2 + React + Vite + TypeScript;
- podstawowy layout;
- SQLite i migracje;
- ekran projektow;
- tworzenie projektu;
- ekran ustawien AI;
- komendy Tauri dla Codex CLI;
- pierwszy przeplyw AI: generowanie tytulow.

Nie implementowac jeszcze:

- pelnego edytora scen;
- wszystkich encji Story Bible;
- obrazow;
- eksportu;
- providerow API.

## Kroki Implementacji

1. Utworz scaffold Tauri.
2. Ustaw TypeScript strict.
3. Dodaj routing.
4. Dodaj globalny layout aplikacji.
5. Dodaj SQLite w backendzie Tauri.
6. Dodaj migracje dla `projects`, `books`, `ai_runs`, `ai_proposals`.
7. Dodaj komendy:
   - `create_project`;
   - `list_projects`;
   - `get_project`;
   - `update_book_concept`;
   - `check_codex_cli`;
   - `run_codex_prompt`.
8. Dodaj ekran dashboardu.
9. Dodaj ekran koncepcji ksiazki.
10. Dodaj panel wyniku AI.

## Minimalny UI

### Dashboard

Elementy:

- lista projektow;
- przycisk nowego projektu;
- data ostatniej edycji;
- otwieranie projektu.

### Shell Projektu

Elementy:

- lewy sidebar;
- naglowek z nazwa projektu;
- centralny outlet routingu;
- prawy panel kontekstu i AI.

### Ustawienia AI

Elementy:

- status Codex CLI;
- wersja CLI;
- pole sciezki do `codex`, domyslnie `codex`;
- przycisk "Sprawdz";
- instrukcja logowania.

## Codex CLI Bridge V1

Pierwsza akcja: `generate_titles`.

Input:

- robocza premisa;
- gatunek;
- ton;
- odbiorcy;
- liczba propozycji: 20.

Output:

- JSON `title_suggestions`.

Po wyniku:

- pokaz liste tytulow;
- pozwol ustawic jeden jako roboczy tytul;
- zapisz wybor po akceptacji.

## Dane

Minimalne pola `Book`:

- `workingTitle`;
- `premise`;
- `genre`;
- `targetAudience`;
- `tone`;
- `styleGuide`;

## Acceptance Criteria

- Aplikacja startuje lokalnie.
- Mozna utworzyc projekt.
- Projekt zapisuje sie w SQLite.
- Po restarcie projekt jest widoczny.
- Aplikacja wykrywa brak lub obecnosc Codex CLI.
- Pierwszy prompt AI dla tytulow uruchamia `codex exec`.
- Wynik nie zapisuje sie automatycznie.
- Wybrany tytul zapisuje sie po akceptacji.

## Testy

- test migracji bazy;
- test tworzenia projektu;
- test walidacji JSON tytulow;
- test UI: brak Codex CLI pokazuje ekran konfiguracji;
- test mockowany: `run_codex_prompt` zwraca poprawny JSON i panel pokazuje wyniki.

