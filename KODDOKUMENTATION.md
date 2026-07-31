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
| `valsang-engine.js` | SkrivR:s kontinuerliga Valsångsmotor, anpassad till VävR:s ljudkontext och utökad med långsam organisk tonböjning |
| `hardfork-engine.js` | SkrivR:s 125 BPM-sequencer med trummor, bas, ostinato, fills och ett nytt omedelbart tangentanslag |
| `manifest.webmanifest` | Appidentitet, färger, startadress och installationsikoner |
| `sw.js` | Versionsstyrd appskal-cache, offlinefallback och användarstyrd uppdatering |
| `icons/` | Vanlig, maskable och Apple-anpassad VävR-ikon |
| `vavr-dokument.js` | Fristående äldre dokumentmodul som fortfarande täcks av testsviten |
| `vavr-kohesion.js` | Fristående tokenisering och kohesionsanalys |
| `vavr-textcontext.js` | Fristående textstatistik för äldre motorintegrationer |
| `vavr-test.mjs` | 87 tester av dokumentmodell, tokenisering och kohesion |
| `vavr-audio-test.mjs` | Web Audio-mock som startar, påverkar och stänger nio ljudlandskap och fyra skrivmaskinsteman samt verifierar SkrivR-motorernas produktionskedjor, direktanslag, förberedda bufferter, soft clipper och återväckning efter ljudavbrott |

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
  soundTheme:
    'none' | 'glantan' | 'regnvav' | 'djupstrom' | 'nattljus' |
    'ordfalt' | 'sambandsvav' | 'strukturklang' | 'valsang' | 'hardfork',
  soundVolume: 0..100,
  soundReactive: boolean,
  typewriterTheme:
    'none' | 'mekanisk' | 'reseskrivare' | 'elektrisk' | 'dampad',
  typewriterVolume: 0..100
}
```

Endast inställningarna sparas. Aktiva ljudsessioner sparas inte som körande
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

Skrivbredden lagras som ett normaliserat heltalsindex i den append-only
breddstabellen `[540, 640, 720, 820, 940, 1080, 1240, 1440]`. Äldre index
behåller därför sin tidigare betydelse. Draghandtagen utgår från fältets
faktiskt renderade bredd. Kandidatstegen jämförs också efter
viewportklampning, så ett maximalt fält inte snäpper smalare vid första lilla
dragrörelsen. Handtagen döljs på grova pekdon, där slidern är den entydiga
kontrollen.

### Ljudrum

`Soundscape` i `index.html` bygger de sju enklare ljudlandskapen med Web Audio
API och fungerar som livscykel- och volymadapter för de två fullständiga
SkrivR-motorerna i `valsang-engine.js` och `hardfork-engine.js`. Skripten är
lokala, ingår i service workerns appskal och kräver inga nätverksanrop. En
gemensam kompressor och en försiktigt skalad mastervolym minskar risken för
plötsliga nivåsprång.

Gläntan och Nattljus använder glesa tonala glimtar. Regnväv använder ett
filtrerat brusfält och små dropptransienter. Djupström är avsiktligt utan
melodi och tydlig rytm. Om textrespons är påslagen öppnar bokstavsaktivitet
filtren marginellt, medan skiljetecken och invävda block kan ge en lågmäld
klang.

De textlevande landskapen använder en begränsad textprofil som härleds lokalt.
Ordfält använder ordlängd, vokalandel och genomsnittlig meningslängd.
Sambandsväv använder medelvärdet av kvalificerade TF/IDF-kopplingar och
andelen lexikalt anslutna stycken. Strukturklang använder rubrikantal, senaste
rubriknivå, styckeantal och ordmängd. Dessa värden styr långsamma
filterförändringar, brusnivåer och oscillatorfrekvenser. De innebär ingen
tolkning av textens betydelse eller kvalitet.

Valsång är en portning av den fullständiga SkrivR-motorn, inte en förenklad
återskapning. Två kontinuerliga sinusoscillatorer, en suboscillator, ett
formantfilter, tempoformad vibrato, en mycket långsam tonböjning och ett
6,5 sekunder långt syntetiskt reverbrum bildar rösten. Bokstavsrörelse mappas
deterministiskt till pentatoniska skalsteg. Vokaler får längre andning medan
klusiler, frikativor och resonanta konsonanter får olika brus- och
tontransienter. Meningsslut spelar tillbaka ett sammandrag av meningens
tonföljd en oktav högre. Vokalandel, textlängd, alfabetiskt tyngdcentrum och
styckeantal ändrar skalfärg, gravitation och tonart.

Hard Fork är på motsvarande sätt SkrivR:s fullständiga 125 BPM-motor.
En lookahead-scheduler driver ett swingande sextondelsnät med kick, bas,
hi-hat, snare, ostinato, sidechain-liknande duckning, waveshaping och
korskopplad stereodelay. Skrivintensitet bygger lagren. Meningsmelodin
komprimeras till ett åttastegsminne, skiljetecken bestämmer filltyp och
rubriknivåer kan ge filtersvep och harmoniska skiften. VävR-förfiningen lägger
ett kort okvantiserat pluck vid själva tangentgesten, medan det starkare
musikaliska svaret ligger kvar på rytmnätet. Därmed bevaras Hard Fork-känslan
utan den upplevda tangentfördröjningen.

Den lokala textprofilen innehåller också teckenmängd, alfabetiskt
tyngdcentrum, rubrikskiften och dokumenttitel. Titeln och textens tillväxt
ger Hard Fork ett deterministiskt musikaliskt fingeravtryck. Vid stopp
återställs sequencer, fill, skrivstatus och vilomodulation så att en ny
session aldrig ärver ett gammalt rytmläge.

`Typewriter` är en separat Web Audio-motor för direkt tangentfeedback.
Mekanisk, Reseskrivare, Elektrisk och Dämpad använder olika kombinationer av
korta brus- och tontransienter. Tre bokstavsvarianter samt egna svar för
mellanslag, backsteg, interpunktion, tabb och Enter renderas till en
`AudioBuffer`-bank när temat startar. Ett tangenttryck skapar därefter bara en
`AudioBufferSourceNode` och kopplar den till en av tre förberedda
panoreringsbussar. Enter kan ge både vagnretur och klockton i samma buffer.
Motorn tar endast emot tangenttryckningar från skrivfältet. `keydown` ger den
snabbaste vägen och `beforeinput` är en deduplicerad reservväg för
skärmtangentbord på iOS. Ett uttryckligt temaval startar motorn och anropar
`preview()` för ett omedelbart provslag.

En kort kö med fysiska `keydown`-signaturer hålls i 240 millisekunder.
Matchande `beforeinput` konsumerar signaturen utan att spela ett nytt anslag.
Det förhindrar att ett sent iOS-event uppfattas som ett fördröjt eko.
Styrtangenter som Shift, pilar och Escape filtreras bort innan de når
ljudmotorerna. Valsång och Hard Fork validerar dessutom tangenten innan tempo
eller intensitet ändras.

En AudioContext skapas först av ett uttryckligt användartryck. En tyst
en-sampelskälla startas synkront i samma användargest för att väcka strikta
mobila Web Audio-implementationer och `latencyHint: 'interactive'` begär
lägsta praktiska renderingslatens. Kontexten återupptas sedan innan ljudnoder
eller brusbufferter byggs. Masterreglagen använder intervallet 0 till 100 och
har mjuk begränsning eller kompression före enhetens utgång. Varje
startförsök har ett eget åtgärds-id. Ett
senare stopp eller temabyte ogiltigförklarar därför äldre väntande starter, så
att de inte kan återaktivera ljud eller ge ett felaktigt statusmeddelande.
Under uppväckningen visar gränssnittet `Startar` och stoppknappen fungerar som
`Avbryt`. Byte av tema tonar ut den gamla sessionen, och alla oscillatorer,
tidtagare och ljudkontexter stängs vid avstängning eller när sidan lämnas.
Vid ett senare iOS-avbrott, exempelvis bakgrundsläge eller byte av ljudrutt,
försöker både ljudlandskapet och skrivmaskinen återväcka sin kontext i nästa
uttryckliga tangentgest.

### Väven

Kanterna ritas på canvas. Noderna är absolut positionerade knappar i DOM.
Fysiken kombinerar repulsion, kohesionsfjädrar, sekvenslänkar och
rubrikgravitation. Den fullständiga kohesionsmatrisen används för analys,
medan ett begränsat urval används för ritning.

Linjerna har separata visuella grammatiker:

- dokumentordning är en sammanhängande gråblå linje
- lexikal koppling är en streckad cyan linje vars bredd och opacitet följer
  kopplingens relativa styrka
- rubrikhierarki är en prickad mässingslinje

Alla tre linjetyperna blir starkare när en ansluten nod är vald eller har
fokus. Teckenförklaringen visar både nod- och linjesymboler.

`graphLens` är ett rent presentationsläge och sparas inte i dokumentet.
Värdena `all`, `connections`, `structure` och `gaps` filtrerar ritade kanter
med `graphEdgeVisible()`. Synliga noder härleds från ändpunkterna till de
kanter som faktiskt ritas, inte från den fullständiga analysmatrisen. Den
valda eller fokuserade noden förblir synlig, så ett linsbyte bryter inte
orienteringen. Bortfiltrerade noder tas ur Tab-ordningen. En separat
statusrad förklarar tomma resultat och skiljer brist på analysunderlag från
ett faktiskt resultat utan signaler.

### Struktur

Sektionstavlan härleder ett träd med en rubrikstack. Varje grid visar endast
direkta stycken och direkta undersektioner på aktuell nivå. Breadcrumb och
Upp en nivå navigerar hierarkin.

Dokumentpulsen härleds från den aktuella nivåns direkta text och
undersektioner. Segmentens flexvikt följer kvadratroten ur ordmängden, vilket
visar relativa skillnader utan att en mycket lång sektion slår ut alla andra.
En orange signal visar andelen bedömda stycken som är ensamma eller har svag
återkoppling. Nämnaren omfattar alltså inte stycken med för litet
analysunderlag. Tom sektion, för litet underlag, ej bedömda stycken och
uppmätta signaler får olika textetiketter. Segmenten är knappar som flyttar
fokus till direkttexten eller öppnar vald undersektion.

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
- Ljud startar aldrig automatiskt och kan stängas av samlat från toppbaren.
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
