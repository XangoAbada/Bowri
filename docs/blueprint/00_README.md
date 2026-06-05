# StoryForge2 Blueprint

Ten katalog jest planem budowy aplikacji StoryForge2: prywatnego narzedzia desktopowego do pisania ksiazek z pomoca AI. Plan jest pisany tak, aby kolejne etapy mogly byc wdrazane przez AI, a uzytkownik mogl pelnic role drogowskazu, testera i osoby podejmujacej decyzje tworcze.

## Najwazniejsza decyzja V1

V1 uzywa `codex-cli-bridge` jako glownego providera AI.

Oznacza to:

- aplikacja nie wymaga klucza OpenAI API;
- aplikacja nie automatyzuje ChatGPT w przegladarce;
- aplikacja nie korzysta z prywatnych endpointow ChatGPT;
- uzytkownik loguje sie raz w oficjalnym Codex CLI kontem ChatGPT;
- StoryForge2 wywoluje lokalnie `codex exec`, przekazuje prompt i kontekst, a wynik importuje do aplikacji po akceptacji uzytkownika.

Fallback `manual-chatgpt` oraz providery API, takie jak OpenAI Responses API i Anthropic Claude API, sa opisane jako przyszle rozszerzenia, ale nie naleza do pierwszej wersji.

## Kolejnosc czytania

1. `01_wizja_produktu.md` - po co istnieje aplikacja i jak ma sie czuc podczas pracy.
2. `02_proces_pisarski.md` - jak aplikacja prowadzi autora przez proces pisania.
3. `03_stack_techniczny.md` - wybrany stack i decyzje techniczne.
4. `04_ai_provider_codex_cli_bridge.md` - najwazniejszy dokument dla integracji AI w V1.
5. `05_model_danych.md` i `06_prompt_architecture.md` - dane oraz kontrakty promptow.
6. `07_ux_i_nawigacja.md` - ekrany i interakcje.
7. Pliki `08_...` do `17_...` - kolejne fazy implementacji.
8. `18_future_providers.md` - odlozone integracje.
9. `19_testy_acceptance.md` - testy i definicje gotowosci.
10. `20_prompty_dla_ai_implementera.md` - gotowe prompty do zlecania pracy AI.

## Zasady dla AI-implementera

- Implementuj etapami, dokladnie wedlug faz.
- Najpierw zrob mala, dzialajaca wersje przeplywu, potem rozszerzaj szczegoly.
- Nie dodawaj automatyzacji ChatGPT web, tokenow sesji, reverse engineeringu ani nieoficjalnych endpointow.
- Nie zapisuj tokenow ChatGPT, OAuth ani kluczy Codex w bazie StoryForge2.
- Kazda akcja AI ma dzialac przez wspolny `AIProvider`, nawet jesli w V1 istnieje tylko `codex-cli-bridge`.
- Kazda odpowiedz AI zmieniajaca dane projektu ma przejsc przez ekran podgladu i akceptacji.
- Nie nadpisuj kanonu ksiazki automatycznie. Najpierw proponuj zmiany.
- W kazdej fazie utrzymuj aplikacje w stanie uruchamialnym.

## Definicja V1

V1 jest gotowa, kiedy autor moze:

- utworzyc projekt ksiazki;
- opisac tytul, premise, gatunek, styl i odbiorcow;
- wygenerowac propozycje przez Codex CLI bez kopiowania recznego;
- zaakceptowac wynik i zapisac go lokalnie;
- zbudowac podstawowe postacie, elementy swiata i plan rozdzialow;
- napisac scene lub rozdzial w edytorze;
- zaznaczyc fragment tekstu i poprosic AI o kontynuacje, rozwiniecie albo przeredagowanie;
- zapisac wynik i wrocic do niego po ponownym uruchomieniu aplikacji.

## Granice V1

Nie implementowac w V1:

- platnosci, kont uzytkownikow ani chmury;
- wspolpracy wielu autorow;
- automatycznego OpenAI API ani Anthropic API;
- generowania obrazow przez API;
- EPUB/DOCX jako pierwszego wymaganego eksportu, chyba ze faza redakcji jest juz ukonczona;
- automatycznej publikacji ksiazki.

## Glowny przeplyw AI

Kazdy przycisk AI powinien wykonywac ten sam schemat:

1. Pobierz aktualny kontekst projektu.
2. Zbuduj `PromptPackage`.
3. Uruchom `AIProvider.generate()`.
4. Pokaz wynik w panelu propozycji.
5. Pozwol uzytkownikowi zaakceptowac, poprawic, ponowic albo odrzucic.
6. Zapisz zaakceptowane zmiany wraz z informacja, skad pochodza.

## Styl aplikacji

StoryForge2 ma byc narzedziem pracy pisarza: spokojne, skupione, szybkie, z duza iloscia kontekstu pod reka. Nie robic landing page. Pierwszy ekran po uruchomieniu to lista projektow lub ostatni projekt.

