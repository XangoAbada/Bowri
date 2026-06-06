# Faza 4: Postacie I Relacje

Cel fazy: stworzyc postacie, ktore maja motywacje, konflikty, glos i relacje wplywajace na fabule.

## Ekrany

- Lista postaci;
- Profil postaci;
- Relacje;
- Luki przemiany;
- Glos postaci;
- Wiedza postaci.

## Profil Postaci

Pola:

- imie;
- aliasy;
- rola;
- krotki opis;
- cel zewnetrzny;
- potrzeba wewnetrzna;
- rana;
- falszywe przekonanie;
- sekret;
- sila;
- slabosc;
- sposob mowienia;
- relacja do watku glownego;
- luk przemiany;
- prompt wizualny.

## Akcje AI

- generuj postac z roli fabularnej;
- poglob motywacje;
- zaproponuj sekret;
- zaproponuj luk przemiany;
- wygeneruj glos dialogowy;
- znajdz konflikt z inna postacia;
- sprawdz, czy postac jest potrzebna fabule;
- polacz postac z watkiem.

Każde generowane albo uzupełniane pole profilu postaci powinno mieć przycisk
AI lub mini akcję AI. Prompt dla pola postaci musi uwzględniać kluczowe pola
książki, rolę fabularną, istniejące postacie, relacje, wątki i style guide,
gdy są dostępne. Wyniki po polsku mają zachowywać poprawne polskie znaki.

## Relacje

Relacja powinna miec:

- strona A;
- strona B;
- typ;
- historia relacji;
- konflikt;
- poziom zaufania;
- sekret;
- zmiana w czasie;
- sceny kluczowe.

Typy:

- rodzina;
- przyjazn;
- romans;
- rywalizacja;
- mentor;
- wrog;
- sojusz;
- zaleznosc;
- tajemnica.

## Wiedza Postaci

Kazda postac ma zakres wiedzy:

- co wie na poczatku;
- czego sie dowiaduje;
- kiedy sie dowiaduje;
- czego sie domysla;
- w czym sie myli.

To jest krytyczne dla scen dialogowych i tajemnic.

## Prompt: Generate Character

Output JSON:

```json
{
  "version": 1,
  "kind": "character_profile",
  "name": "",
  "role": "",
  "shortDescription": "",
  "externalGoal": "",
  "internalNeed": "",
  "wound": "",
  "falseBelief": "",
  "strengths": [],
  "weaknesses": [],
  "secrets": [],
  "voiceNotes": "",
  "arcSummary": "",
  "suggestedThreads": [],
  "visualPrompt": "",
  "warnings": []
}
```

## Prompt: Relationship Conflict

Output JSON:

```json
{
  "version": 1,
  "kind": "relationship_development",
  "relations": [
    {
      "from": "",
      "to": "",
      "type": "",
      "conflict": "",
      "trustLevel": 50,
      "arc": "",
      "keyScenes": []
    }
  ],
  "warnings": []
}
```

## Workflow

1. Autor tworzy postac recznie albo przez AI.
2. Profil trafia do propozycji.
3. Autor akceptuje calosc lub wybrane pola.
4. Postac jest dostepna w planie i edytorze.
5. Relacje moga byc generowane na podstawie listy postaci.
6. Wiedza postaci aktualizuje sie podczas ekstrakcji scen.

## Acceptance Criteria

- Mozna utworzyc postac recznie.
- Mozna wygenerowac postac przez Codex CLI.
- Profil postaci moze byc czesciowo zaakceptowany.
- Generowanie pól profilu postaci działa per-field i używa kluczowego
  kontekstu książki oraz Story Bible.
- Wyniki AI po polsku używają poprawnych polskich znaków.
- Relacje lacza dwie postacie.
- Postac moze byc przypisana do sceny.
- Prompt sceny zawiera glos i wiedze postaci POV.

## Testy

- walidacja profilu postaci;
- import JSON postaci;
- relacja nie moze wskazywac nieistniejacej postaci;
- usuniecie postaci nie kasuje historii scen bez ostrzezenia;
- prompt sceny zawiera tylko relewantne postacie.
- prompt per-field postaci zawiera kluczowe pola książki, relacje i wątki.
