# Faza 7: Edytor Scen I Rozdzialow

Cel fazy: dac autorowi pelny edytor prozy z kontekstowym AI.

## Edytor

Edytor oparty o TipTap.

Funkcje:

- formatowanie podstawowe;
- naglowki scen;
- licznik slow;
- target word count;
- autosave;
- status sceny;
- zaznaczenie tekstu;
- popup AI;
- warianty odpowiedzi AI.

## Widok Rozdzialu

Pokazuje:

- liste scen;
- streszczenie rozdzialu;
- target word count;
- actual word count;
- status;
- przycisk generowania streszczenia;
- przycisk generowania kolejnej sceny.

## Widok Sceny

Pokazuje:

- tytul sceny;
- cel;
- konflikt;
- wynik;
- POV;
- lokacje;
- postacie;
- aktywne watki;
- edytor tekstu;
- panel AI.

## Popup AI Dla Zaznaczenia

Opcje:

- Kontynuuj;
- Rozwin;
- Skroc;
- Przepisz;
- Popraw dialog;
- Dodaj opis sensoryczny;
- Zwieksz napiecie;
- Dopasuj do stylu;
- Wlasna instrukcja.

## Word Target

Przy generowaniu sceny uzytkownik moze ustawic:

- 300 slow;
- 700 slow;
- 1200 slow;
- 2000 slow;
- custom.

Prompt powinien traktowac liczbe slow jako przyblizona, nie absolutna.

## Akcje AI

### Draft Scene

Generuje scene z planu.

Kontekst:

- cel sceny;
- konflikt;
- wynik;
- POV;
- postacie;
- lokacja;
- watki;
- wiedza postaci;
- reguly swiata;
- styl guide;
- target word count.

### Continue Scene

Kontynuuje tekst od kursora albo po zaznaczeniu.

Kontekst:

- ostatnie 1000-2000 slow;
- cel sceny;
- co ma sie wydarzyc dalej;
- czego nie wolno jeszcze ujawniac.

### Rewrite Selection

Przepisuje zaznaczony fragment.

Tryby:

- bardziej literacko;
- prosciej;
- bardziej dynamicznie;
- bardziej emocjonalnie;
- w glosie wybranej postaci;
- zgodnie z instrukcja uzytkownika.

## Warianty

Kazda odpowiedz AI moze byc zapisana jako wariant:

- `replace_selection`;
- `insert_after_selection`;
- `append_to_scene`;
- `save_as_variant`.

Wariant ma:

- tekst;
- prompt id;
- data;
- status.

## Acceptance Criteria

- Mozna pisac i zapisywac scene.
- Autosave nie traci danych po restarcie.
- Zaznaczenie tekstu pokazuje popup AI.
- AI moze wygenerowac scene z planu.
- AI moze przepisac zaznaczenie bez ruszania reszty tekstu.
- Wstawienie wyniku wymaga decyzji uzytkownika.

## Testy

- licznik slow aktualizuje sie po edycji;
- zaznaczony tekst trafia do promptu;
- brak zaznaczenia ukrywa akcje rewrite;
- draft scene zawiera Story Bible context;
- anulowanie generowania nie zmienia tekstu;
- zaakceptowanie rewrite zmienia tylko zaznaczenie.

