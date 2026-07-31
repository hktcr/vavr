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
| `index.html` | Hela applikationens gränssnitt, dokumenttillstånd, dokumentyta, dokumentlikhet, analys, fysik, canvasritning, ljudrum, timer, mål och PWA-flöden |
| `valsang-engine.js` | SkrivR:s kontinuerliga Valsångsmotor, anpassad till VävR:s ljudkontext och utökad med långsam organisk tonböjning |
| `hardfork-engine.js` | SkrivR:s 125 BPM-sequencer med trummor, bas, ostinato, fills och ett nytt omedelbart tangentanslag |
| `manifest.webmanifest` | Appidentitet, färger, startadress och installationsikoner |
| `sw.js` | Versionsstyrd appskal-cache, offlinefallback och användarstyrd uppdatering |
| `icons/` | Vanlig, maskable och Apple-anpassad VävR-ikon |
| `vavr-dokument.js` | Fristående äldre dokumentmodul som fortfarande täcks av testsviten |
| `vavr-kohesion.js` | Fristående tokenisering och kohesionsanalys |
| `vavr-textcontext.js` | Fristående textstatistik för äldre motorintegrationer |
| `vavr-test.mjs` | 87 tester av dokumentmodell, tokenisering och kohesion |
| `vavr-shell-test.mjs` | 162 kontroller av appskal, dokumentyta, dokumentlikhet, Vävbord, nodlayout, redigeringstransaktioner, PWA, skrivstöd och ljudintegration |
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
  recalledIndex,
  lastCommittedBlockId,
  lastCommittedBlockUnavailable,
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
  documentHubView: 'list' | 'graph',
  vavbordView: 'list' | 'nodes',
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
`vavr-weaver-v5`. Den interna tillståndsversionen är 9. Äldre VävR-data kan
migreras vid inläsning.

Markdown exporterar det aktiva dokumentets text. En VävR-säkerhetskopia
exporterar alla dokument, mål, inställningar och timerstatus som JSON.
Återställning kräver bekräftelse och laddar först ner en säkerhetskopia av
nuvarande tillstånd.

## Arbetslägen

### Dokumentytan

Dokumentytan är ett modalt arbetslager ovanpå de två arbetsrummen. En
dedikerad knapp i toppbaren visar den aktiva dokumenttiteln och öppnar lagret.
Öppning sparar det aktuella utkastet innan dokumentlistan renderas.

Listvyn härleds direkt från `app.documents`. Aktivt dokument ligger först och
varje kort visar titel, ordmängd, blockmängd och en textförhandsvisning. Ett
klick anropar `changeActiveDocument()`, stänger lagret och återställer fokus i
det arbetsläge som redan var öppet.

Nytt dokument är ett sammanhållet formulärflöde:

1. användaren öppnar namnformuläret
2. `createDocument()` skapar den fullständiga kanoniska modellen
3. dokumentet läggs till i `app.documents`
4. `changeActiveDocument()` öppnar det
5. VävR växlar till Skriv och placerar fokus i skrivfältet

Nodvyn använder dokumentformade DOM-knappar ovanpå ett SVG-lager med
kopplingslinjer. Aktivt dokument märks med text och mässingsfärg. Tomma eller
för korta dokument får streckad kant. Klick på en nod öppnar dokumentet.

`analyzeDocuments()` sammanfogar varje dokuments invävda blocktext och
återanvänder `tokenize()`, `buildIdf()`, `buildVector()`, `cosine()` och
`commonWords()`. Dokumenttiteln och `draft` ingår inte. Rubriker ingår eftersom
de är invävda block och bär dokumentets explicita ämnesstruktur.

Jämförelsen kräver minst åtta ord och sex analyserbara unika ord per dokument.
Tröskeln hämtas från `settings.threshold` och klampas till intervallet 0,08
till 0,28. Kvalificerade dokumentpar lagras i `fullEdges`. Högst fyra linjer
per dokument väljs till `edges` för ritning. Den fullständiga mängden används
för status och starkaste koppling, medan den ritade mängden används för
fokusering och visuell nedtoning.

`layoutDocumentGraph()` är deterministisk. Den börjar i ett responsivt grid
och kör därefter 150 fysiksteg med repulsion, likhetsfjädrar, centrering,
dämpning och viewportklampning. Därmed ligger dokumentknapparna kvar inom
grafytan även när dess storlek ändras.

När Vävbordet är öppet renderar `renderVavbordDock()` samma dokument som en
horisontell Dokumentkaj. Varje folio är en riktig knapp med titel, ordmängd,
textetiketten `Öppet` för aktivt dokument och ett entydigt dokument-id. Kajen
är inte modal. Dokumentbyte anropar `changeActiveDocument()` direkt, medan
Nytt och Alla dokument återanvänder dokumentytans säkra formulärflöde.

### Skriv

Endast det aktuella skrivfältet visar text. Enter committar blocket,
Shift + Enter skapar radbrytning och Ctrl eller Cmd + Z i ett tomt fält tar
tillbaka det senast invävda blocket via `lastCommittedBlockId`. Dess index
sparas i `recalledIndex`, så ett block som skrevs i en Skrivsöm återvävs på
samma plats i stället för sist i dokumentet. Raderas det senast invävda
blocket markeras det som otillgängligt, så återtagning aldrig faller tillbaka
på och tar bort ett annat block av misstag.

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

### Vävbord

Vävbordet ersätter de tidigare separata arbetslägena Väven och Struktur med
två projektioner av samma kanoniska blocklista. `settings.vavbordView` sparar
`list` eller `nodes`. `switchVavbordView()` bevarar `selectedId`, aktivt
dokument och redigeringskontext. Ett pågående textfält måste sparas eller
avbrytas före vybyte. View Transitions används när webbläsaren stöder det och
reducerad rörelse respekteras.

