# Wizja Produktu

StoryForge2 to lokalna aplikacja desktopowa do planowania, pisania, rozwijania i redagowania ksiazek z pomoca AI. Ma wspierac autora od pierwszego pomyslu az po kompletne rozdzialy, bez zamieniania procesu pisania w chaotyczne rozmowy z chatbotem.

## Problem

Pisanie ksiazki z AI latwo rozpada sie na osobne czaty:

- w jednym powstaje tytul;
- w drugim opis postaci;
- w trzecim rozdzial;
- w czwartym poprawki;
- po kilku dniach AI zapomina, co jest kanonem.

StoryForge2 ma rozwiazac ten problem przez utrzymywanie spójnego Story Bible: danych o ksiazce, postaciach, swiecie, watkach, rozdzialach i wiedzy postaci. AI ma generowac tekst na podstawie tego, co aplikacja juz wie.

## Uzytkownik

Docelowy uzytkownik V1:

- pisze dla siebie, rodziny lub z mysla o przyszlej publikacji;
- chce korzystac z subskrypcji ChatGPT/Codex bez dodatkowego API na start;
- nie chce zarzadzac serwerem;
- potrzebuje prywatnej lokalnej bazy;
- akceptuje, ze AI proponuje tekst, ale decyzje kanoniczne podejmuje czlowiek.

## Obietnica Aplikacji

StoryForge2 nie pisze ksiazki za autora. StoryForge2 pomaga autorowi utrzymac strukture, pamiec i tempo pracy.

Najwazniejsze wartosci:

- spojnosc fabuly;
- kontrola autora;
- szybkie generowanie wariantow;
- latwy powrot do kontekstu;
- brak recznego kopiowania w V1 dzieki Codex CLI Bridge;
- lokalna prywatnosc danych projektu.

## Zasady Produktowe

- AI jest wszedzie tam, gdzie autor moze utknac.
- AI nigdy nie zapisuje kanonu bez potwierdzenia.
- Kazdy ekran ma przycisk generowania lub ulepszania tresci.
- Dane planistyczne i tekst rozdzialow sa powiazane.
- Edytor jest centrum pracy, ale nie jedynym miejscem tworzenia.
- Postacie wiedza tylko to, czego dowiedzialy sie w konkretnym momencie historii.
- Swiat ma reguly, a naruszenia reguly musza byc oznaczane jako blad ciaglosci albo celowy wyjatek.

## Glowne Moduly

- Dashboard projektow.
- Koncepcja ksiazki.
- Story Bible.
- Plan powiesci.
- Postacie i relacje.
- Swiat, lokacje i reguly.
- Watki i timeline.
- Edytor scen i rozdzialow.
- Ekstrakcja faktow z tekstu.
- Redakcja i eksport.
- Ilustracje i assety graficzne jako pozniejszy modul.

## Sukces V1

V1 jest sukcesem, jesli autor moze napisac pierwsze 3-5 rozdzialow jednej ksiazki, a aplikacja:

- pamieta zalozenia ksiazki;
- podaje AI odpowiedni kontekst;
- pozwala generowac i poprawiac tekst bez kopiowania recznego;
- utrzymuje liste postaci i faktow;
- ostrzega przed podstawowymi problemami ciaglosci;
- dziala lokalnie i stabilnie.

## Ton UX

Interfejs powinien byc cichy, skupiony i edytorski. To nie jest SaaS marketingowy ani dashboard sprzedazowy. Inspiracja: narzedzia dla pisarzy, edytory tekstu, notatniki badawcze, profesjonalne studio narracyjne.

Unikac:

- hero page;
- dekoracyjnych gradientow;
- przesadnie duzych kart;
- pustych sloganow;
- tekstow tlumaczacych oczywiste funkcje w UI.

Preferowac:

- gesty i ikony;
- panele kontekstu;
- szybkie akcje;
- wersjonowanie propozycji;
- jasne statusy AI;
- ergonomie dlugiej pracy.

