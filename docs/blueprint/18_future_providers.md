# Future Providers

Ten dokument opisuje providery odlozone poza V1. V1 implementuje tylko `codex-cli-bridge`.

## Zasada

Wszystkie przyszle providery musza pasowac do tego samego interfejsu:

```ts
type AIProvider = {
  id: string;
  displayName: string;
  capabilities: AICapability[];
  checkStatus(): Promise<ProviderStatus>;
  generate(promptPackage: PromptPackage): Promise<AIResult>;
};
```

UI nie powinien wiedziec, czy wynik pochodzi z Codex CLI, recznego ChatGPT, OpenAI API czy Claude API.

## manual-chatgpt

Fallback, gdy Codex CLI nie dziala.

Przeplyw:

1. Aplikacja buduje prompt.
2. Uzytkownik kopiuje prompt do ChatGPT.
3. Uzytkownik wkleja wynik.
4. Aplikacja parsuje i pokazuje propozycje.

Zalety:

- brak API;
- dziala z ChatGPT web;
- malo ryzyk technicznych.

Wady:

- reczne kopiowanie;
- brak automatycznego streamingu;
- wiecej tarcia.

## openai-api

Provider dla oficjalnego OpenAI API.

Przeplyw:

- uzytkownik podaje API key;
- aplikacja uzywa Responses API;
- mozliwy streaming;
- mozliwe structured outputs;
- mozliwe narzedzia i image generation w przyszlosci.

Zalety:

- stabilny produkt developerski;
- przewidywalny kontrakt;
- latwiejsze parsowanie;
- mozliwosc image API.

Wady:

- osobne rozliczanie od ChatGPT;
- wymaga klucza i kontroli kosztow.

## anthropic-api

Provider dla Claude API.

Przeplyw:

- uzytkownik podaje klucz Anthropic;
- aplikacja mapuje `PromptPackage` do formatu Claude;
- wynik wraca jako `AIResult`.

Zalety:

- alternatywny model do prozy;
- potencjalnie lepsze style lub dlugie konteksty w niektorych zadaniach.

Wady:

- osobne koszty;
- osobna konfiguracja;
- inne limity i formaty.

## Provider Selection

Pozniej ustawienia moga miec:

- provider domyslny;
- fallback provider;
- per-akcja provider;
- test providera;
- limity kosztow dla API.

V1 nie implementuje tego UI poza statusem Codex CLI.

## Image Providers

Pozniejszy interfejs:

```ts
type ImageProvider = {
  id: string;
  displayName: string;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
};
```

Mozliwe implementacje:

- OpenAI GPT Image API;
- reczny ChatGPT Images;
- lokalny generator;
- inny provider.

## Migration Z V1

Poniewaz V1 ma wspolny `AIProvider`, dodanie API pozniej powinno wymagac:

- nowej implementacji providera;
- ustawien klucza;
- mapowania output contracts;
- testow;
- bez przepisywania ekranow.

## Czego Nie Robic

- Nie uzywac prywatnych endpointow ChatGPT jako providera.
- Nie przechwytywac tokenow sesji z przegladarki.
- Nie udawac oficjalnego klienta.
- Nie mieszac tokenow Codex CLI z baza StoryForge2.