#### Lista

`renderOutline()` renderar nu hela dokumentet i läsordning som en linjär
manusryggrad. `spineCard()` ger rubriker och stycken olika form, full läsbar
text, metadata och samma block-id som nodfältet. Rubrikindrag härleds från
H1 till H3 men ändrar inte DOM-ordningen.

`writingSeam()` placerar en riktig knapp före, mellan och efter alla block.
Ett klick anropar `beginWritingAt(index)`, vilket skapar ett
`pendingInsertContext` med exakt infogningsindex och öppnar Skriv. Flera nya
block fortsätter att vävas in från samma söm. Skrivsömmarna använder roving
tabindex, så endast en söm ligger i Tab-ordningen. Upp, ned, Home och End
flyttar mellan sömmarna. S på ett fokuserat block öppnar sömmen efter det.

Text redigeras med riktig `textarea`. Ctrl eller Cmd + Enter sparar och
Escape avbryter. Alt + pil flyttar. Stycken kan bara flyttas mellan stycken
med samma ägarrubrik. Rubriker kan bara flyttas mellan syskon med samma nivå
och ägare, och hela sektionen följer med rubriken. Dragning startar visuellt
från ryggradens särskilda nålgrepp, medan tangentbordsvägen alltid finns.

`editingBuffer` bevarar arbetskopian och `guardActiveEdit()` spärrar
dokumentbyte, linsbyte, flytt, radering, modalöppning och arbetsrumsbyte tills
användaren sparar eller avbryter. `beforeunload` varnar dessutom vid försök
att lämna sidan med en aktiv direktredigering.

#### Noder

Kanterna ritas på canvas och textfragmenten är absolut positionerade
DOM-knappar. Noderna är pappersformade och bär alltid typ, ordningsnummer och
textutdrag. Fysiken kombinerar repulsion, kohesionsfjädrar, sekvenslänkar och
rubrikgravitation, men varje nod får dessutom en mjuk vertikal kraft mot sitt
index i blocklistan. Den sammanhängande sekvenslinjen blir därmed en läsbar
manusrygg även när lexikala samband drar noder i sidled.

Linjerna har separata visuella grammatiker:

- dokumentordning är en sammanhängande gråblå linje
- lexikal koppling är en streckad cyan linje vars bredd och opacitet följer
  kopplingens relativa styrka
- rubrikhierarki är en prickad mässingslinje

E öppnar vald nod i Kantnoten som ett otransformerat redigeringsblad.
Fysiken stoppas under skrivningen och analysen räknas om först vid sparning.
Ctrl eller Cmd + Enter sparar, Escape avbryter och fokus återgår till samma
nod. Upp och ned följer läsordningen. Vänster och höger följer närmaste
geometriska granne. Nodfältet använder roving tabindex, `aria-controls` och
`aria-expanded`, så endast en nod ligger i Tab-ordningen och Kantnotens öppna
läge går att uppfatta med hjälpmedel.

`graphLens` är ett rent presentationsläge och sparas inte i dokumentet.
Trådkontrollen visar `all`, `connections` och `structure`. Den globala
Spänningslinsen använder internt värdet `tension`. `graphEdgeVisible()`
filtrerar ritade kanter och bortfiltrerade noder tas ur piltangentsflödet.
En separat statusrad skiljer brist på analysunderlag från ett mätbart resultat
utan signaler.

#### Spänningslins

Spänning är inte ett tredje arbetsläge. Linsen använder endast `flow` för att
isolera block där lokal läsordning och starkare lexikal dragning inte
sammanfaller. `lonely` betyder i stället öppet lexikalt glapp och blandas inte
in i dragkampen. I Lista tonas övriga block ned endast när en träff finns. I
Noder visas berörda noder och trådar. Linsen beskriver en relation att
undersöka, inte textkvalitet, och utför aldrig en automatisk flytt.

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
- Dokumentytan är en modal dialog med fokusfälla, Escape-stängning och
  återställt fokus.
- Dokumentlistans kort och dokumentvävens noder är riktiga knappar. Varje nod
  läser upp titel, aktiv status, ordmängd och antal synliga kopplingar.
- Dokumentkajens folior är riktiga knappar och markerar aktivt dokument med
  både ordet `Öppet`, form och mässingskant.
- Dokumentlikhet förklaras också med text. Färg och linjebredd är inte den
  enda informationsbäraren.
- Interaktiva mål är minst 44 gånger 44 pixlar.
- Status förmedlas med text och inte enbart med färg.
- Timerdisplayen använder `role="timer"` och läser inte upp varje sekund.
- Ljudknapparna exponerar uppspelningsstatus med text och `aria-pressed`.
- Ljud startar aldrig automatiskt och kan stängas av samlat från toppbaren.
- Viktiga händelser köas i en polite live-region.
- Vävbordets listkort följer blocklistans DOM-ordning. Pilar flyttar fokus,
  Alt + pil flyttar, E redigerar, S skriver efter, Enter väljer och Delete
  raderar efter bekräftelse. Skrivsömmarna är namngivna knappar med exakta
  index och ett enda roving-tabbstopp.
- Nodfältets knappar bär blocktyp, ordningsnummer och textutdrag. E öppnar en
  riktig textarea. Roving tabindex, `aria-controls` och `aria-expanded`
  binder noden till Kantnoten, och varje canvasrelation har en textmotsvarighet
  i Kantnoten eller linsens statusrad.
- På låga liggande skärmar fälls Dokumentkaj, Trådar och teckenförklaring ihop
  medan nodernas storlek och ordningsfält komprimeras. Dokumentknappen i
  toppbaren och den globala Spänningslinsen förblir tillgängliga.
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
