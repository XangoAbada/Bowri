# Stack Techniczny

StoryForge2 ma byc lokalna aplikacja desktopowa. Priorytety techniczne: prywatnosc, prosty runtime, stabilny zapis danych, dobra ergonomia edytora i latwe wywolywanie lokalnego Codex CLI.

## Wybrany Stack

- Desktop: Tauri 2.
- Frontend: React + Vite + TypeScript.
- Routing: TanStack Router.
- Stan UI: Zustand.
- Dane serwerowe/lokalne operacje async: TanStack Query.
- Walidacja: Zod.
- Edytor: TipTap oparty o ProseMirror.
- Baza: SQLite w katalogu danych aplikacji.
- Warstwa bazy: Rust + SQLx + komendy Tauri.
- Testy frontend: Vitest + Testing Library.
- Testy e2e: Playwright.
- Testy backend/Rust: cargo test.
- Stylowanie: CSS Modules albo Tailwind, ale z wlasnymi tokenami designu.

## Dlaczego Tauri

Tauri daje:

- natywna aplikacje desktopowa;
- dostep do procesow lokalnych;
- mala paczke w porownaniu do Electron;
- Rust backend do bezpiecznego uruchamiania `codex exec`;
- latwy model komend miedzy frontendem a backendem.

## Dlaczego React + Vite

React + Vite daje:

- szybki development;
- bogaty ekosystem edytorow;
- dobra integracje z TipTap;
- prosty setup dla AI-implementera;
- brak koniecznosci SSR, ktory nie jest potrzebny w lokalnej aplikacji.

## Dlaczego SQLite

SQLite pasuje, bo:

- aplikacja jest prywatna i lokalna;
- dane projektu sa relacyjne;
- latwo robic backup pojedynczego pliku;
- dziala bez serwera;
- pozwala trzymac timeline, relacje i fakty w sposob zapytaniowy.

## Struktura Repozytorium

Docelowa struktura po scaffoldzie:

```text
StoryForge2/
  docs/
    blueprint/
  apps/
    desktop/
      src/
        main.tsx
        app/
        features/
        shared/
      src-tauri/
        src/
        migrations/
        tauri.conf.json
  packages/
    story-domain/
    prompt-engine/
  README.md
```

Na poczatku mozna stworzyc tylko `apps/desktop`. Katalogi `packages` dodac wtedy, gdy logika domenowa zacznie byc wspoldzielona miedzy UI, testami i promptami.

## Warstwy Aplikacji

### UI

React renderuje:

- dashboard projektow;
- sidebar etapow;
- formularze Story Bible;
- edytor scen;
- panel kontekstu;
- panel propozycji AI.

UI nie uruchamia `codex` bezposrednio. Zawsze wola komende Tauri.

### Domain

Warstwa domenowa zawiera:

- typy encji;
- walidacje Zod;
- reguly kanonu;
- funkcje budowania kontekstu;
- mapowanie odpowiedzi AI na propozycje zmian.

### Persistence

Rust/Tauri:

- tworzy baze SQLite;
- uruchamia migracje;
- udostepnia komendy CRUD;
- wykonuje transakcje przy akceptacji zmian AI;
- zapisuje snapshoty projektu.

### AI Provider

V1:

- `codex-cli-bridge`.

Pozniej:

- `manual-chatgpt`;
- `openai-api`;
- `anthropic-api`.

Interfejs AI musi byc wspolny od pierwszego dnia, zeby pozniej nie przepisywac przyciskow AI.

## Bezpieczenstwo

- Nie przechowywac tokenow ChatGPT/OAuth.
- Nie czytac plikow konfiguracyjnych Codex CLI poza minimalna detekcja statusu.
- Nie uruchamiac shell commands podanych przez AI.
- `codex exec` uruchamiac z przygotowanym promptem i w kontrolowanym katalogu roboczym.
- Domyslnie uzywac trybu read-only sandbox Codex, bo aplikacja potrzebuje odpowiedzi tekstowej, nie edycji plikow.
- Wszystkie zmiany w bazie pochodzace z AI wymagaja akceptacji uzytkownika.

## Konfiguracja Lokalna

Ustawienia aplikacji:

- sciezka do `codex`, domyslnie `codex` z PATH;
- model Codex, opcjonalny, jesli CLI pozwala go ustawic;
- reasoning effort, opcjonalny;
- timeout generowania;
- maksymalna liczba slow domyslna dla sceny;
- jezyk projektu;
- katalog backupow.

## Pierwszy Scaffold

AI-implementer powinien zaczac od:

1. Utworzenia repozytorium Git.
2. Scaffold Tauri + React + Vite + TypeScript.
3. Dodania podstawowego layoutu aplikacji.
4. Dodania SQLite i migracji.
5. Dodania komendy `check_codex_cli`.
6. Dodania komendy `run_codex_prompt`.
7. Dodania jednego ekranu: Koncepcja ksiazki.
8. Dodania pierwszego przycisku AI: generowanie tytulow.

