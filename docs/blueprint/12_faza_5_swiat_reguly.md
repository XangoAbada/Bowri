# Faza 5: Swiat I Reguly

Cel fazy: stworzyc swiat, ktory wspiera fabule i ma konsekwentne reguly.

## Ekrany

- Elementy swiata;
- Lokacje;
- Frakcje;
- Historia swiata;
- Reguly;
- Mapa relacji miejsc;
- Prompty wizualne.

## Typy Elementow

- lokacja;
- frakcja;
- przedmiot;
- kultura;
- technologia;
- magia;
- istota;
- wydarzenie historyczne;
- instytucja;
- zwyczaj;
- inne.

## Profil Elementu Swiata

Pola:

- nazwa;
- typ;
- krotki opis;
- szczegoly;
- znaczenie fabularne;
- powiazane postacie;
- powiazane watki;
- reguly;
- ograniczenia;
- prompt wizualny.

## Reguly Swiata

Regula powinna miec:

- nazwe;
- opis;
- zakres;
- koszt;
- ograniczenie;
- wyjatki;
- konsekwencje naruszenia;
- przyklady scen, ktorych dotyczy.

Przyklady:

- magia wymaga zaplaty pamiecia;
- miasto zamyka bramy po zmroku;
- frakcja nie przyjmuje ludzi bez znaku;
- technologia dziala tylko w poblizu rdzeni.

## Akcje AI

- generuj lokacje;
- generuj frakcje;
- rozwin regule;
- sprawdz konsekwencje reguly;
- wykryj konflikt reguly z planem;
- zaproponuj miejsce dla sceny;
- wygeneruj prompt mapy;
- wygeneruj prompt ilustracji lokacji.

## Prompt: Generate World Element

Output JSON:

```json
{
  "version": 1,
  "kind": "world_element",
  "type": "location",
  "name": "",
  "summary": "",
  "details": "",
  "storyPurpose": "",
  "rules": [],
  "relatedCharacters": [],
  "relatedThreads": [],
  "visualPrompt": "",
  "warnings": []
}
```

## Prompt: Check World Rule

Output JSON:

```json
{
  "version": 1,
  "kind": "world_rule_analysis",
  "ruleName": "",
  "consequences": [],
  "possibleContradictions": [],
  "storyOpportunities": [],
  "questionsForAuthor": [],
  "warnings": []
}
```

## Workflow

1. Autor tworzy element swiata.
2. AI moze go rozwinac.
3. Reguly zostaja zapisane oddzielnie.
4. Sceny moga wskazywac lokacje i aktywne reguly.
5. Kontrola ciaglosci sprawdza, czy scena nie narusza reguly.

## Acceptance Criteria

- Mozna utworzyc lokacje i regule.
- AI moze rozwinac element swiata.
- Regula moze byc powiazana ze scena.
- Prompt sceny zawiera tylko reguly istotne dla sceny.
- Kontrola ciaglosci moze wskazac potencjalne naruszenie reguly.

## Testy

- import elementu swiata;
- powiazanie lokacji ze scena;
- powiazanie reguly z elementem swiata;
- prompt sceny z lokacja zawiera jej opis i reguly;
- analiza reguly zwraca ostrzezenia bez automatycznego zmieniania kanonu.

