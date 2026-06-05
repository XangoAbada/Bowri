# Faza 6: Watki, Ciaglosc I Wiedza

Cel fazy: utrzymac spojnosc historii w czasie.

## Ekrany

- Watki;
- Timeline;
- Fakty kanoniczne;
- Wiedza postaci;
- Raport ciaglosci;
- Propozycje aktualizacji Story Bible.

## Watki

Kazdy watek:

- nazwa;
- typ;
- pytanie dramatyczne;
- setup;
- rozwoj;
- payoff;
- status;
- powiazane sceny;
- powiazane postacie.

Status:

- planowany;
- aktywny;
- zawieszony;
- zamkniety;
- porzucony;
- do poprawy.

## Timeline

Timeline opisuje kolejnosc zdarzen w historii, nie kolejnosc rozdzialow.

Zdarzenie:

- nazwa;
- opis;
- data/czas wzgledny;
- scena;
- postacie obecne;
- fakty ujawnione;
- konsekwencje.

## Fakty

Fakt:

- stwierdzenie;
- status prawdy;
- gdzie pojawia sie pierwszy raz;
- kogo dotyczy;
- kto go zna;
- czy jest tajemnica.

## Wiedza Postaci

Wiedza postaci jest filtrem dla promptow scen.

Przy generowaniu dialogu AI powinno wiedziec:

- co postac wie;
- czego nie wie;
- co podejrzewa;
- w czym sie myli;
- czego nie moze jeszcze powiedziec.

## Akcje AI

- wykryj porzucone watki;
- sprawdz scene pod katem wiedzy postaci;
- zaproponuj payoff watku;
- wyodrebnij fakty ze sceny;
- sprawdz sprzecznosci;
- zaktualizuj timeline jako propozycje;
- znajdz postacie, ktore wiedza za duzo.

## Prompt: Extract Story Facts

Output JSON:

```json
{
  "version": 1,
  "kind": "story_fact_extraction",
  "newFacts": [
    {
      "statement": "",
      "factType": "",
      "subjectName": "",
      "truthStatus": "proposed",
      "evidenceText": ""
    }
  ],
  "knowledgeUpdates": [
    {
      "characterName": "",
      "factStatement": "",
      "knowledgeStatus": "knows",
      "evidenceText": ""
    }
  ],
  "continuityWarnings": [],
  "newEntities": []
}
```

## Prompt: Review Continuity

Output JSON:

```json
{
  "version": 1,
  "kind": "continuity_review",
  "issues": [
    {
      "severity": "warning",
      "type": "character_knowledge",
      "description": "",
      "evidenceText": "",
      "suggestedFix": ""
    }
  ],
  "passedChecks": [],
  "questionsForAuthor": []
}
```

## Workflow Po Napisaniu Sceny

1. Autor konczy scene.
2. Aplikacja proponuje "Wyodrebnij fakty".
3. Codex analizuje scene.
4. Panel pokazuje nowe fakty, zmiany wiedzy i ostrzezenia.
5. Autor akceptuje lub odrzuca kazda propozycje.
6. Story Bible aktualizuje sie dopiero po akceptacji.

## Acceptance Criteria

- Mozna zapisac fakt kanoniczny.
- Mozna przypisac fakt jako znany wybranej postaci.
- Ekstrakcja sceny tworzy propozycje, nie automatyczny zapis.
- Raport ciaglosci wykrywa przynajmniej konflikt wiedzy postaci.
- Prompt sceny filtruje wiedze wedlug miejsca w timeline.

## Testy

- fakt znany jednej postaci nie jest wysylany jako wiedza innej;
- scena przed ujawnieniem faktu nie zawiera go w wiedzy postaci;
- import ekstrakcji nie tworzy duplikatow oczywistych faktow;
- odrzucenie propozycji nie zmienia kanonu;
- raport ciaglosci pokazuje severity.

