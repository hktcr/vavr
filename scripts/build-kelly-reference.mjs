#!/usr/bin/env node

/*
 * Bygger VävR:s kompakta, lokala frekvensreferens från Språkbankens
 * Kelly-lista. Källfilen hämtas separat från resursens officiella sida:
 * https://spraakbanken.gu.se/resurser/kelly
 *
 * Datacitering:
 * Volodina, Elena & Johansson Kokkinakis, Sofie (2017). Kelly.
 * https://doi.org/10.23695/6act-rs25
 * Licens: CC-BY-4.0
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcePath = resolve(process.argv[2] || '/tmp/kelly.xml');
const targetPath = resolve(process.argv[3] || 'ordekon-kelly.js');
const xml = readFileSync(sourcePath, 'utf8');

const SUFFIXES = [
  'andet', 'ernas', 'arnas', 'ornas', 'andes', 'ande', 'erna', 'arna', 'orna',
  'ades', 'aren', 'eten', 'ers', 'ens', 'ets', 'arn', 'ade', 'are', 'ast',
  'het', 'en', 'et', 'ar', 'er', 'or', 'na', 'ns', 'as', 'es', 's', 't', 'a'
];

function normalizeWord(word) {
  const value = word.toLocaleLowerCase('sv-SE');
  for (const suffix of SUFFIXES) {
    if (value.length - suffix.length >= 4 && value.endsWith(suffix)) {
      return value.slice(0, -suffix.length);
    }
  }
  return value;
}

const frequencies = new Map();
for (const match of xml.matchAll(/<LexicalEntry>([\s\S]*?)<\/LexicalEntry>/g)) {
  const entry = match[1];
  const writtenForm = entry.match(/att="writtenForm" val="([^"]+)"/)?.[1];
  const source = entry.match(/att="source" val="([^"]+)"/)?.[1];
  const partOfSpeech = entry.match(/att="partOfSpeech" val="([^"]+)"/)?.[1];
  const rawFrequency = Number(entry.match(/att="rawFreq" val="([^"]+)"/)?.[1]);
  const wordsPerMillion = Number(
    (entry.match(/att="wpm" val="([^"]+)"/)?.[1] || '').replace(',', '.')
  );

  /* Kelly innehåller manuella tillskott och egennamn med platshållarvärden.
     Ordekon använder endast belagda SweWaC-poster med rimlig WPM. */
  if (
    !writtenForm ||
    source !== 'SweWaC' ||
    !rawFrequency ||
    !Number.isFinite(wordsPerMillion) ||
    wordsPerMillion > 50000 ||
    partOfSpeech === 'pm' ||
    partOfSpeech === 'nl' ||
    !/^\p{L}+(?:[-’']\p{L}+)*$/u.test(writtenForm)
  ) continue;

  const key = normalizeWord(writtenForm);
  frequencies.set(key, Math.max(wordsPerMillion, frequencies.get(key) || 0));
}

const sorted = Object.fromEntries(
  [...frequencies].sort((a, b) => a[0].localeCompare(b[0], 'sv'))
);

const header = `/* VävR: lokal svensk frekvensreferens för Ordekon.\n` +
  `   Källa: Swedish Kelly-list, Språkbanken Text, SweWaC 114 miljoner ord.\n` +
  `   DOI: https://doi.org/10.23695/6act-rs25\n` +
  `   Licens: CC-BY-4.0. Genererad, redigera inte för hand. */\n`;
const body = `(function (root) {\n  'use strict';\n  root.VAVR_KELLY_WPM = Object.freeze(${JSON.stringify(sorted)});\n})(typeof window !== 'undefined' ? window : globalThis);\n`;

writeFileSync(targetPath, header + body, 'utf8');
console.log(`Skrev ${frequencies.size} normaliserade frekvensposter till ${targetPath}`);
