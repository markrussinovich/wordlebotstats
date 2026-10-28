import { mkdir, writeFile } from 'node:fs/promises';

const revision = '20f5cc9b3f0ccc8ce45d814c532b7c2031bba31c';
const base = `https://raw.githubusercontent.com/dwyl/english-words/${revision}`;
const directory = new URL('../src/solver/data/', import.meta.url);
const read = async (name) => {
  const response = await fetch(`${base}/${name}`);
  if (!response.ok) throw new Error(`Dictionary download failed: ${response.status}`);
  return response.text();
};
const [text, license] = await Promise.all([read('words_alpha.txt'), read('LICENSE.md')]);
const words = [...new Set(text.toUpperCase().split(/\s+/).filter(word => /^[A-Z]{5}$/.test(word)))].sort();
if (words.length < 10000 || !words.includes('SLATE')) throw new Error('Unexpected dictionary contents');
await mkdir(directory, { recursive: true });
await writeFile(new URL('words.json', directory), `${JSON.stringify(words)}\n`);
await writeFile(new URL('LICENSE.txt', directory), license);
console.log(`Generated ${words.length} five-letter words from dwyl/english-words@${revision}`);
