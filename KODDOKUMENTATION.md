# Koddokumentation för VävR

**Typ:** Statisk webbapplikation i HTML, CSS och JavaScript

**Drift:** GitHub Pages

**Publik adress:** [hktcr.github.io/vavr](https://hktcr.github.io/vavr/)

## Syfte

VävR är ett fokuserat skrivverktyg som gör dokumentets struktur och lexikala
återkoppling synlig. Varje committat block blir en nod. Rubriker skapar
hierarki, stycken analyseras med TF/IDF och cosinuslikhet, och dokumentordningen
visas som en separat narrativ tråd.

Analysen mäter återanvändning av centrala ord. Den mäter inte full semantisk
betydelse, argumentativ kvalitet eller om textens innehåll är korrekt.

## Filer

| Fil | Roll |
|---|---|
| `index.html` | Hela applikationens gränssnitt, dokumenttillstånd, analys, fysik, canvasritning, ljudrum, timer, mål och PWA-flöden |
| `manifest.webmanifest` | Appidentitet, färger, startadress och installationsikoner |
| `sw.js` | Versionsstyrd appskal-cache, offlinefallback och användarstyrd uppdatering |
| `icons/` | Vanlig, maskable och Apple-anpassad VävR-ikon |
| `vavr-dokument.js` | Fristående äldre dokumentmodul som fortfarande täcks av testsviten |
| `vavr-kohesion.js` | Fristående tokenisering och kohesionsanalys |
| `vavr-textcontext.js` | Fristående textstatistik för äldre motorintegrationer |
| `vavr-test.mjs` | 87 tester av dokumentmodell, tokenisering och kohesion |
| `vavr-audio-test.mjs` | Web Audio-mock som startar, påverkar och stänger alla fyra ljudteman |

Applikationen har inga externa körtidsberoenden och inget byggsteg.

## Kanonisk dokumentmodell

Blocklistan är den enda sanningskällan i det aktiva gränssnittet.
Sektionsträdet, noder, kanter, varningar och gridkort härleds från listan.

```js
Block = {
  id,
  kind: 'heading' | 'paragraph',
  level: 1 | 2 | 3 | null,
  text,
  comments: [],
  created
}

Document = {
  id,
  title,
  blocks: [Block],
  draft,
  recalledBlock,
  goal: {
    enabled,
    metric: 'words' | 'characters',
    target,
    reachedAt
  },
  created,
  updated,
  hiddenWords: []
}
```

Timerstatus är appövergripande:

```js
Timer = {
  mode: 'focus' | 'break',
  state: 'idle' | 'running' | 'paused' | 'finished',
  durationSec,
  remainingSec,
  endAt,
  announced
}
```

Körande tid räknas från absoluta `endAt`. Timern behöver därför inte skriva
till lagringen varje sekund och återhämtar rätt återstående tid efter
bakgrundsläge eller omladdning.

Ljudinställningarna är också appövergripande:

```js
settings = {
  soundTheme: 'none' | 'glantan' | 'regnvav' | 'djupstrom' | 'nattljus',
  soundVolume: 0..60,
  soundReactive: boolean
}
```

Endast inställningarna sparas. Ett aktivt ljudrum sparas inte som körande
status och startar därför aldrig automatiskt efter omladdning.

## Lokal lagring och säkerhetskopiering

Applikationstillståndet sparas i `localStorage` under nyckeln
`vavr-weaver-v5`. Äldre VävR-data kan migreras vid inläsning.

Markdown exporterar det aktiva dokumentets text. En VävR-säkerhetskopia
exporterar alla dokument, mål, inställningar och timerstatus som JSON.
Återställning kräver bekräftelse och laddar först ner en säkerhetskopia av
nuvarande tillstånd.

## Arbetslägen

### Skriv

Endast det aktuella skrivfältet visar text. Enter committar blocket,
Shift + Enter skapar radbrytning och Ctrl eller Cmd + Z i ett tomt fält tar
tillbaka det senaste blocket.

Dokumentmål och timer sammanfattas i en diskret statusrad när de är aktiva.
Målet räknar endast committad text.

### Ljudrum

`Soundscape` i `index.html` bygger alla ljud med Web Audio API. Varje tema
består av lokalt genererade brusbufferter, oscillatorer, filter och långsamma
modulationer. En gemensam kompressor och en försiktigt skalad mastervolym
minskar risken för plötsliga nivåsprång.

Gläntan och Nattljus använder glesa tonala glimtar. Regnväv använder ett
filtrerat brusfält och små dropptransienter. Djupström är avsiktligt utan
melodi och tydlig rytm. Om textrespons är påslagen öppnar bokstavsaktivitet
filtren marginellt, medan skiljetecken och invävda block kan ge en lågmäld
klang. Ingen tangent får ett eget klick eller belöningsljud.

En AudioContext skapas först av ett uttryckligt användartryck. Byte av tema
tonar ut den gamla sessionen, och alla oscillatorer, tidtagare och
ljudkontexter stängs vid avstängning eller när sidan lämnas.

### Väven

Kanterna ritas på canvas. Noderna är absolut positionerade knappar i DOM.
Fysiken kombinerar repulsion, kohesionsfjädrar, sekvenslänkar och
rubrikgravitation. Den fullständiga kohesionsmatrisen används för analys,
medan ett begränsat urval används för ritning.

### Struktur

Sektionstavlan härleder ett träd med en rubrikstack. Varje grid visar endast
direkta stycken och direkta undersektioner på aktuell nivå. Breadcrumb och
Upp en nivå navigerar hierarkin.

Stycken kan bara flyttas mellan stycken med samma ägarrubrik. En rubrik kan
bara flyttas mellan syskon med samma nivå och ägare. När en rubrik flyttas
följer hela dess underträd.

## PWA och offline

Alla sökvägar är relativa till GitHub Pages-scope. Service workern ligger i
reporoten och påverkar därför bara projektets egen katalog. Navigation använder
nätverksförst med cachefallback. En väntande ny version aktiveras först när
användaren väljer Uppdatera VävR, efter att utkastet har sparats.

Chromium använder `beforeinstallprompt` efter ett uttryckligt användartryck.
iPhone och iPad får manuella steg via Dela och Lägg till på hemskärmen.
Eftersom installerade Apple-webbappar kan få separat lokal lagring visar VävR
en säkerhetskopieringsvarning när lokalt innehåll finns.

## Tillgänglighet

- Canvasen är dold för hjälpmedel och varje grafnod har textalternativ.
- Interaktiva mål är minst 44 gånger 44 pixlar.
- Status förmedlas med text och inte enbart med färg.
- Timerdisplayen använder `role="timer"` och läser inte upp varje sekund.
- Ljudknapparna exponerar uppspelningsstatus med text och `aria-pressed`.
- Ljudtemat startar aldrig automatiskt och kan stängas av från toppbaren.
- Viktiga händelser köas i en polite live-region.
- Sektionstavlans kort nås med Tab. Pilar flyttar fokus, Alt + pil flyttar ett
  kort, E redigerar, Enter öppnar eller väljer och Delete raderar efter
  bekräftelse.
- Reduced motion minskar animering och synkrona fysiksteg.

## Verifiering

```bash
node vavr-test.mjs
node vavr-shell-test.mjs
node vavr-audio-test.mjs
node --check sw.js
python3 -m http.server 8000
```

Kontrollera dessutom manifest, ikonstorlekar, offlinekallstart,
installationsflöden, säkerhetskopiering, mobil layout och
tangentbordsnavigering före publicering.
