# AI Provider: Codex CLI Bridge

`codex-cli-bridge` jest jedynym aktywnym providerem AI w V1. Jego zadaniem jest wywolanie oficjalnego Codex CLI w trybie nieinteraktywnym, przekazanie promptu i kontekstu oraz odebranie wyniku bez recznego kopiowania.

## Cel

Autor naciska przycisk AI w StoryForge2, a aplikacja:

1. Buduje pelny prompt.
2. Uruchamia `codex exec`.
3. Odbiera wynik ze `stdout`.
4. Parsuje wynik.
5. Pokazuje propozycje.
6. Zapisuje zmiany dopiero po akceptacji.

## Wymagania Uzytkownika

Uzytkownik musi miec:

- zainstalowany Codex CLI;
- zalogowany Codex CLI przez konto ChatGPT albo inna oficjalna metoda wspierana przez Codex;
- dostep do internetu w momencie generowania.

StoryForge2 nie przeprowadza wlasnego OAuth.

## Detekcja CLI

Komenda Tauri:

```ts
checkCodexCli(): Promise<CodexCliStatus>
```

Typ:

```ts
type CodexCliStatus = {
  available: boolean;
  path?: string;
  version?: string;
  authLikelyReady?: boolean;
  message?: string;
};
```

Implementacja:

- uruchom `codex --version`;
- jesli komenda nie istnieje, `available=false`;
- jesli istnieje, pokaz wersje;
- nie probuj czytac tokenow;
- auth sprawdzaj przez bezpieczne, lekkie wywolanie diagnostyczne, jesli Codex CLI udostepnia taka komende; jesli nie, oznacz `authLikelyReady=unknown` i pozwol pierwszemu `codex exec` pokazac blad.

## Katalog Roboczy

Dla kazdego projektu utworzyc lokalny katalog roboczy:

```text
<app-data>/StoryForge2/codex-workspaces/<projectId>/
```

W katalogu trzymac tylko pliki tymczasowe dla Codex:

- `context.md`;
- `prompt.md`;
- `response.raw.md`;
- `last-run.json`.

Nie trzymac tam glownej bazy ani jedynej kopii manuskryptu.

Jesli `codex exec` wymaga repozytorium Git, sa dwie akceptowalne strategie:

- preferowana: zainicjowac Git w katalogu roboczym Codex i uruchamiac Codex tam;
- alternatywna: uzyc oficjalnej flagi `--skip-git-repo-check`, jesli aktualna wersja CLI ja wspiera.

## Tryb Uruchomienia

Domyslna komenda:

```text
codex exec --ephemeral --sandbox read-only "<task>"
```

Jezeli uzywany jest stdin:

```text
codex exec --ephemeral --sandbox read-only "<instruction>" < prompt.md
```

Zasady:

- prompt przekazywac przez plik/stdin, gdy jest dlugi;
- nie budowac jednej ogromnej komendy z nieescapowanym tekstem autora;
- ustawic timeout, domyslnie 180 sekund dla malych akcji i 600 sekund dla rozdzialow;
- `stdout` traktowac jako wynik koncowy;
- `stderr` traktowac jako log/progress;
- nie pozwalac AI wykonywac polecen mutujacych w katalogu aplikacji.

## Interfejs Provider

```ts
type AIProviderId = "codex-cli-bridge";

type PromptPackage = {
  id: string;
  projectId: string;
  action: AIAction;
  locale: "pl" | "en";
  userInstruction: string;
  context: PromptContext;
  outputContract: OutputContract;
  generationOptions: GenerationOptions;
};

type AIResult = {
  providerId: AIProviderId;
  promptPackageId: string;
  status: "success" | "error" | "cancelled" | "timeout";
  rawOutput?: string;
  parsedOutput?: unknown;
  diagnostics?: AIDiagnostics;
};
```

## Akcje AI

Minimalne `AIAction` w V1:

- `generate_titles`;
- `expand_premise`;
- `generate_character`;
- `generate_world_element`;
- `generate_plot_outline`;
- `generate_chapter_summary`;
- `draft_scene`;
- `continue_scene`;
- `rewrite_selection`;
- `expand_selection`;
- `extract_story_facts`;
- `review_continuity`.

## Format Odpowiedzi

Kazdy prompt wymaga odpowiedzi w jednym z dwoch formatow:

### Markdown

Dla tekstu prozatorskiego:

```md
## Result

...tekst...

## Notes

- opcjonalne uwagi
```

### JSON

Dla danych strukturalnych:

```json
{
  "version": 1,
  "kind": "title_suggestions",
  "items": []
}
```

Prompt musi prosic o brak komentarzy poza kontraktem, ale parser i tak powinien umiec wyciagnac JSON z fenced code block.

## Ekran Wyniku

Po kazdej akcji pokazac panel:

- surowy wynik;
- wynik sparsowany;
- zmiany do zastosowania;
- ostrzezenia walidacji;
- przyciski: Akceptuj, Edytuj, Ponow, Odrzuc.

AI nigdy nie zapisuje bez tego panelu.

## Obsluga Bledow

### Brak Codex CLI

Pokaz ekran konfiguracji:

- informacja, ze Codex CLI nie jest znaleziony;
- pole sciezki do binarki;
- przycisk ponownego sprawdzenia;
- link tekstowy do instrukcji instalacji w dokumentacji aplikacji.

### Brak logowania

Pokaz:

- "Codex CLI wymaga logowania";
- instrukcja: uruchom `codex` w terminalu i zaloguj sie kontem ChatGPT;
- przycisk "Sprawdz ponownie".

### Limit lub 429

Pokaz:

- opis, ze limit planu mogl zostac osiagniety;
- zachowaj prompt;
- pozwol ponowic pozniej;
- nie kasuj szkicu.

### Timeout

Pokaz:

- czas trwania;
- opcje: ponow z krotszym promptem, zwieksz timeout, anuluj;
- zapisz prompt i log.

### Niepoprawny JSON

Pokaz wynik surowy i przycisk:

- "Popros Codex o naprawe formatu";
- "Importuj recznie";
- "Odrzuc".

## Logowanie

W bazie mozna zapisac:

- id promptu;
- typ akcji;
- czas startu i konca;
- status;
- liczbe znakow promptu;
- liczbe znakow odpowiedzi;
- blad techniczny bez tokenow;
- snapshot kontekstu albo hash snapshotu.

Nie zapisywac tokenow, naglowkow auth ani prywatnych plikow konfiguracyjnych Codex.

## Acceptance Criteria

- `checkCodexCli` odroznia brak CLI od bledu uruchomienia.
- `runCodexPrompt` potrafi uruchomic proste generowanie tytulow.
- Dlugie prompty sa przekazywane bez uszkodzenia polskich znakow.
- Wynik `stdout` trafia do panelu propozycji.
- Bledy CLI nie zamykaja aplikacji.
- Ten sam provider obsluguje wszystkie przyciski AI.

