# Faza 2: Koncepcja Ksiazki

Cel fazy: pomoc autorowi zamienic pomysl w spójny fundament ksiazki.

## Ekran Koncepcji

Sekcje:

- Tytul;
- Premisa;
- Logline;
- Gatunek i podgatunek;
- Odbiorcy;
- Ton;
- Styl;
- Punkt widzenia;
- Dlugosc docelowa;
- Tematy;
- Granice i tematy niechciane.

Kazda sekcja ma akcje AI.

## Pola

### Tytul

- roboczy tytul;
- lista alternatyw;
- notatka, dlaczego wybrany.

Akcje AI:

- generuj tytuly;
- ocen tytuly;
- zaproponuj podtytul.

### Premisa

- jedno zdanie;
- rozszerzona premisa;
- konflikt centralny.

Akcje AI:

- rozwin premise;
- zaproponuj 5 wariantow;
- znajdz mocniejszy konflikt.

### Gatunek

- gatunek glowny;
- podgatunek;
- obietnica gatunkowa;
- oczekiwania czytelnika.

Akcje AI:

- dopasuj gatunek;
- wypisz konwencje gatunku;
- wskaz, ktore konwencje mozna zlamac.

### Odbiorcy

- wiek;
- poziom trudnosci;
- preferencje;
- rzeczy, ktorych unikac.

Akcje AI:

- opis czytelnika idealnego;
- dostosuj ton do odbiorcy;
- sprawdz, czy pomysl pasuje do odbiorcow.

### Styl

- narracja;
- tempo;
- poziom opisow;
- dialog;
- humor;
- mrok;
- przykladowy fragment stylu.

Akcje AI:

- wygeneruj style guide;
- napisz sample 300 slow;
- porownaj 3 style.

## Prompt: Rozwin Premise

Output JSON:

```json
{
  "version": 1,
  "kind": "premise_development",
  "summary": "",
  "logline": "",
  "expandedPremise": "",
  "centralConflict": "",
  "stakes": "",
  "themes": [],
  "risks": [],
  "questionsForAuthor": []
}
```

## Workflow

1. Autor wpisuje surowy pomysl.
2. Kliknie "Rozwin z AI".
3. Codex generuje propozycje.
4. Autor akceptuje fragmenty, nie musi akceptowac calosci.
5. Aplikacja zapisuje zaakceptowane pola.
6. Style guide staje sie dostepny dla pozniejszych promptow.

## Acceptance Criteria

- Mozna wypelnic i zapisac wszystkie pola koncepcji.
- AI moze generowac tytuly, premise i style guide.
- Wyniki strukturalne importuja sie polami, nie jako jeden blob.
- Uzytkownik moze zaakceptowac tylko czesc propozycji.
- Style guide jest uzywany w pozniejszym promptcie sceny.

## Testy

- walidacja pustej i dlugiej premisy;
- import `premise_development`;
- zapis alternatywnych tytulow;
- prompt zawiera ton, gatunek i odbiorcow;
- brak Codex CLI blokuje przycisk AI i pokazuje konfiguracje.

