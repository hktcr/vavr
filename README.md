# VävR

VävR är ett lokalt skrivverktyg som gör textens struktur och lexikala
återkoppling synlig. Varje committat stycke blir en nod i en levande väv.

## Dokumentytan

Den aktiva dokumenttiteln ligger som en egen knapp i toppbaren. Knappen öppnar
en full dokumentyta där det går att skapa ett nytt dokument och växla mellan
alla lokalt sparade dokument utan att först öppna inställningarna.

Dokumentytan har två lägen:

- **Lista** visar aktivt dokument först och ger varje dokument ett tydligt
  kort med titel, ordmängd, blockmängd och en kort textförhandsvisning.
- **Noder** visar varje dokument som en namngiven dokumentnod. Aktivt dokument
  har mässingsmarkering. Ett klick på vilken nod som helst öppnar dokumentet.
  Linjer mellan noder visar uppmätt lexikal likhet mellan dokumentens invävda
  text.

Ett nytt dokument får sitt namn direkt i dokumentytan och öppnas sedan i
Skriv. Den senast valda list- eller nodvyn sparas lokalt.

När Vävbordet är öppet samlar en låg arbetslist vyval, dokumentfolior och
kontextverktyg på en rad. På mobil används toppbarens dokumentknapp i stället
för en dubblerad kaj. Lista har en kompakt titelrad, Noders gräns räknas från
arbetslistens verkliga position och Ordekons detalj öppnas först när ett fynd
väljs. Kantnot blir en högerdocka på bred skärm och ett bottom sheet på mobil.

## Tre arbetsrum

1. **Skriv** visar endast det block som formuleras nu. Enter väver in blocket,
   Shift + Enter ger radbrytning och Ctrl eller Cmd + Z i ett tomt fält tar
   tillbaka det senast invävda blocket. Om blocket lades mitt i manuset
   återvävs det på samma plats.
2. **Vävbord** är ett sammanhållet redigeringsrum med tre projektioner av
   samma blocklista:

   - **Lista** visar hela manuset som en linjär ryggrad i verklig läsordning.
     Rubriker, stycken och nivåer har olika form men texten förblir läsbar.
     Ett klick på knuten lyfter ett stycke eller en hel rubriksektion. Då blir
     endast giltiga Skrivsömmar synliga som stora mål märkta Placera här.
     Samma flöde fungerar med tryck på pekskärm och med mellanslag, piltangent
     och Enter på tangentbord. Alt + pil finns kvar som snabbväg. Vanlig
     musdragning släpper på samma exakta sömmar. Skrivsömmar i normalläget
     placerar nästa nya block där användaren väljer.
   - **Noder** visar samma block som namngivna textfragment. Den vertikala
     positionen är mjukt förankrad i läsordningen medan lexikala samband
     påverkar sidledsdragningen. Ett valt block kan rullas ut till ett
     redigeringsblad utan att nodfältet lämnas. Flytta i manuset öppnar samma
     Lyft och placera-flöde i Lista, medan fri noddragning bara ändrar nodens
     visuella placering.
   - **Ekon** öppnar Ordekon, ett stabilt språkfält för ord, återkommande
     fraser och meningsstarter. Vanliga svenska ord viktas ned mot en lokal
     frekvensreferens, men tas inte bort. Ett ovanligt ord måste återkomma för
     att visas. Klick visar exakta förekomster, markerar berörda block i Lista
     och Noder och kan öppna valfritt block direkt i den gula
     redigeringsrutan.
3. **Heltext** visar hela den invävda texten som ett sammanhängande manus.
   Användaren kan växla mellan en typograferad läsvy och ren Markdown, visa
   eller dölja befintliga kommentarer och redigera hela dokumentet i ett
   professionellt Markdown-fält. Sidopanelen visar ord, texttecken, stycken,
   rubriker, uppskattad lästid och kommentarantal. Utkastet i Skriv räknas
   inte förrän det har vävts in.

