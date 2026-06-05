# Faza 9: Grafika I Ilustracje

Cel fazy: przygotowac modul assetow graficznych, ale w V1 bez bezposredniego API obrazow.

## Decyzja V1

V1 nie generuje obrazow automatycznie przez API. Aplikacja moze:

- tworzyc prompty obrazow;
- zapisywac prompty;
- przypisywac prompty do postaci, lokacji i scen;
- pozwalac uzytkownikowi dodac plik obrazu recznie.

API obrazow zostaje na pozniejszy etap.

## Typy Assetow

- portret postaci;
- lokacja;
- obiekt;
- mapa;
- scena;
- ilustracja do bajki;
- styl guide wizualny;
- okladka robocza.

## Dane Assetu

- tytul;
- typ;
- powiazana encja;
- prompt;
- negative prompt;
- styl;
- proporcje;
- plik lokalny;
- zrodlo;
- status.

## Akcje AI

Przez Codex CLI:

- wygeneruj prompt portretu;
- wygeneruj prompt mapy;
- wygeneruj prompt ilustracji sceny;
- utworz spójny styl obrazkow dla bajki;
- opisz wyglad postaci na podstawie profilu;
- dopasuj prompt do wieku odbiorcy.

## Prompt: Character Portrait Prompt

Output JSON:

```json
{
  "version": 1,
  "kind": "visual_prompt",
  "assetType": "character_portrait",
  "title": "",
  "prompt": "",
  "negativePrompt": "",
  "styleNotes": "",
  "composition": "",
  "warnings": []
}
```

## Bajki Dla Dzieci

Dla bajek modul powinien wspierac:

- styl ilustracji calej ksiazki;
- powtarzalny wyglad postaci;
- lista ilustracji na rozdzial;
- prompt kazdej ilustracji;
- kontrola, aby postacie wygladaly spójnie.

## Mapa Swiata

Dla mapy zapisac:

- typ mapy;
- lista lokacji;
- relacje przestrzenne;
- styl;
- prompt;
- notatki autora.

## Future API

Pozniejszy provider obrazow moze uzyc:

- OpenAI GPT Image przez API;
- recznego ChatGPT Images;
- innego generatora lokalnego lub zewnetrznego.

Interfejs powinien byc:

```ts
type ImageProvider = {
  id: string;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
};
```

Nie implementowac w V1.

## Acceptance Criteria

- Mozna zapisac prompt wizualny postaci.
- Mozna przypisac obraz lokalny do postaci lub lokacji.
- AI moze wygenerowac prompt obrazu przez Codex CLI.
- Asset nie wymaga API key.
- Prompty bajki moga korzystac ze wspolnego stylu.

## Testy

- zapis assetu bez pliku;
- zapis assetu z plikiem lokalnym;
- prompt portretu zawiera opis postaci;
- prompt mapy zawiera lokacje;
- brak API obrazow nie blokuje modulu.

