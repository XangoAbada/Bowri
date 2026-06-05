# Prompty Dla AI-Implementera

Te prompty sluza do etapowego budowania aplikacji. Kazdy prompt zaklada, ze AI ma czytac odpowiedni dokument blueprintu przed zmianami.

## Prompt 1: Scaffold

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/00_README.md, 03_stack_techniczny.md, 04_ai_provider_codex_cli_bridge.md i 08_faza_1_fundament.md.

Zaimplementuj pierwszy scaffold:
- Tauri 2 + React + Vite + TypeScript;
- podstawowy shell UI;
- dashboard projektow;
- SQLite z migracjami dla projects, books, ai_runs, ai_proposals;
- komendy Tauri list/create/get project;
- komenda check_codex_cli.

Nie implementuj providerow API. Nie automatyzuj ChatGPT web. Po zmianach uruchom testy i dev server.
```

## Prompt 2: Pierwszy AI Flow

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/04_ai_provider_codex_cli_bridge.md, 06_prompt_architecture.md i 09_faza_2_koncepcja_ksiazki.md.

Zaimplementuj akcje AI generate_titles przez codex-cli-bridge:
- PromptPackage;
- prompt builder;
- run_codex_prompt;
- parser title_suggestions;
- panel propozycji;
- akceptacja wybranego tytulu.

Dodaj testy parsera i mockowany test UI. Nie zapisuj tokenow Codex ani ChatGPT.
```

## Prompt 3: Koncepcja Ksiazki

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/09_faza_2_koncepcja_ksiazki.md.

Rozbuduj ekran koncepcji ksiazki:
- tytul;
- premisa;
- logline;
- gatunek;
- odbiorcy;
- ton;
- style guide;
- target word count;
- AI actions: expand_premise, generate_style_guide.

Kazda odpowiedz AI ma przejsc przez panel propozycji.
```

## Prompt 4: Postacie

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/05_model_danych.md i 11_faza_4_postacie_relacje.md.

Zaimplementuj modul postaci:
- lista postaci;
- profil postaci;
- CRUD;
- akcja AI generate_character przez codex-cli-bridge;
- czesciowa akceptacja pol profilu.

Dodaj walidacje Zod i test importu JSON.
```

## Prompt 5: Plan Powiesci

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/10_faza_3_plan_powieści.md.

Zaimplementuj plan powiesci:
- struktura;
- rozdzialy;
- podstawowe sceny;
- akcja AI generate_plot_outline;
- import rozdzialow z JSON;
- reorder rozdzialow.

Nie implementuj jeszcze pelnego edytora TipTap.
```

## Prompt 6: Swiat I Reguly

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/12_faza_5_swiat_reguly.md.

Zaimplementuj modul swiata:
- world_elements;
- world_rules;
- CRUD;
- powiazanie lokacji ze scena;
- akcje AI generate_world_element i check_world_rule.
```

## Prompt 7: Edytor Scen

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/14_faza_7_edytor_scen.md i 06_prompt_architecture.md.

Zaimplementuj edytor scen:
- TipTap;
- autosave;
- licznik slow;
- target word count;
- popup dla zaznaczenia;
- akcje AI draft_scene, continue_scene, rewrite_selection, expand_selection.

Wynik AI nie moze zmienic tekstu bez akceptacji.
```

## Prompt 8: Wiedza I Ciaglosc

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/13_faza_6_watki_ciaglosc_wiedza.md i 15_faza_8_ekstrakcja_dynamiczna.md.

Zaimplementuj:
- story_facts;
- character_knowledge;
- dynamic extraction po scenie;
- panel propozycji faktow;
- continuity review.

AI ma proponowac zmiany, nie stosowac automatycznie.
```

## Prompt 9: Eksport

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/17_faza_10_redakcja_eksport.md.

Zaimplementuj:
- eksport Markdown;
- eksport plain text;
- chapter review przez Codex CLI;
- line edit zaznaczenia.

Dodaj testy eksportu i zachowania kolejnosci rozdzialow.
```

## Prompt 10: Future Providers Preparation

```md
Pracujesz nad StoryForge2. Przeczytaj docs/blueprint/18_future_providers.md.

Przygotuj kod tak, aby mozna bylo pozniej dodac manual-chatgpt, openai-api i anthropic-api:
- nie implementuj ich jeszcze;
- upewnij sie, ze UI wola tylko AIProvider;
- dodaj typy i testy kontraktu providera.
```