Heltextredigering använder samma blocklista som övriga arbetsrum. Oförändrade
block behåller id, kommentarer, skapandetid och versioner. Ett ändrat block
får en skyddspunkt med texten före heltextredigeringen. Om en redigering skulle
ta bort ett kommenterat block krävs en separat bekräftelse. Ctrl eller Cmd + 5
öppnar Heltext och Ctrl eller Cmd + Enter sparar en pågående heltextredigering.
Läsvyn har även ett rent utskriftsläge.

Valt block och fokus följer med mellan Lista, Noder och Ekon. Webbläsare med stöd
för View Transitions låter blocket övergå mjukt mellan lägena, medan reducerad
rörelse ger ett omedelbart skifte.

I Inställningar finns fyra lokala textkaraktärer: Väv, Bok, Ren och Klar.
Väv med Charter som förstahandsval är standard. Valet syns direkt i skrivfält,
dokumentblock, redigering och Ordekon. Knappar och mätvärden behåller sin fasta
gränssnittstypografi, och inga typsnitt hämtas från nätet.

Varje fördröjd sparning är bunden till dokumentets fasta id, så ett snabbt
dokumentbyte kan inte flytta utkast eller titel mellan dokument. Skrivfältet har
en synlig, separat ångrahistorik per dokument. Redigerade block får dessutom
högst 18 lokala versioner: en skyddspunkt när redigeringen börjar och därefter
en ny punkt efter minst 140 ändrade tecken eller 24 ord. Versionerna följer med
i VävR-säkerhetskopian.

En pågående direktredigering är en skyddad transaktion. Dokumentbyte,
linsbyte och arbetsrumsbyte väntar tills texten har sparats eller avbrutits,
och webbläsaren varnar om sidan stängs med osparad redigering.
Redigeringsläget har samma mörka fokuskort i Lista och Noder, med stilla
bärnstensgul kant, pennmarkering och en utskriven status som inte förlitar sig
på färgen ensam.

**Spänningslinsen** visar block där läsordningen och ordsläktskapet drar åt
olika håll. Den är en fråga att undersöka, inte ett kvalitetsbetyg, och ändrar
aldrig texten automatiskt.

## Skrivstöd

Dokumentmål kan räknas i ord eller texttecken inklusive blanksteg. Målet är
frivilligt, sparas per dokument och räknar endast committad text.

Skrivpass kan köras i 15, 25 eller 45 minuter eller med en egen längd.
Timern kan pausas, fortsättas och döljas till en neutral statusrad. När ett
pass är slut kan användaren själv välja en femminuterspaus, ett nytt pass
eller att avsluta. Ingenting startar automatiskt.

Skrivfältets bredd kan ställas i åtta steg från 540 till 1 440 pixlar. På
smalare skärmar anpassas fältet automatiskt till den tillgängliga ytan.

## Ljudrum

Nio frivilliga ljudlandskap kan skapas direkt i webbläsaren. Fyra är stilla:

- **Gläntan** ger mjuk luft, varma grundtoner och sällsynta ljusglimtar.
- **Regnväv** ger ett jämnt regnfält som kan maskera ljud i omgivningen.
- **Djupström** är ett mörkt, neutralt brus utan melodi eller tydlig rytm.
- **Nattljus** ger långsamma övertoner och ett mer stämningsfullt rum.

Tre textlevande landskap förändras långsamt med texten:

- **Ordfält** följer ordlängd, vokalbalans och meningsrytm.
- **Sambandsväv** följer styckenas uppmätta lexikala återkoppling.
- **Strukturklang** följer rubriknivåer, styckeantal och dokumentets tillväxt.

Två dynamiska kompositioner svarar både på varje tecken och på textens
sammanlagda form:

