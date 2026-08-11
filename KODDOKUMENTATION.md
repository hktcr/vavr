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
| `valsang-engine.js` | Biologiskt inspirerad Valsångsmotor med omedelbar tangentrespons, frasminne, kontextstyrda svarssånger och en fast tre-rösterspool för styckesvisa korsfader |
| `hardfork-engine.js` | SkrivR:s 125 BPM-sequencer med trummor, bas, ostinato, fills, omedelbart tangentanslag och en begränsad lane för styckessolon |
| `ordekon-engine.js` | Lokal analysmotor för upprepade ord, fraser, meningsstarter, förekomster och begränsad lokal anhopning |
| `ordekon-kelly.js` | Genererad kompakt frekvensreferens från Språkbankens Swedish Kelly-list, CC-BY-4.0 |
| `ordekon-worker.js` | Lokal bakgrundstråd som kör Ordekon utan att låsa redigeringsgränssnittet |
| `scripts/build-kelly-reference.mjs` | Reproducerbar generator som filtrerar och komprimerar Kelly XML till den lokala referensen |
| `THIRD_PARTY_NOTICES.md` | Attribution, licens och bearbetningsbeskrivning för tredjepartsdata |
| `manifest.webmanifest` | Appidentitet, färger, startadress och installationsikoner |
| `sw.js` | Versionsstyrd appskal-cache, offlinefallback och användarstyrd uppdatering |
| `icons/` | Vanlig, maskable och Apple-anpassad VävR-ikon |
| `vavr-dokument.js` | Fristående äldre dokumentmodul som fortfarande täcks av testsviten |
| `vavr-kohesion.js` | Fristående tokenisering och kohesionsanalys |
| `vavr-textcontext.js` | Fristående textstatistik för äldre motorintegrationer |
| `vavr-test.mjs` | 87 tester av dokumentmodell, tokenisering och kohesion |
| `vavr-shell-test.mjs` | 282 kontroller av appskal, dokumentyta, Heltext, dokumentskydd, typografi, Vävbord, Ordekon, nodlayout, strukturflytt, PWA, skrivstöd, Skrivmaskinsvy, Enterfödelse och ljudintegration |
| `vavr-audio-test.mjs` | Web Audio-mock som startar, påverkar och stänger nio ljudlandskap och fyra skrivmaskinsteman samt verifierar SkrivR-motorernas produktionskedjor, deterministiska blocksvar, resursgränser vid 120 täta commits, direktanslag, förberedda bufferter, soft clipper och återväckning efter ljudavbrott |
| `vavr-ordekon-test.mjs` | 23 tester av frekvensviktning, formordsskydd, böjningsnormalisering, förekomstpositioner, maximala fraser, meningsstarter, anhopningstak och determinism |

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
  hiddenWords: [],
  echoDecisions: {
    ['word|normaliserad form']: 'intentional' | 'key' | 'hidden'
  }
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
  announced,
  baselineWords
}
```

Körande tid räknas från absoluta `endAt`. Timern behöver därför inte skriva
till lagringen varje sekund och återhämtar rätt återstående tid efter
bakgrundsläge eller omladdning.

Skrivvyns och ljudrummens inställningar är appövergripande:

```js
settings = {
  documentHubView: 'list' | 'graph',
  vavbordView: 'list' | 'nodes' | 'echo',
  echoMode: 'words' | 'phrases' | 'starters',
  fontProfile: 'vav' | 'bok' | 'ren' | 'klar',
  typewriterView: boolean,
  typewriterContextIndex: 0..7,
  commitReceipts: [
    'clock' | 'timer' | 'blockWords' | 'passWords' |
    'documentWords' | 'goal'
  ],
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
`vavr-weaver-v5`. Den interna tillståndsversionen är 13. Äldre VävR-data kan
migreras vid inläsning.

### Typografi

VävR skiljer på text, gränssnitt och tekniska etiketter. `fontProfile` ändrar
endast textrollen `--serif`, som används i skrivfält, dokumentblock,
redigeringskort och Ordekon. Knappar använder `--sans` och mätvärden använder
`--mono` oberoende av profil.

Standardprofilen `vav` börjar med Charter och har lokala plattformsalternativ.
`bok` prioriterar Iowan Old Style och Palatino, `ren` använder systemets sans
serif och `klar` prioriterar Verdana. Alla stackar är lokala och fungerar
offline. Namnen beskriver visuell karaktär. VävR påstår inte att en profil är
universellt mer lättläst än en annan.

Markdown exporterar det aktiva dokumentets text. En VävR-säkerhetskopia
exporterar alla dokument, mål, inställningar och timerstatus som JSON.
Återställning kräver bekräftelse och laddar först ner en säkerhetskopia av
nuvarande tillstånd.

Fördröjda utkast- och titelsparningar fångar dokument-id när de skapas. Ett
dokumentbyte tömmer väntande timers, vilket hindrar en skrivning från dokument A
att landa i dokument B. Dubbletter av dokument- och block-id ersätts vid
normalisering.

Skrivfältets ångrahistorik ligger i minnet och är separat per dokument. Blockens
beständiga `revisions` skapas när redigering börjar och efter minst 140 ändrade
tecken eller 24 ord. Tom text blir aldrig en automatisk version. Högst 18
versioner sparas per block och de ingår automatiskt i JSON-säkerhetskopian.

## Arbetslägen

### Heltext

`renderFulltext()` härleder både manus och grundstatistik direkt från det
aktiva dokumentets kanoniska blocklista. Den formaterade vyn skapar endast
rubrikelement, stycken och escapad kommentarstext. Markdown-läget är skrivskyddat
tills användaren uttryckligen väljer Redigera hela texten.

`reconcileMarkdownBlocks()` tolkar den sparade Markdown-texten och matchar
först block genom typ, nivå och exakt text, därefter genom säker position och
blocktyp. Matchade block behåller id, kommentarer, skapandetid och tidigare
versioner. Ändrad text skapar revisionen `Före heltextredigering`. Ett
kommenterat block som inte längre kan matchas räknas i
`removedCommentCount`, vilket utlöser en separat bekräftelse före mutation.

Heltextredigering använder samma centrala redigeringsspärr som Lista och
Noder. Dokumentbyte och arbetslägesbyte stoppas tills redigeringen sparats
eller avbrutits. `beforeunload` skyddar även osparad heltext. Utskriftsstilen
döljer gränssnitt och statistik men behåller manus och uttryckligen visade
kommentarer.

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

När Vävbordet är öppet renderar `renderVavbordDock()` samma dokument som
kompakta folior i `#vavbord-chrome`. Arbetslisten samlar dokument, Lista,
Noder, Ekon och vyberoende linser i ett enda höjdlager. Varje folio är en
riktig knapp med titel, aktiv markering och ett entydigt dokument-id. På
skärmar upp till 820 pixlar döljs foliorna, eftersom toppbarens dokumentknapp
ger samma säkra väg till dokumentytan.

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

`commitDraft()` fångar textens startpunkt och en fryst kvittosnapshot före
skrivfältet töms. Blocket muteras, sparas och analyseras omedelbart. Den nya
noden skapas med `birthLocked`, vilket gör att kollisioner, kantkrafter och
huvudloopen lämnar dess träffpunkt stilla medan guldtråden flyger. Vid träffen
tar `revealCommitNode()` bort låset och startar det befintliga fysikfönstret.

Nodlagret är avsiktligt nedtonat i Skriv. Därför visas den första gyllene
födelsen som en separat `commit-node-orb` ovanför nodlagret. Orben följer
nodens verkliga `nodeStates`-koordinater medan fysiken börjar arbeta och tonar
sedan över till nodens stycke-, rubrik- eller varningsfärg. Den kan aldrig
ändra dokumentdata.

Dekorativa commiteffekter ligger i `activeCommitEffects` och begränsas till
fyra samtidiga poster. `finishCommitEffect()` är idempotent och frigör alltid
födelselåset, avbryter animationer och tidsstyrningar samt tar bort alla
tillfälliga element. Samma städning används vid tät invävning, reducerad
rörelse, animationsfel, viewportändring, dokument- eller vybyte,
bakgrundsläge, återställning och `pagehide`.

Skrivmaskinsvyn behåller `textarea` som enda sanningskälla för text, caret,
markering, stavningskontroll, urklipp, native undo, IME och iOS-inmatning. Det
`aria-hidden` spegellagret segmenterar svensk text med `Intl.Segmenter` och en
lokal reservväg. Meningen vid caret eller en markering visas fullt. Tidigare
meningar tonas med ett vertikalt maskdjup enligt den append-only tabellen
`[0, 2, 4, 6, 9, 13, 18, Infinity]` tidigare rader. Textareas interna scroll
och spegellagrets radbrytning synkas utan att spegellagret skriver tillbaka
text.

Kvitton är en absolut placerad singleton i skrivglaset och påverkar därför
varken kompositörhöjd eller nodernas exklusionsyta. Värdena hämtas från
commitens snapshot. `baselineWords` sparar alla dokuments sammanlagda
invävda ord när ett fokuspass startar, så valbara passord blir ett nettomått
även efter återtagning och redigering. Timer- och måldelar utelämnas när deras
funktioner inte är aktiva.

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

Valsång bevarar SkrivR-motorns direkta bokstavsrespons, frasminne,
konsonanttransienter och långsamma tonböjning men använder nu en fast pool med
tre förberedda röster. Varje röst har två närliggande deltoner, subton, två
formantfilter och egen panorering. Tre delade LFO:er ger vibrato, långsam
tonkontur och vilodrift. Totalt finns högst tolv permanenta oscillatorer och
inga nya skapas vid ett styckecommit.

Motorn har fyra biologiskt inspirerade lätesfamiljer: djup tonal moan,
stigande frekvenssvep, modulerad warble och rytmisk pulssvit. Valet är
deterministiskt från textsignatur, struktur, sluttecken och lokal likhet.
Lätestyperna förändrar kontur, tidsform, övertonsbalans, subton, formanter och
långsam tonmodulation. Samtliga stannar i samma moll- eller durpentatoniska
material, med kontrollerad nivåsumma och högst 6,2 sekunders svar, för att
variation inte ska bryta det harmoniska fokusljudet. Det är en syntetisk
tolkning av valars akustiska strategier, inte en imitation av en bestämd art.

`Soundscape.commit(kind, blockProfile)` förmedlar den semantiska skillnaden
mellan ett Enter och ett faktiskt invävt block. Enter avslutar en fras. Ett
commit roterar exakt en gång till nästa röst. Den nya rösten växer fram under
ungefär två till tre sekunder och den föregående tonar bort under åtta till
fjorton sekunder. Rubriknivå väljer motivfamilj och register. Lokal
TF/IDF-likhet, vokalandel och meningslängd styr konturavstånd, formanter,
stereobredd och fraslängd. Vid samma commit samplas blockets typade kontur,
eller blocktexten efter en inklistring, till en kort svarssång. Hög likhet ger
ett närmare eko och låg likhet ger ett motriktat svar. Textlängd bestämmer två
till sju tonpunkter och sluttecknet bestämmer kadens. Mycket korta block får
ett stigande och diskret kontaktläte. Svarskonturen automatiseras på den nya poolrösten och
skapar därför inga nya oscillatorer. Röstpoolen återanvänds cirkulärt,
masterkedjan har kompressor och reverbet använder en kortare 3,8 sekunders
impulsrespons för lägre startkostnad på mobil.

Både Valsång och Hard Fork har en intern accentdirigent. Terminalt
skiljetecken och Enter hålls kort i väntan på ett eventuellt blockcommit. Om
ett commit följer samlas händelserna i blockets musikaliska svar i stället för
att tre effekter staplas. Rubrik och block har högre prioritet än radbrytning
och enskilda tecken. Citattecken, parenteser och hakparenteser får lågmälda
öppnings- och slutljud med motsatt panorering. Ett aktivt ord- eller teckenmål
ger en harmoniskt integrerad accent när 25, 50, 75 eller 100 procent passeras.
Ett rullande accentfönster dämpar eller utelämnar mikroaccenter vid hög täthet,
medan strukturella händelser alltid bevaras.

Hard Fork är på motsvarande sätt SkrivR:s fullständiga 125 BPM-motor.
En lookahead-scheduler driver ett swingande sextondelsnät med kick, bas,
hi-hat, snare, ostinato, sidechain-liknande duckning, waveshaping och
korskopplad stereodelay. Vid en tankepaus fortsätter klockan utan fasbrott men
motorn begränsas till fast kick, bas och hi-hat med låg intensitet. Ostinato,
extrabeat och rikare atmosfär återkommer först när skrivandet fortsätter.
Det förhindrar både omstartens dubbelslag och att vilopulsen blir grumlig.
Skrivintensitet bygger lagren. Meningsmelodin
komprimeras till ett åttastegsminne, skiljetecken bestämmer filltyp och
rubriknivåer kan ge filtersvep och harmoniska skiften. VävR-förfiningen lägger
ett kort okvantiserat pluck vid själva tangentgesten, medan det starkare
musikaliska svaret ligger kvar på rytmnätet. Därmed bevaras Hard Fork-känslan
utan den upplevda tangentfördröjningen.

Hard Fork har dessutom ett permanent, återanvänt bakgrundslager med tre mörka
röster, filtrerad maskinluft och mycket långsam filterdrift. Lagret vaknar
varsamt när skrivandet börjar och tonar ned efter en paus. Det gör ljudrummet
fylligare utan att öka antalet oscillatorer per tangent. Fyra groovefamiljer
och sex klangfamiljer väljs vid fyrtaktsgränser. Växlingen sker därför aldrig
plötsligt mitt i en fras. Vokalandelen blandar nu mjukt mellan två harmoniska
förlopp i stället för att passera en hård tröskel.

Ett styckecommit bygger dessutom en textbunden soloplan från blocktextens
bokstavsrörelser, textlängd, vokalandel, sluttecken, lokal likhet och det
senaste melodiminnet. Mycket kort text ger ett tretons mikrofill. Längre text
ger fem till tio toner under högst ungefär tre sekunder. Planen skapar inga
ljudnoder vid commit utan konsumeras stegvis av samma lookahead-scheduler och
routas genom `synthBus`, waveshaper och kompressor. Som mest finns två planer
sammanlagt i aktiv och väntande lane. Om fler block vävs in innan de hinner
spelas ersätter den senaste planen det senaste väntande svaret. Det första
normala svaret får därmed avslutas utan att hundratals schemalagda oscillatorer
kan byggas upp. Solots komprimerade kontur blir sedan nästa ostinatominne.
Rubrikcommit använder samma begränsade lane men får ett tydligare temasting.

Den lokala textprofilen innehåller också dokument-id, ett lokalt beräknat
textfingeravtryck, teckenmängd, alfabetiskt tyngdcentrum, rubrikskiften och
dokumenttitel. Dokumentets id och titel ger en stabil palett. Textens
fingeravtryck formar utvecklingen och ett nytt sessionsfrö varierar
artikulation, groove, klang och panorering inom samma ram. Samma dokument känns
därför igen, men två framföranden blir inte bitidentiska. Vid stopp
återställs sequencer, fill, skrivstatus och vilomodulation så att en ny
session aldrig ärver ett gammalt rytmläge. Även aktiv soloplan, väntande
planer och blocksvarsräknare töms. Tomma block lämnar båda dynamiska motorerna
helt oförändrade.

Efter 180 sammanhängande tangentgester aktiveras en koncentrationsvakt. Den
minskar slumpmässiga hi-hats, oktavsprång, extra svar och starka crashaccenter
tills skrivandet har vilat. Fylligheten kommer därmed främst från långsamma
lager och klangvariation, inte från fler överraskningar eller högre nivå.

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
tre projektioner av samma kanoniska blocklista. `settings.vavbordView` sparar
`list`, `nodes` eller `echo`. `switchVavbordView()` bevarar `selectedId`, aktivt
dokument och redigeringskontext. Ett pågående textfält måste sparas eller
avbrytas före vybyte. View Transitions används när webbläsaren stöder det och
reducerad rörelse respekteras.

`workspaceTop()` läser arbetslistens verkliga nederkant. Nodfysikens övre
gräns och vyernas CSS-variabel `--workspace-content-top` utgår därmed från
samma visuella lager. Noders teckenförklaring är ett stängt `details`-element
i viloläge. Ordekons detaljpanel får `data-open` först efter fyndval och kan
stängas med fokus tillbaka till fyndet. Kantnot är högerdockad på desktop och
ett begränsat bottom sheet på mindre skärmar.

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

Text redigeras med riktig `textarea` i ett gemensamt fokuskort för Lista och
Noder. Kortet har mörk skrivyta, stilla bärnstensgul kant, pennmarkering och
utskriven redigeringsstatus. Ctrl eller Cmd + Enter sparar och Escape
avbryter.

`startLiftedMove()` gör ryggradens knut till huvudvägen för omordning.
`validMoveBoundaries()` härleder alla tillåtna mål och `writingSeam()` visar
dem som stora flyttsömmar märkta Placera här. `moveUnitToBoundary()` är den
enda muterande flyttfunktionen för tryck, tangentbord, musdragning och
Alt + pil. Stycken kan placeras vid en annan giltig gräns och därmed även byta
sektion. Rubriker får endast mål mellan syskon med samma nivå och ägare, och
hela sektionen följer med. En flytt skapar en historikhändelse, sparar en
gång, räknar om analysen och återställer fokus. Escape avbryter ett lyft utan
att mutera dokumentet.

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

Kantnoten har dessutom Flytta i manuset. Den växlar till Lista och startar
samma Lyft och placera-flöde för vald nod. Fri dragning i Noder fortsätter
endast att påverka den visuella koordinaten och kan därför inte oavsiktligt
ändra dokumentets kanoniska läsordning.

`graphLens` är ett rent presentationsläge och sparas inte i dokumentet.
Trådkontrollen visar `all`, `connections` och `structure`. Den globala
Spänningslinsen använder internt värdet `tension`. `graphEdgeVisible()`
filtrerar ritade kanter och bortfiltrerade noder tas ur piltangentsflödet.
En separat statusrad skiljer brist på analysunderlag från ett mätbart resultat
utan signaler.

#### Ordekon

Ordekon laddas som två lokala skript före applikationens huvudskript.
`ordekon-kelly.js` exponerar ett fryst WPM-uppslag och
`ordekon-engine.js` exponerar `window.Ordekon`. Motorn saknar DOM-beroenden
och kan därför testas separat.

`ensureEchoAnalysis()` startar analysen först när Ekon öppnas. Omfånget är
hela dokumentet eller en sektion från `buildStructureTree()`. Arbetet körs i
`ordekon-worker.js` så att långa dokument inte blockerar gränssnittstråden.
Om Web Workers saknas finns en lokal reservväg. En textändring anropar
`invalidateEcho()` och nästa render bygger resultatet på nytt. Analysen körs
alltså inte efter varje tangenttryckning.

Motorn tokeniserar Unicode-bokstäver och sparar ytform, block-id,
teckenposition och global ordposition för varje träff. Samma försiktiga
suffixtrunkering används för text och frekvensreferens. Detta är inte en full
svensk lemmatiserare. Sammansättningar delas inte.

Ordsignalen använder:

1. logaritmen av faktisk repetitionsmängd
2. en utjämnad frekvenskvot mot Kelly, med ett prior motsvarande 500 ord
3. faktorn `antal / (antal + 3)`, som dämpar små stickprov
4. lokal anhopning i ett glidande fönster om 100 ord, begränsad till högst
   25 procents förstärkning

Ord med bara en förekomst visas aldrig. Ord som saknas i den kompakta
referensen får ett försiktigt golv på 0,5 förekomster per miljon ord. Kelly är
lemmabaserad, vilket gör att vanliga böjda formord kan sakna direkt träff.
Kända formord får därför en skyddsvikt på 5 000 förekomster per miljon. Det är
en medvetet försiktig nedviktning, inte en uppmätt frekvens för den aktuella
formen. Referensen är generell webbsvenska från 2010-talet och används inte
som norm för genre, fackspråk eller stil.

Fraser byggs endast inom en mening. Två- och treordsföljder kräver tre
förekomster. Fyra- och femordsföljder kräver två. En kort kandidat tas bort
om samtliga förekomster täcks av samma längre kandidat. Meningsstarter kör
samma metod på meningens första två till fyra ord och hålls i en egen vy.
Semantisk likhet, syntaktiska mallar och sekvenser med luckor ingår inte,
eftersom de skulle ge betydligt fler svårtolkade träffar.

`renderEcho()` visar ord i ett deterministiskt språkfält. Den visuella ordningen
styrs av en stabil texthash, medan storleken följer uppmärksamhetssignalen.
Fraser och meningsstarter visas som textremsor. `renderEchoMap()` visar
förekomster över dokumentets kanoniska blockordning. Ett fynd kan föras till
Lista eller Noder via `echoHighlightedIds`. Ett klick på en enskild
förekomst växlar till Lista och anropar `startEditing()`, vilket återanvänder
det gula transaktionsskyddade redigeringskortet.

`echoDecisions` sparas per dokument. `intentional` tonar ned fyndet, `key`
markerar ett nyckelbegrepp och `hidden` tar bort det från standardfältet.
Dolda fynd kan visas igen och samma knapptryckning tar bort ett tidigare val.
Besluten påverkar inte TF/IDF-kohesionen och ändrar aldrig texten automatiskt.

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
Kelly-referensen, Ordekonmotorn och dess bakgrundstråd ingår i appskalet och
fungerar helt offline. Analysen gör inga nätverksanrop.

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
  mellanslag eller M lyfter, Alt + pil snabbflyttar, E redigerar, S skriver
  efter, Enter väljer och Delete raderar efter bekräftelse. Flyttsömmarna är
  namngivna knappar med exakta index och ett enda roving-tabbstopp. Endast
  giltiga mål exponeras när ett block är lyft.
- Nodfältets knappar bär blocktyp, ordningsnummer och textutdrag. E öppnar en
  riktig textarea. Roving tabindex, `aria-controls` och `aria-expanded`
  binder noden till Kantnoten, och varje canvasrelation har en textmotsvarighet
  i Kantnoten eller linsens statusrad.
- Ordekon använder riktiga knappar för ord, fraser, meningsstarter,
  dokumentkarta och förekomster. Storlek kompletteras med exakta antal och
  textförklaring. Flikarna använder `role="tab"`, piltangenter och roving
  tabindex. Färg används inte ensam för Avsiktligt, Nyckelbegrepp eller Dold.
- På skärmar upp till 820 pixlar döljs dokumentkajen medan dokumentknappen i
  toppbaren finns kvar. Noders trådlins stannar i den horisontellt rullbara
  arbetslisten och teckenförklaringen är hopfälld tills den öppnas.
- Reduced motion minskar animering och synkrona fysiksteg.

## Verifiering

```bash
node vavr-test.mjs
node vavr-shell-test.mjs
node vavr-audio-test.mjs
node vavr-ordekon-test.mjs
node --check sw.js
python3 -m http.server 8000
```

Kontrollera dessutom manifest, ikonstorlekar, offlinekallstart,
installationsflöden, säkerhetskopiering, mobil layout och
tangentbordsnavigering före publicering.
