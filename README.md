# VävR

VävR är ett lokalt skrivverktyg som gör textens struktur och lexikala
återkoppling synlig. Varje committat stycke blir en nod i en levande väv.

## Tre arbetsrum

1. **Skriv** visar endast det block som formuleras nu. Enter väver in blocket,
   Shift + Enter ger radbrytning och Ctrl eller Cmd + Z i ett tomt fält tar
   tillbaka senaste noden.
2. **Väven** visar stycken, rubrikhierarki, dokumentordning och viktade
   lexikala kopplingar. En vald nod öppnar ett sambandskort med full text,
   närmiljö, delade ord och försiktiga omvävningsförslag.
3. **Struktur** är en hierarkisk sektionstavla. Roten visar dokumentets
   huvudsektioner som kort. Varje rubrikkort öppnar nästa nivå, där direkta
   stycken och undersektioner visas i separata grid. När en rubrik flyttas
   följer hela dess sektion.

## Skrivstöd

Dokumentmål kan räknas i ord eller texttecken inklusive blanksteg. Målet är
frivilligt, sparas per dokument och räknar endast committad text.

Skrivpass kan köras i 15, 25 eller 45 minuter eller med en egen längd.
Timern kan pausas, fortsättas och döljas till en neutral statusrad. När ett
pass är slut kan användaren själv välja en femminuterspaus, ett nytt pass
eller att avsluta. Ingenting startar automatiskt.

## Ljudrum

Sju frivilliga ljudlandskap kan skapas direkt i webbläsaren. Fyra är stilla:

- **Gläntan** ger mjuk luft, varma grundtoner och sällsynta ljusglimtar.
- **Regnväv** ger ett jämnt regnfält som kan maskera ljud i omgivningen.
- **Djupström** är ett mörkt, neutralt brus utan melodi eller tydlig rytm.
- **Nattljus** ger långsamma övertoner och ett mer stämningsfullt rum.

Tre textlevande landskap förändras långsamt med texten:

- **Ordfält** följer ordlängd, vokalbalans och meningsrytm.
- **Sambandsväv** följer styckenas uppmätta lexikala återkoppling.
- **Strukturklang** följer rubriknivåer, styckeantal och dokumentets tillväxt.

Ett separat skrivmaskinslager kan kombineras med vilket ljudlandskap som
helst. Det har fyra karaktärer: Mekanisk, Reseskrivare, Elektrisk och Dämpad.
Bokstäver, mellanslag, backsteg och Enter får skilda syntetiserade svar.

Ljud startar endast efter ett uttryckligt val. Tema, volym och valfri
skrivrespons sparas, men uppspelning återupptas aldrig automatiskt efter
omladdning. Alla ljud syntetiseras med Web Audio API utan ljudfiler eller
nätverksanrop och fungerar därför även offline.

## Analys

Kohesionen beräknas med svensk tokenisering, stoppord, lätt suffixtrunkering,
TF/IDF och cosinuslikhet. Rubriker påverkar inte styckenas IDF. Små dokument
stabiliseras genom att IDF-vikterna krymps mot neutral vikt.

Analysen och ritningen är åtskilda. Varningsstatus bygger på den fullständiga
kohesionsmatrisen, medan Väven bara ritar ett begränsat antal trådar per nod.
Det hindrar ett visuellt kanttak från att skapa falska varningar.

I Väven visas dokumentordning med en sammanhängande gråblå linje, lexikal
återkoppling med en tydligt streckad cyan linje och rubrikhierarki med en
prickad mässingslinje. Teckenförklaringen visar alla tre.

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