- **Valsång** formar melodisk riktning av bokstavsföljder, låter vokaler
  andas längre och bygger fraser av skrivtempo, ordform och meningar. En fast
  pool med tre röster gör styckesväxlingen tydlig utan växande resursbruk.
  När ett nytt stycke vävs in växer nästa röst fram under ungefär två till
  tre sekunder medan den föregående tonar bort under åtta till fjorton
  sekunder. Rubriknivå, lokal likhet med föregående stycke, vokalandel och
  meningslängd styr register, motivsläktskap, formanter och överlappning. Den
  nya rösten formar samtidigt en kort svarssång av blockets bokstavskontur.
  Längd och sluttecken påverkar svarets omfång och kadens. Ett mycket kort
  block får ett diskret mikrosvar. Enter avslutar en fras men skapar inte en
  ny röst förrän blocket verkligen har vävts in. Svarssången återanvänder
  samma tre röster och skapar inga ytterligare oscillatorer vid commit.
- **Hard Fork** bevarar SkrivR-originalets generativa 125 BPM-produktion med
  bas, kick, hi-hat, snare, swing, ostinato, stereodelay och textstyrda fills.
  Ett nytt direktanslag hörs vid själva tangenten, medan det fylligare lagret
  fortfarande placeras på sequencerns rytmnät. När ett stycke vävs in görs
  dess bokstavskontur om till ett deterministiskt solo på tre till tio toner.
  Ett mycket kort block får ett mikrofill. Solot går sedan vidare som nytt
  ostinatominne. Högst två soloplaner får finnas samtidigt. Vid tätare commits
  ersätter det senaste stycket det senaste väntande svaret, så ljudnoder inte
  kan staplas utan gräns.

Tomma block ger inget musikaliskt svar i något av de två dynamiska temana.
Rubriker behåller sina tydligare temaväxlingar.

Ett separat skrivmaskinslager kan kombineras med vilket ljudlandskap som
helst. Det har fyra karaktärer: Mekanisk, Reseskrivare, Elektrisk och Dämpad.
Bokstäver, mellanslag, backsteg och Enter får skilda syntetiserade svar. När
ett tema väljs aktiveras det direkt och ett provslag bekräftar valet.
Anslagen förbereds som korta lokala ljudbufferter när temat startar, så ett
tangenttryck bara behöver starta ett redan färdigt ljud. Det minskar
fördröjningen tydligt, särskilt på iPhone och iPad. En sen iOS-inmatningssignal
dedupliceras mot det direkta tangentanslaget, så den inte hörs som ett
fördröjt dubbelslag.

Ljud startar endast efter ett uttryckligt temaval eller tryck på startknappen.
Volymreglagen har ett utökat intervall upp till en betydligt högre grundnivå.
Tema, volym och valfri skrivrespons sparas, men uppspelning återupptas aldrig
automatiskt efter omladdning. Alla ljud syntetiseras med Web Audio API utan
ljudfiler eller nätverksanrop och fungerar därför även offline. De två
SkrivR-motorerna ligger som lokala, cachade skript i appskalet. Start, stopp
och snabba temabyten är avbrytbara, så att ett äldre startförsök inte kan slå på
ljudet igen efter ett stopp. Bluetooth, AirPlay och vissa externa
ljudgränssnitt kan fortfarande lägga till egen överföringsfördröjning som
webbappen inte kan ta bort.

## Analys

Kohesionen beräknas med svensk tokenisering, stoppord, lätt suffixtrunkering,
TF/IDF och cosinuslikhet. Rubriker påverkar inte styckenas IDF. Små dokument
stabiliseras genom att IDF-vikterna krymps mot neutral vikt.

Dokumentväven återanvänder samma analysfamilj på en annan nivå. Varje dokument
representeras av all invävd blocktext, inklusive rubriker, medan dokumenttitel
och pågående utkast inte räknas. TF/IDF beräknas över de sparade dokumenten och
varje dokumentpar jämförs med cosinuslikhet. Ett dokument behöver minst åtta
ord och sex analyserbara unika ord för att jämföras. Sambandströskeln i
inställningarna används, men dokumentjämförelsen tillåts aldrig gå under 0,08.
Som mest fyra synliga kopplingar per dokument ritas för att nätverket ska vara
läsbart. När en dokumentnod får fokus visas den starkaste kopplingen och de
gemensamma nyckelorden i klartext.

