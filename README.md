# VävR 🧵

**VävR** är ett skrivverktyg som gör textens sammanhang och lexikala kohesion synlig medan du skriver. Varje stycke bildar en nod i en graf, och kanterna speglar sekvensordning samt lexikal kohesion.

---

## 🌟 Grundidé & Metodik

VävR bygger på principen om den röda tråden – att kunskap och text inte ska fragmenteras. 

- **Lexikal kohesion:** Metoden vilar på etablerad textlingvistik (Halliday & Hasan, *Cohesion in English*, 1976) och ordöverlapp mellan textblock (Hearst, *TextTiling*, 1997).
- **Mätning:** Beräkningen tillämpar tf-idf och cosinuslikhet med en utjämnad idf-formel `idf = log(1 + N / df)` för stabil funktion även i korta dokument.
- **Suffixtrunkering:** Ordnormaliseringen i `vavr-kohesion.js` är en lätt svensk suffixtrunkering (en heuristik för ordstammar, inte en fullständig Snowball-stemmer).
- **Formulering:** Verktyget mäter lexikal kohesion. Visualiseringen är en designidé byggd på beprövad mätning (påstår inte oberoende klinisk eller pedagogisk utvärdering).

---

## 🚀 Lägen

1. **Raden (`Cmd+1`):** Fokusera på ett stycke i taget. Tidigare stycken visas i en svag opacitetstrappa ovanför.
2. **Väven (`Cmd+2`):** Interaktiv grafvisualisering. Sekvenskanter och kohesionskanter ritas i realtid med rubrikgravitation.
3. **Trappan (`Cmd+3`):** Disposition och läsläge med 3 utfällningsnivåer (Rubriker, Ingresser, Hela texten) samt Drag-and-drop med live-kohesionsmarkör.
4. **Studion (`Cmd+4`):** Helskärmsredigering av ett enskilt block med synliga grannblock och blockbundna kommentarer.

---

## 🎧 Generativa Ljudteman

Fyra generativa ljudmotorer (Valsång, Skogsklang, HardFork och Space Odyssey) ger dynamisk audio-respons i två takter.

---

## 🛠️ Bygg & Tester

Statisk webbapplikation utan byggsteg. Kör testerna i Node:

```bash
node vavr-test.mjs
```

---

*Utvecklad med gAIa 🌲 | GitHub Pages: [hktcr.github.io/vavr](https://hktcr.github.io/vavr/)*
