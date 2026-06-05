# Faza 8: Ekstrakcja Dynamiczna

Cel fazy: podczas pisania wykrywac nowe elementy historii i proponowac aktualizacje Story Bible.

## Problem

Autor w trakcie pisania czesto tworzy rzeczy spontanicznie:

- nowa postac pojawia sie w dialogu;
- lokacja dostaje nazwe;
- bohater ujawnia sekret;
- regula swiata zostaje doprecyzowana;
- relacja zmienia sie po konflikcie.

Jesli aplikacja tego nie wychwyci, Story Bible przestanie byc aktualne.

## Rozwiazanie

Po zapisaniu sceny albo na zadanie autora:

1. Aplikacja wysyla scene do AI.
2. AI zwraca propozycje ekstrakcji.
3. Autor zatwierdza pojedyncze zmiany.
4. Story Bible aktualizuje sie.

## Typy Ekstrakcji

- nowa postac;
- aktualizacja postaci;
- nowa relacja;
- zmiana relacji;
- nowy element swiata;
- nowa regula;
- nowy fakt;
- wiedza postaci;
- zdarzenie timeline;
- aktualizacja watku.

## Panel Ekstrakcji

Dla kazdej propozycji pokaz:

- typ;
- opis;
- evidence text;
- sugerowane miejsce zapisu;
- potencjalne duplikaty;
- przyciski: Akceptuj, Edytuj, Odrzuc.

## Duplikaty

Przed pokazaniem propozycji aplikacja powinna porownac:

- nazwy postaci;
- aliasy;
- podobne fakty;
- istniejace lokacje;
- istniejace reguly.

Nie usuwac automatycznie. Pokazac "mozliwy duplikat".

## Prompt: Dynamic Extraction

Output JSON:

```json
{
  "version": 1,
  "kind": "dynamic_extraction",
  "proposals": [
    {
      "type": "new_character",
      "title": "",
      "payload": {},
      "evidenceText": "",
      "confidence": 0.8,
      "possibleDuplicates": []
    }
  ],
  "continuityWarnings": [],
  "questionsForAuthor": []
}
```

## Workflow

1. Autor konczy scene.
2. Aplikacja pokazuje subtelna akcje "Zaktualizuj Story Bible".
3. Codex wykonuje ekstrakcje.
4. Uzytkownik przeglada propozycje.
5. Akceptowane propozycje sa zapisywane transakcyjnie.

## Acceptance Criteria

- Ekstrakcja nie uruchamia sie automatycznie w sposob rozpraszajacy.
- Propozycje sa rozdzielone na pojedyncze decyzje.
- Mozna edytowac propozycje przed akceptacja.
- Duplikaty sa oznaczone.
- Odrzucone propozycje nie wracaja natychmiast bez zmiany tekstu.

## Testy

- scena z nowa postacia tworzy propozycje `new_character`;
- scena z istniejaca postacia nie tworzy duplikatu bez ostrzezenia;
- fakt moze zostac przypisany do wiedzy jednej postaci;
- odrzucenie propozycji jest zapisane;
- akceptacja wielu propozycji jest transakcja.

