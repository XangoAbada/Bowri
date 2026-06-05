# Testy I Acceptance Criteria

Ten dokument zbiera testy przekrojowe dla StoryForge2.

## Kategorie Testow

- unit tests domeny;
- testy migracji SQLite;
- testy komend Tauri;
- testy prompt buildera;
- testy parserow AI;
- testy UI;
- testy e2e;
- testy manualne Codex CLI.

## Testy Codex CLI Bridge

### Brak CLI

Warunek:

- `codex` nie jest dostepny w PATH.

Oczekiwane:

- `checkCodexCli.available=false`;
- UI pokazuje konfiguracje;
- przyciski AI sa disabled albo prowadza do konfiguracji;
- dane projektu nie sa tracone.

### CLI Dostepny

Warunek:

- `codex --version` dziala.

Oczekiwane:

- UI pokazuje wersje;
- mozna uruchomic testowy prompt;
- blad auth jest pokazany czytelnie, jesli uzytkownik nie jest zalogowany.

### Generowanie Tytulow

Warunek:

- projekt ma premise, gatunek i ton.

Oczekiwane:

- prompt zawiera te dane;
- `codex exec` zwraca wynik;
- parser wyciaga JSON;
- panel pokazuje tytuly;
- akceptacja zapisuje wybrany tytul.

### Timeout

Oczekiwane:

- proces jest anulowany;
- prompt zostaje zapisany w `ai_runs`;
- UI pozwala ponowic.

## Testy Danych

- utworzenie projektu;
- utworzenie ksiazki;
- aktualizacja koncepcji;
- utworzenie postaci;
- utworzenie lokacji;
- utworzenie watku;
- utworzenie rozdzialu i sceny;
- zapis manuskryptu;
- zapis faktu;
- zapis wiedzy postaci;
- transakcyjna akceptacja propozycji AI.

## Testy Promptow

Kazdy prompt sprawdzic snapshotem:

- zawiera role;
- zawiera task;
- zawiera hard rules;
- zawiera output contract;
- zawiera tylko relewantny kontekst;
- nie zawiera tokenow ani sciezek auth;
- ma poprawny jezyk.

## Testy Parserow

Parser JSON powinien obsluzyc:

- czysty JSON;
- JSON w fenced block;
- tekst przed fenced block z ostrzezeniem;
- niepoprawny JSON;
- pusta odpowiedz;
- odpowiedz za dluga.

## Testy Edytora

- autosave;
- licznik slow;
- zaznaczenie tekstu;
- popup AI;
- rewrite zaznaczenia;
- append do sceny;
- anulowanie propozycji;
- historia wariantow.

## Testy Ciaglosci

- fakt znany tylko jednej postaci;
- postac ujawnia fakt przed nauczeniem sie go;
- scena narusza regule swiata;
- watek bez payoffu;
- rozdzial bez konfliktu;
- timeline poza kolejnoscia.

## Testy Eksportu

- eksport Markdown;
- eksport plain text;
- kolejnosc rozdzialow;
- brak notatek w trybie manuskrypt-only;
- poprawne polskie znaki.

## Acceptance V1

V1 jest gotowa, gdy:

- aplikacja uruchamia sie jako desktop;
- projekt zapisuje sie lokalnie;
- Codex CLI Bridge dziala dla co najmniej trzech akcji: tytuly, postac, scena;
- panel propozycji wymaga akceptacji;
- edytor scen jest uzywalny;
- Story Bible zasila prompt sceny;
- brak Codex CLI jest obsluzony bez crasha;
- eksport Markdown dziala.

## Manual QA Checklist

- Zainstaluj aplikacje na czystym systemie dev.
- Uruchom bez Codex CLI.
- Sprawdz ekran konfiguracji.
- Zainstaluj/zaloguj Codex CLI.
- Utworz projekt.
- Wygeneruj tytuly.
- Wygeneruj postac.
- Wygeneruj plan 3 rozdzialow.
- Napisz scene.
- Zaznacz fragment i rozwin.
- Wyodrebnij fakty.
- Zamknij aplikacje.
- Otworz ponownie i sprawdz dane.
- Wyeksportuj Markdown.

