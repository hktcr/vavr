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

När Vävbordet är öppet ligger samma dokument även i en horisontell
**Dokumentkaj**. Varje dokument visas som en namngiven folio med ordmängd och
tydlig markering av vilket dokument som är öppet. Kajen växlar dokument med
ett klick och ger direkta vägar till nytt dokument och hela dokumentytan.

## Två arbetsrum

1. **Skriv** visar endast det block som formuleras nu. Enter väver in blocket,
   Shift + Enter ger radbrytning och Ctrl eller Cmd + Z i ett tomt fält tar
   tillbaka det senast invävda blocket. Om blocket lades mitt i manuset
   återvävs det på samma plats.
2. **Vävbord** är ett sammanhållet redigeringsrum med två projektioner av
   samma blocklista:

   - **Lista** visar hela manuset som en linjär ryggrad i verklig läsordning.
     Rubriker, stycken och nivåer har olika form men texten förblir läsbar.
     Block redigeras direkt, Alt + pil flyttar dem och rubrikflytt tar med
     hela sektionen. Skrivsömmar mellan varje block placerar nästa nya block
     exakt där användaren väljer. S på ett fokuserat block öppnar sömmen efter
     blocket.
   - **Noder** visar samma block som namngivna textfragment. Den vertikala
     positionen är mjukt förankrad i läsordningen medan lexikala samband
     påverkar sidledsdragningen. Ett valt block kan rullas ut till ett
     redigeringsblad utan att nodfältet lämnas.

Valt block och fokus följer med mellan Lista och Noder. Webbläsare med stöd
för View Transitions låter blocket övergå mjukt mellan lägena, medan reducerad
rörelse ger ett omedelbart skifte.

En pågående direktredigering är en skyddad transaktion. Dokumentbyte,
linsbyte och arbetsrumsbyte väntar tills texten har sparats eller avbrutits,
och webbläsaren varnar om sidan stängs med osparad redigering.

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
  andas längre och bygger fraser av skrivtempo, ordform och meningar. Temat
  bevarar SkrivR-originalets kontinuerliga dubbelröst, subröst,
  konsonantklanger, långsamma valglid och reverbererande meningsekon.
- **Hard Fork** bevarar SkrivR-originalets generativa 125 BPM-produktion med
  bas, kick, hi-hat, snare, swing, ostinato, stereodelay och textstyrda fills.
  Ett nytt direktanslag hörs vid själva tangenten, medan det fylligare lagret
  fortfarande placeras på sequencerns rytmnät.

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
```
