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
3. **Struktur** är dokumentets ordningseditor. Block kan redigeras och flyttas
   med dragning eller knappar. När en rubrik flyttas följer hela dess sektion.

## Analys

Kohesionen beräknas med svensk tokenisering, stoppord, lätt suffixtrunkering,
TF/IDF och cosinuslikhet. Rubriker påverkar inte styckenas IDF. Små dokument
stabiliseras genom att IDF-vikterna krymps mot neutral vikt.

Analysen och ritningen är åtskilda. Varningsstatus bygger på den fullständiga
kohesionsmatrisen, medan Väven bara ritar ett begränsat antal trådar per nod.
Det hindrar ett visuellt kanttak från att skapa falska varningar.

VävR mäter lexikal återkoppling, alltså delade centrala ord. Det är inte ett
mått på full semantisk betydelse, argumentativ kvalitet eller om en text är
korrekt. Orange markering visas därför först när det finns minst fyra
brödtextblock och tillräckligt analysunderlag.

## Teknik

Applikationen är helt självbärande i `index.html` och har inga
körtidsberoenden eller byggsteg. Dokument och utkast sparas lokalt i
webbläsaren. Markdown kan importeras, kopieras och laddas ner.

Öppna `index.html` direkt eller kör en enkel lokal webbserver:

```bash
python3 -m http.server 8000
```

Den fristående modultestsviten körs med:

```bash
node vavr-test.mjs
```
