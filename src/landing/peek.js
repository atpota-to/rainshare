// Under the landing's sign-in, the way down to the real board: the faces of whoever's asking,
// how many asks are open and what they are, and an arrow. The garden above it is made up, so
// this is what says there are real ones, and that they're just under it.
import { nounOf } from '../../core/words.js';

/** What's open, in a few words: "1 idea to help with", "2 projects…", "5 ideas and projects…". */
export function peekWords(seeds){
  const n = seeds?.length || 0;
  if (!n) return '';
  const ideas = seeds.filter(s => nounOf(s) === 'idea').length;
  if (ideas && ideas < n) return `${n} ideas and projects to help with`;
  const noun = ideas ? 'idea' : 'project';
  return `${n} ${noun}${n > 1 ? 's' : ''} to help with`;
}

/** Whose faces to show: the first few people asking, each once, in the board's order. */
export function peekPeople(items, most = 3){
  const seen = new Map();
  for (const it of items || []) if (!seen.has(it.repo)) seen.set(it.repo, it.author || { did: it.repo });
  return [...seen.values()].slice(0, most);
}
