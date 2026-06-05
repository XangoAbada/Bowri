# Prompt Architecture

Prompt Architecture okresla, jak StoryForge2 komunikuje sie z Codex CLI Bridge. Celem jest powtarzalnosc, latwe parsowanie i dobre wykorzystanie kontekstu ksiazki.

## Zasada Glowna

Nie wysylac do AI calej bazy. Wysylac tylko kontekst potrzebny do danej akcji.

## PromptPackage

```ts
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
```

## PromptContext

```ts
type PromptContext = {
  book?: BookContext;
  styleGuide?: string;
  selectedText?: string;
  currentScene?: SceneContext;
  previousScene?: SceneContext;
  nextScene?: SceneContext;
  relevantCharacters?: CharacterContext[];
  relevantWorldElements?: WorldElementContext[];
  relevantRules?: WorldRuleContext[];
  relevantThreads?: PlotThreadContext[];
  knownFacts?: StoryFactContext[];
  characterKnowledge?: CharacterKnowledgeContext[];
  userNotes?: string;
};
```

## Kategorie Promptow

### Ideation

Uzywane do:

- tytulow;
- premisy;
- gatunku;
- tematow;
- stylu.

Wymaga:

- jasnej liczby wariantow;
- krotkiego uzasadnienia;
- mozliwosci wyboru przez uzytkownika.

### Structured Planning

Uzywane do:

- planu rozdzialow;
- watkow;
- profili postaci;
- elementow swiata.

Wymaga JSON.

### Drafting

Uzywane do:

- scen;
- rozdzialow;
- fragmentow prozy;
- dialogow.

Wymaga Markdown.

### Editing

Uzywane do:

- rewrite;
- expand;
- shorten;
- tone shift;
- line edit.

Wymaga zachowania intencji autora i pokazania ewentualnych uwag.

### Extraction

Uzywane do:

- wykrycia nowych faktow;
- aktualizacji Story Bible;
- wiedzy postaci;
- konfliktow ciaglosci.

Wymaga JSON z lista propozycji.

## Szablon Promptu

Kazdy prompt powinien miec ten porzadek:

```md
# Role
Jestes asystentem pisarskim pracujacym wewnatrz StoryForge2.

# Task
...

# Hard Rules
- Pisz po polsku, chyba ze projekt ma inny jezyk.
- Nie zmieniaj kanonu bez oznaczenia propozycji.
- Nie wprowadzaj nowych glownych faktow, jesli zadanie tego nie wymaga.
- Odpowiedz tylko w wymaganym formacie.

# Book Context
...

# Relevant Story Bible
...

# Current Work
...

# Output Contract
...
```

## Kontrakt JSON

Kazdy JSON powinien zawierac:

```json
{
  "version": 1,
  "kind": "specific_kind",
  "summary": "short summary",
  "items": [],
  "warnings": []
}
```

Zasady:

- `version` zawsze liczba;
- `kind` musi pasowac do akcji;
- `warnings` zawiera problemy, nie zwykle komentarze;
- nie uzywac trailing commas;
- nie dodawac tekstu poza JSON.

## Przyklad: Generate Titles

Oczekiwany JSON:

```json
{
  "version": 1,
  "kind": "title_suggestions",
  "summary": "20 propozycji tytulow dla mrocznej powiesci fantasy",
  "items": [
    {
      "title": "Tytul",
      "subtitle": "Opcjonalny podtytul",
      "rationale": "Dlaczego pasuje",
      "tone": "mroczny",
      "risk": "Czy brzmi zbyt generycznie"
    }
  ],
  "warnings": []
}
```

## Przyklad: Draft Scene

Oczekiwany Markdown:

```md
## Result

Tekst sceny.

## Notes

- Ujawnione fakty: ...
- Potencjalne aktualizacje Story Bible: ...
```

## Budowanie Kontekstu

### Dla tytulow

Wyslac:

- premise;
- gatunek;
- ton;
- odbiorcow;
- tematy;
- przyklady tytulow lub antyprzyklady od uzytkownika.

### Dla sceny

Wyslac:

- cel sceny;
- poprzednia scena;
- nastepna scena;
- POV;
- postacie obecne;
- wiedza postaci w tej chwili;
- lokacja;
- aktywne watki;
- reguly swiata dotyczace sceny;
- styl guide;
- target word count.

### Dla ekstrakcji

Wyslac:

- tekst sceny;
- istniejace postacie;
- istniejace fakty;
- istniejace reguly;
- prosbe o propozycje zmian, nie automatyczne nadpisanie.

## Walidacja Odpowiedzi

Po otrzymaniu wyniku:

1. Sprawdz, czy wynik nie jest pusty.
2. Jesli oczekiwano JSON, wyodrebnij JSON z fenced block albo calego tekstu.
3. Waliduj Zod.
4. Jesli walidacja nie przejdzie, pokaz blad i opcje naprawy formatowania.
5. Nie stosuj zmian bez akceptacji.

## Retry

Retry powinien zachowac:

- oryginalny prompt;
- blad parsera;
- surowa odpowiedz;
- prosbe o naprawe tylko formatu, nie tresci.

Prompt retry:

```md
Poprzednia odpowiedz nie pasowala do wymaganego formatu.
Nie zmieniaj merytorycznej tresci.
Zwroc poprawny JSON zgodny z kontraktem.
```

## Token Hygiene

Nie wysylac:

- calej historii projektu bez potrzeby;
- prywatnych notatek niezwiązanych z akcja;
- tokenow, sciezek auth, ustawien konta;
- logow technicznych.

Wysylac:

- streszczenia;
- tylko relewantne encje;
- ostatnie sceny;
- fakty potrzebne do spójnosci.

