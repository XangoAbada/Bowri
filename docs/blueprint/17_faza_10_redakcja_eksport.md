# Faza 10: Redakcja I Eksport

Cel fazy: pomoc autorowi przejsc od surowej wersji do tekstu gotowego do dalszej obrobki.

## Etapy Redakcji

1. Redakcja strukturalna.
2. Redakcja watkow.
3. Redakcja ciaglosci.
4. Redakcja scen.
5. Line edit.
6. Korekta.
7. Eksport.

## Redakcja Strukturalna

AI analizuje:

- czy poczatek obiecuje wlasciwa historie;
- czy midpoint zmienia kierunek;
- czy final domyka watki;
- czy tempo nie siada;
- czy postacie maja luki przemiany.

Output:

- lista problemow;
- severity;
- sugestia naprawy;
- dotkniete rozdzialy.

## Redakcja Watkow

AI analizuje:

- porzucone watki;
- setup bez payoffu;
- payoff bez setupu;
- zbyt pozne wprowadzenie informacji;
- watki poboczne konkurujace z glownym.

## Redakcja Ciaglosci

AI analizuje:

- wiedze postaci;
- timeline;
- reguly swiata;
- nazwy;
- wiek i czas;
- lokalizacje;
- sprzeczne fakty.

## Line Edit

AI moze:

- poprawic rytm zdania;
- usunac powtorzenia;
- wzmocnic czasowniki;
- poprawic dialog;
- zmniejszyc ekspozycje;
- zachowac glos autora.

Line edit powinien dzialac na wybranych fragmentach, nie od razu na calej ksiazce.

## Korekta

AI moze wskazac:

- literowki;
- gramatyke;
- interpunkcje;
- powtorzenia;
- niejasne zaimki.

Nie traktowac AI jako jedynej korekty finalnej.

## Eksport

V1 eksport:

- Markdown;
- plain text.

Pozniej:

- DOCX;
- EPUB;
- PDF roboczy.

Eksport powinien pozwolic wybrac:

- cala ksiazka;
- wybrane rozdzialy;
- sceny z notatkami lub bez;
- tylko manuskrypt;
- manuskrypt + streszczenia.

## Prompt: Chapter Review

Output JSON:

```json
{
  "version": 1,
  "kind": "chapter_review",
  "summary": "",
  "issues": [
    {
      "severity": "medium",
      "category": "pacing",
      "description": "",
      "evidenceText": "",
      "suggestedFix": ""
    }
  ],
  "strengths": [],
  "nextActions": []
}
```

## Acceptance Criteria

- Mozna wygenerowac raport rozdzialu.
- Raport nie zmienia tekstu automatycznie.
- Mozna wykonac line edit zaznaczenia.
- Eksport Markdown zawiera rozdzialy w kolejnosci.
- Eksport plain text nie zawiera danych Story Bible.

## Testy

- eksport pustej ksiazki pokazuje jasny komunikat;
- eksport rozdzialow zachowuje kolejnosc;
- line edit zaznaczenia nie zmienia reszty sceny;
- raport ciaglosci linkuje do scen;
- odrzucenie sugestii redakcyjnej nie zmienia tekstu.

