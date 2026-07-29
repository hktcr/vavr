# KODDOKUMENTATION: VävR

**Typ:** Webbapplikation (HTML + ES-moduler + Vanilla CSS)  
**Skapad:** 2026-07-29  
**Status:** 🟢 Produktion / GitHub Pages  
**Deploy:** [hktcr.github.io/vavr](https://hktcr.github.io/vavr/)

---

## Syfte

VävR är ett skrivverktyg som gör textens sammanhang och lexikala kohesion synlig medan du skriver. Varje stycke bildar en nod i en graf, och kanterna representerar sekvensordning samt lexikal kohesion (beräknad med tf-idf och cosinuslikhet). VävR ersätter inte SkrivR, utan erbjuder ett specialiserat skrivstöd för struktur, kohesion och röda tråden.

## Vetenskaplig grund & metodik

- **Lexikal kohesion:** Baseras på Halliday och Hasans modell (*Cohesion in English*, 1976) samt ordöverlapp mellan textblock (Hearst, *TextTiling*, 1997).
- **Beräkning:** Standard tf-idf med cosinuslikhet och utjämnad idf: `idf = log(1 + N / df)`.
- **Trunkering:** `normalisera()` tillämpar en lätt svensk suffixtrunkering som heuristik för ordstammar.
- **Formulering:** Metoden mäter lexikal kohesion. Visualiseringen är en designidé byggd på beprövad mätning (påstår ej oberoende klinisk/pedagogisk utvärdering).

---

## Arkitektur & Moduler

| Fil | Roll | Beskrivning |
|---|---|---|
| `index.html` | Huvudskal & UI | HTML5-skal, nätverksrendering på canvas/buttons, 4 lägen, sidopanel, kortkommandon, tvåtaktshantering |
| `vavr-tokens.css` | Designsystem | CSS Custom Properties, färgpalett, komponentstilar och vyväxling (`data-lage`) |
| `vavr-dokument.js` | Datamodell | Parse från/till Markdown, blockmodell (`id`, `typ`, `niva`, `text`, `kommentarer`), sektioner, ägarskap, blockflytt |
| `vavr-kohesion.js` | Kohesionsanalys | Tokenisering, stoppordslista (`STOPPORD`), suffixtrunkering, idf-bygge, cosinus-likhet, grafer (`berakna()`), ordlista |
| `vavr-textcontext.js` | TextContext | Tvåtaktsskanning för text- och vokalananalys. Levererar kontraktet `getStats()` till ljudmotorerna |
| `vavr-test.mjs` | Testsvit | 87 automatiska tester för dokumentmodellen, tokeniseringen, kohesionen och TextContext |
| `valsang-engine.js` | Ljudmotor | Continuous ambient audio (Valsång) från SkrivBord |
| `skogsklang-engine.js` | Ljudmotor | Harmonisk skogsklang-ackordmotor från SkrivBord |
| `hardfork-engine.js` | Ljudmotor | Rytmisk meningsdriven ljudmotor (korrigerad `stats.words`) |
| `space-engine.js` | Ljudmotor | Analogsynt/Lydisk ljudmotor (korrigerad `stats.words`) |
| `manifest.webmanifest` | PWA | Web App Manifest för installering |
| `KODDOKUMENTATION.md` | Dokumentation | Denna fil |

---

## Datamodell (Single Source of Truth)

Single Source of Truth är **Markdown-strängen**. Nätverkskanter, ordlista och nodpositioner lagras aldrig – de beräknas dynamiskt vid laddning.

```js
Block = {
  id: 'b-<base36>-<n>',
  typ: 'rubrik' | 'stycke',
  niva: 1..6 | null,
  text: '...',
  kommentarer: [ { id, text, skapad } ]
}

Dokument = {
  id, titel,
  block: [ Block ],
  skapad, andrad,
  ljudtema: 'inget' | 'valsang' | 'skogsklang' | 'hardfork' | 'space',
  doldaOrd: [ 'ord', ... ],
  skrivmal: { typ: 'ord'|'tecken', varde: 800 } | null,
  timer: { minuter: 25, startad: null } | null
}
```

### localStorage

```
vavr-dokument   JSON-array av Dokument
vavr-aktivt     id för aktivt dokument
vavr-inst       { accentfarg, typsnitt, textstorlek, pausMs, troskel, maxPerNod, tangentljud }
```

---

## De fyra lägena (`data-lage`)

1. **Raden (`data-lage="raden"`):** Skrivläge med vertikalt centrerat `<textarea>` med autohöjd. De två föregående blocken visas i en opacitetstrappa ovanför.
2. **Väven (`data-lage="vaven"`):** Nätverksvy. Sekvenskanter ritas i full opacitet på `<canvas id="vaven">`, kohesionskanter skalas efter vikt. Noder är klickbara `<button>`-element med `transform`. Rubrikgravitation drar block mot sin ägarrubrik.
3. **Trappan (`data-lage="trappan"`):** Dispositionsvy och läsläge. Tre utfällningssteg (`0` rubriker, `1` ingresser, `2` hela texten). HTML5 Drag-and-drop för omordning av stycken och hela sektioner med live-kohesionsindikator under dragning.
4. **Studion (`data-lage="studion"`):** Helskärmsredigering av ett enskilt block med svaga grannblock och blockbundna kommentarer.

---

## Tangentbordsgenvägar

| Tangent | Funktion |
|---|---|
| `Enter` | Commit av skrivfältet i Raden, analysera & väck simulering |
| `Shift+Enter` | Radbrytning i samma block |
| `Pil upp` (pos 0) | Lyft föregående block tillbaka till skrivfältet |
| `Pil ner` | Släpp lyft block och gå till nästa |
| `Escape` | Släpp lyft block / stäng Studion / stäng sidopanel |
| `Cmd/Ctrl+1..4` | Byt läge (Raden, Väven, Trappan, Studion) |
| `Cmd/Ctrl+B` | Öppna / stäng sidopanel |
| `Cmd/Ctrl+S` | Ladda ner aktivt dokument som `.md` |
| `Cmd/Ctrl+Shift+C` | Kopiera markdown till urklipp |

---

## Tillgänglighet (a11y)

- Canvasen har `aria-hidden="true"`. Noderna är interaktiva `<button>`-element med utförliga `aria-label`.
- Alla klickytor uppfyller minst 44x44px.
- `:focus-visible` har tydliga fokusringar i `--ljus`.
- Färg är aldrig ensam infobärare (ensamma noder har t.ex. både avvikande färg och saknad kant; flödesbrott visas med dubbel ring).
- `prefers-reduced-motion: reduce` inaktiverar automatisk kraftsimuleringsdrift och vyövergångar.

---

*gAIa 🌲 2026-07-30*
