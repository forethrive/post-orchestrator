// Checks each fact in the research brief against the page the Research agent
// read. This is plain code, not AI: the quote must appear on the page word for
// word, and every number in the claim must appear in the quote. Facts that
// fail are dropped, so a model can't slip in a number it made up.
import { pageKey } from './research-tools.js';

const normalise = (text) =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

// Numbers such as 46, 5,179 or 1.4, leaving out years like 2025, which often
// appear in a claim without being in the quote.
const numbersIn = (text) =>
  (text.match(/\d[\d,.]*\d|\d/g) ?? []).filter((n) => !/^(19|20)\d\d$/.test(n));

export function verifyFacts(facts, pages) {
  const verified = [];
  const rejected = [];
  for (const fact of facts) {
    const page = pages.get(pageKey(fact.url));
    const quote = normalise(fact.quote);
    let reason = null;
    if (!page) reason = "its page wasn't read";
    else if (quote.length < 20) reason = 'the quote is too short to check';
    else if (!normalise(page).includes(quote)) reason = "the quote isn't on the page";
    else if (numbersIn(fact.claim).some((n) => !quote.includes(n))) reason = "a number in the claim isn't in the quote";

    if (reason) rejected.push({ ...fact, reason });
    else verified.push(fact);
  }
  return { verified, rejected };
}
