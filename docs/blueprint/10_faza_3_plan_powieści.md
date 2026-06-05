# Faza 3: Plan Powiesci

Cel fazy: stworzyc plan fabuly od wysokiego poziomu do rozdzialow i scen.

## Ekrany

- Struktura fabuly;
- Akty;
- Punkty zwrotne;
- Watki;
- Rozdzialy;
- Sceny.

## Struktury Fabularne

V1 wspiera wybor:

- Trzy akty;
- Save the Cat;
- Hero's Journey;
- Mystery outline;
- Custom.

Wybor struktury jest pomoca, nie blokada.

## Dane

### StoryStructure

- typ struktury;
- opis;
- akty;
- beaty;
- notatki.

### Beat

- nazwa;
- opis;
- rola;
- orderIndex;
- powiazane watki;
- powiazane rozdzialy.

## Akcje AI

- zaproponuj strukture;
- rozbij premise na trzy akty;
- wygeneruj beat sheet;
- wygeneruj plan rozdzialow;
- znajdz brakujace napiecie;
- znajdz rozdzialy bez celu;
- zaproponuj alternatywny midpoint;
- zaproponuj mocniejszy final.

## Plan Rozdzialow

Kazdy rozdzial:

- numer;
- tytul roboczy;
- streszczenie;
- cel fabularny;
- konflikt;
- punkt zwrotny;
- postacie;
- lokacje;
- watki;
- target word count.

## Plan Scen

Kazda scena:

- numer w rozdziale;
- tytul roboczy;
- POV;
- cel sceny;
- konflikt;
- wynik;
- ujawnione fakty;
- zmiana relacji;
- cliffhanger albo przejscie.

## Prompt: Generate Plot Outline

Output JSON:

```json
{
  "version": 1,
  "kind": "plot_outline",
  "summary": "",
  "structure": "three_act",
  "acts": [
    {
      "name": "",
      "purpose": "",
      "beats": []
    }
  ],
  "chapters": [
    {
      "orderIndex": 1,
      "title": "",
      "summary": "",
      "purpose": "",
      "conflict": "",
      "threads": [],
      "characters": [],
      "targetWordCount": 3000
    }
  ],
  "warnings": []
}
```

## Workflow

1. Autor wybiera strukture albo prosi AI o wybor.
2. AI generuje outline.
3. Autor akceptuje akty i rozdzialy.
4. Aplikacja tworzy encje `Chapter`.
5. Pozniej autor moze rozbijac rozdzialy na sceny.

## Kontrola Jakosci

Aplikacja powinna oznaczac:

- rozdzial bez konfliktu;
- za duzo rozdzialow ekspozycji pod rzad;
- watek bez payoffu;
- final bez przygotowania;
- postac glowna znikajaca na dlugo bez intencji.

## Acceptance Criteria

- Mozna wygenerowac i zapisac outline.
- Rozdzialy tworza sie jako oddzielne encje.
- Rozdzial ma powiazania z watkami i postaciami.
- AI moze wygenerowac alternatywny plan bez kasowania obecnego.
- Uzytkownik moze oznaczyc wybrany plan jako aktywny.

## Testy

- import JSON outline;
- tworzenie rozdzialow z orderIndex;
- przesuwanie rozdzialow;
- walidacja pustego konfliktu;
- prompt outline zawiera premise, gatunek, odbiorcow i styl.

