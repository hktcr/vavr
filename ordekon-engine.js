/* VävR: Ordekon.
   Analysen letar efter återkommande ord, exakta fraser och meningsstarter.
   Storleken är en uppmärksamhetssignal, inte ett kvalitetsbetyg.

   Den svenska frekvenspriorn kommer från Kelly-listan och används endast
   lokalt. Priorvärdet utjämnas kraftigt eftersom genre, fackspråk, namn,
   motiv och berättarröst kan göra en upprepning helt avsiktlig. */

(function (root) {
  'use strict';

  const REFERENCE = root.VAVR_KELLY_WPM || Object.freeze({});
  const REFERENCE_FLOOR_WPM = .5;
  const COMMON_FORM_WPM = 5000;
  const PRIOR_WORDS = 500;
  const CLUSTER_WINDOW = 100;
  const MAX_ITEMS = 72;

  const FUNCTION_WORD_LIST = (
    'och att det som en ett på är av för med till den har de inte om men var jag sig så vi man kan när han hon hans hennes ' +
    'från vid eller ska skulle kunde blir blev vara varit vad vem vilken vilket vilka där här hur alla allt andra annan annat ' +
    'bara bli både denna detta dessa dig din ditt dina du efter ej emot ena endast få får fick fram före ge genom gick gör göra ' +
    'hade heller honom icke ingen inget inom ju just kunna kunnat lika lilla lite längre mellan mera mest mig min mitt mina mot ' +
    'mycket ner nog nu någon något några oss över redan sedan sin sitt sina själv skall ta tar tog under upp ut utan varje vars ' +
    'vart vidare viss vår vårt våra än ändå ännu åt också samma sådan sådant sådana trots därför eftersom medan'
  ).split(/\s+/);

  const SUFFIXES = [
    'andet', 'ernas', 'arnas', 'ornas', 'andes', 'ande', 'erna', 'arna', 'orna',
    'ades', 'aren', 'eten', 'ers', 'ens', 'ets', 'arn', 'ade', 'are', 'ast',
    'het', 'en', 'et', 'ar', 'er', 'or', 'na', 'ns', 'as', 'es', 's', 't', 'a'
  ];

  const WORD_PATTERN = /[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu;
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function normalizeWord(word) {
    const value = String(word || '').toLocaleLowerCase('sv-SE');
    for (const suffix of SUFFIXES) {
      if (value.length - suffix.length >= 4 && value.endsWith(suffix)) {
        return value.slice(0, -suffix.length);
      }
    }
    return value;
  }

  const FUNCTION_WORDS = new Set(FUNCTION_WORD_LIST.map(normalizeWord));

  function hashText(text) {
    let hash = 2166136261;
    for (const character of String(text || '')) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function tokensIn(text) {
    const tokens = [];
    const value = String(text || '');
    WORD_PATTERN.lastIndex = 0;
    let match;
    while ((match = WORD_PATTERN.exec(value))) {
      const surface = match[0];
      tokens.push({
        surface,
        key: normalizeWord(surface),
        start: match.index,
        end: match.index + surface.length
      });
    }
    return tokens;
  }

  function sentenceRanges(text) {
    const value = String(text || '');
    if (!value.trim()) return [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('sv', { granularity: 'sentence' });
      return [...segmenter.segment(value)]
        .map(item => ({ start: item.index, end: item.index + item.segment.length }))
        .filter(range => value.slice(range.start, range.end).trim());
    }
    const ranges = [];
    const pattern = /[^.!?…]+(?:[.!?…]+|$)/g;
    let match;
    while ((match = pattern.exec(value))) {
      if (match[0].trim()) ranges.push({ start: match.index, end: match.index + match[0].length });
    }
    return ranges;
  }

  function surfaceWinner(forms, fallback) {
    let best = fallback || '';
    let bestCount = -1;
    for (const [surface, count] of forms) {
      if (count > bestCount || (count === bestCount && surface.localeCompare(best, 'sv') < 0)) {
        best = surface;
        bestCount = count;
      }
    }
    return best;
  }

  function clusterFor(occurrences, totalWords) {
    if (occurrences.length < 2 || totalWords <= CLUSTER_WINDOW) {
      return { value: 0, count: occurrences.length, window: Math.min(CLUSTER_WINDOW, totalWords) };
    }
    const positions = occurrences.map(item => item.globalToken).sort((a, b) => a - b);
    let left = 0;
    let maximum = 1;
    for (let right = 0; right < positions.length; right++) {
      while (positions[right] - positions[left] >= CLUSTER_WINDOW) left += 1;
      maximum = Math.max(maximum, right - left + 1);
    }
    const expected = occurrences.length * Math.min(1, CLUSTER_WINDOW / totalWords);
    const value = clamp(
      (maximum - expected) / Math.max(1, occurrences.length - expected),
      0,
      1
    );
    return { value, count: maximum, window: CLUSTER_WINDOW };
  }

  function frequencySignal(key, count, totalWords) {
    const inReference = Object.prototype.hasOwnProperty.call(REFERENCE, key);
    const commonFallback = !inReference && FUNCTION_WORDS.has(key);
    const referenceWpm = inReference
      ? Number(REFERENCE[key])
      : (commonFallback ? COMMON_FORM_WPM : REFERENCE_FLOOR_WPM);
    const referenceRate = referenceWpm / 1000000;
    const smoothedRate = (count + referenceRate * PRIOR_WORDS) / (totalWords + PRIOR_WORDS);
    const ratio = smoothedRate / referenceRate;
    const logRatio = Math.log2(Math.max(ratio, 1e-9));
    return {
      referenceWpm,
      ratio,
      logRatio,
      weight: clamp(.25 + Math.max(0, logRatio), .25, 4.5),
      inReference,
      commonFallback
    };
  }

  function buildDocument(blocks) {
    const allTokens = [];
    const sentences = [];
    const safeBlocks = Array.isArray(blocks) ? blocks : [];

    safeBlocks.forEach((block, blockIndex) => {
      const text = String(block?.text || '');
      const blockTokens = tokensIn(text);
      blockTokens.forEach(token => {
        token.blockId = block.id;
        token.blockIndex = blockIndex;
        token.blockKind = block.kind || 'paragraph';
        token.globalToken = allTokens.length;
        allTokens.push(token);
      });

      for (const range of sentenceRanges(text)) {
        const sentenceTokens = blockTokens.filter(token => token.start >= range.start && token.end <= range.end);
        if (sentenceTokens.length) {
          sentences.push({
            blockId: block.id,
            blockIndex,
            blockKind: block.kind || 'paragraph',
            start: range.start,
            end: range.end,
            tokens: sentenceTokens
          });
        }
      }
    });

    return { blocks: safeBlocks, tokens: allTokens, sentences };
  }

  function analyzeWords(document) {
    const groups = new Map();
    for (const token of document.tokens) {
      let group = groups.get(token.key);
      if (!group) {
        group = { key: token.key, occurrences: [], forms: new Map() };
        groups.set(token.key, group);
      }
      group.occurrences.push({
        blockId: token.blockId,
        blockIndex: token.blockIndex,
        blockKind: token.blockKind,
        start: token.start,
        end: token.end,
        surface: token.surface,
        globalToken: token.globalToken
      });
      const formKey = token.surface.toLocaleLowerCase('sv-SE');
      group.forms.set(formKey, (group.forms.get(formKey) || 0) + 1);
    }

    const findings = [];
    for (const group of groups.values()) {
      const count = group.occurrences.length;
      if (count < 2) continue;
      const cluster = clusterFor(group.occurrences, document.tokens.length);
      const frequency = frequencySignal(group.key, count, document.tokens.length);
      const blocks = [...new Set(group.occurrences.map(item => item.blockId))];
      const score = Math.log2(1 + count) *
        frequency.weight *
        (count / (count + 3)) *
        (1 + .25 * cluster.value);
      findings.push({
        id: 'word|' + group.key,
        type: 'word',
        key: group.key,
        label: surfaceWinner(group.forms, group.key),
        forms: [...group.forms].sort((a, b) => b[1] - a[1]).map(item => item[0]),
        count,
        blockCount: blocks.length,
        blocks,
        occurrences: group.occurrences,
        cluster,
        frequency,
        score,
        stableOrder: hashText('word|' + group.key)
      });
    }
    return findings.sort((a, b) => b.score - a.score || b.count - a.count).slice(0, MAX_ITEMS);
  }

  function collectSequences(document, type) {
    const groups = new Map();
    for (const sentence of document.sentences) {
      const lengths = type === 'starter'
        ? [2, 3, 4].filter(length => sentence.tokens.length >= length)
        : [2, 3, 4, 5];
      for (const length of lengths) {
        const starts = type === 'starter'
          ? [0]
          : Array.from({ length: Math.max(0, sentence.tokens.length - length + 1) }, (_, index) => index);
        for (const startIndex of starts) {
          const sequence = sentence.tokens.slice(startIndex, startIndex + length);
          if (sequence.length !== length) continue;
          const key = sequence.map(token => token.key).join(' ');
          const id = type + '|' + key;
          let group = groups.get(id);
          if (!group) {
            group = { id, type, key, length, occurrences: [], forms: new Map() };
            groups.set(id, group);
          }
          const surface = sequence.map(token => token.surface).join(' ');
          const first = sequence[0];
          const last = sequence[sequence.length - 1];
          group.occurrences.push({
            blockId: sentence.blockId,
            blockIndex: sentence.blockIndex,
            blockKind: sentence.blockKind,
            start: first.start,
            end: last.end,
            surface,
            globalToken: first.globalToken
          });
          const formKey = surface.toLocaleLowerCase('sv-SE');
          group.forms.set(formKey, (group.forms.get(formKey) || 0) + 1);
        }
      }
    }

    const candidates = [];
    for (const group of groups.values()) {
      const count = group.occurrences.length;
      const minimum = group.length <= 3 ? 3 : 2;
      if (count < minimum) continue;
      const keys = group.key.split(' ');
      const contentRatio = keys.filter(key => !FUNCTION_WORDS.has(key)).length / keys.length;
      const cluster = clusterFor(group.occurrences, document.tokens.length);
      const blocks = [...new Set(group.occurrences.map(item => item.blockId))];
      const score = Math.log2(1 + count) *
        group.length *
        (.35 + .65 * contentRatio) *
        (1 + .25 * cluster.value);
      candidates.push({
        id: group.id,
        type,
        key: group.key,
        label: surfaceWinner(group.forms, group.key),
        length: group.length,
        count,
        blockCount: blocks.length,
        blocks,
        occurrences: group.occurrences,
        cluster,
        contentRatio,
        score,
        stableOrder: hashText(group.id)
      });
    }

    /* Behåll den längsta frasen när en kortare träff alltid är innesluten i
       samma längre träff. Det hindrar ett femords-eko från att bli fyra
       nästan identiska rader i gränssnittet. */
    const selected = [];
    for (const candidate of candidates.sort((a, b) => b.length - a.length || b.score - a.score)) {
      const covered = selected.some(longer =>
        longer.length > candidate.length &&
        candidate.occurrences.every(occurrence =>
          longer.occurrences.some(other =>
            other.blockId === occurrence.blockId &&
            other.start <= occurrence.start &&
            other.end >= occurrence.end
          )
        )
      );
      if (!covered) selected.push(candidate);
    }
    return selected.sort((a, b) => b.score - a.score || b.length - a.length).slice(0, MAX_ITEMS);
  }

  function analyze(blocks) {
    const document = buildDocument(blocks);
    return {
      words: analyzeWords(document),
      phrases: collectSequences(document, 'phrase'),
      starters: collectSequences(document, 'starter'),
      totalWords: document.tokens.length,
      blockCount: document.blocks.length,
      insufficient: document.tokens.length < 30,
      method: {
        clusterWindow: CLUSTER_WINDOW,
        priorWords: PRIOR_WORDS,
        commonFormWpm: COMMON_FORM_WPM,
        referenceEntries: Object.keys(REFERENCE).length,
        referenceName: 'Swedish Kelly-list',
        referenceDoi: 'https://doi.org/10.23695/6act-rs25',
        referenceLicense: 'CC-BY-4.0'
      }
    };
  }

  root.Ordekon = Object.freeze({
    analyze,
    normalizeWord,
    tokensIn,
    sentenceRanges,
    frequencySignal,
    constants: Object.freeze({
      clusterWindow: CLUSTER_WINDOW,
      priorWords: PRIOR_WORDS,
      minimumWords: 30
    })
  });
})(typeof window !== 'undefined' ? window : globalThis);
