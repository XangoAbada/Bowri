# Model Danych

Model danych ma wspierac proces pisarski, promptowanie AI i kontrole ciaglosci. Dane sa lokalne, przechowywane w SQLite.

## Zasady Modelu

- Kanon jest jawny: kazdy fakt moze byc oznaczony jako potwierdzony, proponowany albo odrzucony.
- Tekst prozy i dane planistyczne sa powiazane, ale nie sa tym samym.
- Postacie maja wiedze zaleznia od czasu historii.
- AI generuje propozycje, a uzytkownik akceptuje zmiany.
- Kazda istotna zmiana powinna miec `source`: manual, ai, import, extraction.

## Encje Glowne

### Project

Reprezentuje pojedyncza ksiazke lub serie.

Pola:

- `id`;
- `name`;
- `language`;
- `createdAt`;
- `updatedAt`;
- `activeBookId`;
- `settingsJson`.

### Book

Pojedyncza ksiazka w projekcie.

Pola:

- `id`;
- `projectId`;
- `title`;
- `workingTitle`;
- `premise`;
- `logline`;
- `genre`;
- `subgenre`;
- `targetAudience`;
- `tone`;
- `styleGuide`;
- `pointOfView`;
- `targetWordCount`;
- `status`.

### StoryBible

Nie musi byc osobna tabela. To logiczny agregat danych:

- postacie;
- relacje;
- swiat;
- lokacje;
- reguly;
- watki;
- fakty;
- timeline;
- wiedza postaci.

## Postacie

### Character

Pola:

- `id`;
- `projectId`;
- `name`;
- `aliasesJson`;
- `role`;
- `shortDescription`;
- `externalGoal`;
- `internalNeed`;
- `wound`;
- `falseBelief`;
- `strengthsJson`;
- `weaknessesJson`;
- `secretsJson`;
- `voiceNotes`;
- `arcSummary`;
- `visualPrompt`;
- `status`.

Status:

- `draft`;
- `canon`;
- `retired`;

### CharacterRelation

Pola:

- `id`;
- `projectId`;
- `fromCharacterId`;
- `toCharacterId`;
- `relationType`;
- `description`;
- `conflict`;
- `trustLevel`;
- `startsAtSceneId`;
- `endsAtSceneId`;
- `status`.

Relacje sa kierunkowe. Jesli relacja jest wzajemna, mozna miec dwa rekordy.

## Swiat

### WorldElement

Pola:

- `id`;
- `projectId`;
- `type`;
- `name`;
- `summary`;
- `details`;
- `rulesJson`;
- `visualPrompt`;
- `status`.

Typy:

- `location`;
- `faction`;
- `object`;
- `culture`;
- `technology`;
- `magic`;
- `creature`;
- `event_history`;
- `custom`.

### WorldRule

Pola:

- `id`;
- `projectId`;
- `name`;
- `description`;
- `scope`;
- `cost`;
- `limitation`;
- `exceptions`;
- `sourceElementId`;
- `status`.

Reguly sa wazne dla kontroli ciaglosci. AI powinno je dostawac przy scenach, ktore moga ich dotyczyc.

## Fabula

### PlotThread

Pola:

- `id`;
- `projectId`;
- `name`;
- `type`;
- `dramaticQuestion`;
- `setup`;
- `development`;
- `payoff`;
- `status`;
- `importance`.

Typy:

- `main`;
- `subplot`;
- `romance`;
- `mystery`;
- `character_arc`;
- `world`;
- `theme`.

### Chapter

Pola:

- `id`;
- `bookId`;
- `orderIndex`;
- `title`;
- `summary`;
- `targetWordCount`;
- `actualWordCount`;
- `status`.

### Scene

Pola:

- `id`;
- `chapterId`;
- `orderIndex`;
- `title`;
- `summary`;
- `goal`;
- `conflict`;
- `outcome`;
- `povCharacterId`;
- `locationId`;
- `targetWordCount`;
- `actualWordCount`;
- `manuscriptContent`;
- `status`.

Status sceny:

- `planned`;
- `drafting`;
- `drafted`;
- `revising`;
- `done`.

## Fakty I Wiedza

### StoryFact

Pola:

- `id`;
- `projectId`;
- `factType`;
- `subjectType`;
- `subjectId`;
- `statement`;
- `truthStatus`;
- `firstAppearsInSceneId`;
- `source`;
- `confidence`;

`truthStatus`:

- `proposed`;
- `canon`;
- `contradicted`;
- `retconned`;
- `rejected`.

### CharacterKnowledge

Pola:

- `id`;
- `projectId`;
- `characterId`;
- `factId`;
- `knowledgeStatus`;
- `learnedInSceneId`;
- `evidenceText`;
- `notes`;

`knowledgeStatus`:

- `does_not_know`;
- `suspects`;
- `knows`;
- `misbelieves`;
- `forgotten`;

Ten model pozwala pytac: "Czy ta postac moze powiedziec to w tej scenie?".

## AI Runs

### AiRun

Pola:

- `id`;
- `projectId`;
- `providerId`;
- `action`;
- `promptPackageJson`;
- `rawOutput`;
- `parsedOutputJson`;
- `status`;
- `errorMessage`;
- `createdAt`;
- `completedAt`;

### AiProposal

Pola:

- `id`;
- `aiRunId`;
- `projectId`;
- `proposalType`;
- `payloadJson`;
- `status`;
- `appliedAt`;

Status:

- `pending`;
- `accepted`;
- `edited_and_accepted`;
- `rejected`;

## Assety

### VisualAsset

Pola:

- `id`;
- `projectId`;
- `relatedType`;
- `relatedId`;
- `assetType`;
- `title`;
- `prompt`;
- `negativePrompt`;
- `filePath`;
- `source`;
- `status`;

V1 moze zapisac prompt i metadane bez generowania obrazu API.

## Minimalne Migracje V1

W pierwszej implementacji wystarcza:

- `projects`;
- `books`;
- `characters`;
- `world_elements`;
- `plot_threads`;
- `chapters`;
- `scenes`;
- `story_facts`;
- `character_knowledge`;
- `ai_runs`;
- `ai_proposals`;

Relacje i assety mozna dodac w kolejnych migracjach, ale typy powinny byc przewidziane od poczatku.