Analysen och ritningen är åtskilda. Varningsstatus bygger på den fullständiga
kohesionsmatrisen, medan Vävbordets Noder bara ritar ett begränsat antal
trådar per nod.
Det hindrar ett visuellt kanttak från att skapa falska varningar.

I Noder visas dokumentordning med en sammanhängande gråblå linje, lexikal
återkoppling med en tydligt streckad cyan linje och rubrikhierarki med en
prickad mässingslinje. Trådkontrollen kan visa alla lager, samband eller
ryggrad. Den globala Spänningslinsen visar dragkampen mot läsordningen utan
att ändra dokumentet. Om en lins saknar mätbart underlag förklarar VävR varför
i stället för att visa en tvetydigt tom vy.

VävR mäter lexikal återkoppling, alltså delade centrala ord. Det är inte ett
mått på full semantisk betydelse, argumentativ kvalitet eller om en text är
korrekt. Orange markering visas därför först när det finns minst fyra
brödtextblock och tillräckligt analysunderlag.

### Ordekon

Ordekon är en separat, helt lokal repetitionsanalys. Den har tre lägen:

- **Ord** visar ord som förekommer minst två gånger i ett deterministiskt
  språkfält. Fältet hoppar därför inte slumpmässigt mellan analyser.
- **Fraser** söker sammanhängande sekvenser om två till fem normaliserade ord
  inom samma mening. Två och tre ord kräver minst tre förekomster. Fyra och
  fem ord kräver minst två. När en kort fras alltid ingår i en längre visas
  den längsta.
- **Meningsstarter** analyserar de första två till fyra orden separat.

Ordstorleken kombinerar faktisk upprepning, en utjämnad logaritmisk
frekvensjämförelse och lokal anhopning. Anhopning kan öka signalen med högst
25 procent. Svenska böjningsformer förs försiktigt samman, men de ursprungliga
formerna och deras textställen bevaras. Analysen körs lokalt i en
bakgrundstråd så att längre dokument inte låser redigeringsytan.
Vanliga böjda formord som saknar en direkt Kelly-träff får en försiktig
skyddsvikt och behandlas därför inte som sällsynta.

Frekvensreferensen är en kompakt lokal bearbetning av Swedish Kelly-list från
Språkbanken Text. Listan bygger på SweWaC, 114 miljoner ord svenskt
webbskriftspråk, och är därför en jämförelsepunkt snarare än en språknorm.
Egennamn, genre, facktermer och stilistiska motiv kan avvika helt rimligt.
Varje fynd kan märkas Avsiktligt eller Nyckelbegrepp eller döljas från
Ordekon. Inga omskrivningar sker automatiskt och ingen text skickas över
nätverket.

Datakälla: Volodina, Elena och Johansson Kokkinakis, Sofie (2017),
[Kelly](https://spraakbanken.gu.se/resurser/kelly),
[DOI 10.23695/6act-rs25](https://doi.org/10.23695/6act-rs25), CC-BY-4.0.

## Installation och lokal lagring

VävR kan installeras som en Progressive Web App från en webbläsare som stöder
det. På iPhone och iPad visas i stället tydliga steg för Lägg till på
hemskärmen. Appen har VävR-ikon, eget appfönster och ett lokalt offlineläge.

Dokument sparas lokalt på enheten. På vissa plattformar, särskilt iPhone och
iPad, kan den installerade appen få en separat lokal lagringsyta. Därför kan
alla dokument och inställningar exporteras som en säkerhetskopia och
återställas efter installation.

## Teknik

Applikationens logik och gränssnitt är självbärande i `index.html` och har inga
körtidsberoenden eller byggsteg. Manifest, service worker och lokala ikonfiler
ger installation och offlinefunktion. Markdown kan importeras, kopieras och
laddas ner.

Kör en enkel lokal webbserver:

```bash
python3 -m http.server 8000
```

Testsviterna körs med:

```bash
node vavr-test.mjs
node vavr-shell-test.mjs
node vavr-audio-test.mjs
node vavr-ordekon-test.mjs
```
