// Checks every post in a batch against the brand guide and the "no invented
// facts" rules, and lists anything that needs fixing.
// Usage: npm run validate              (newest batch)
//        npm run validate -- posts/2026-10-13
import path from 'node:path';
import { ROOT, findBatch, readBatch } from './lib/batch.js';
import {
  POST_TYPES,
  REAL_EVENT_TYPES,
  LIMITS,
  HASHTAGS,
  BANNED_WORDS,
  SITE,
  STATUSES,
} from '../brand/rules.js';

const EMOJI = /\p{Extended_Pictographic}/u;
const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

function checkPost(post) {
  const problems = [];
  const image = post.image ?? {};
  const caption = post.caption ?? {};

  function checkText(name, value, { required = false, maxChars, maxWords } = {}) {
    if (!value) {
      if (required) problems.push(`${name} is missing`);
      return;
    }
    if (maxChars && value.length > maxChars) {
      problems.push(`${name} is ${value.length} characters (limit ${maxChars})`);
    }
    if (maxWords && countWords(value) > maxWords) {
      problems.push(`${name} is ${countWords(value)} words (limit ${maxWords})`);
    }
  }

  if (!POST_TYPES.includes(post.type)) {
    problems.push(`type "${post.type}" isn't one of: ${POST_TYPES.join(', ')}`);
  }
  if (!STATUSES.includes(post.status)) {
    problems.push(`status must be one of: ${STATUSES.join(', ')}`);
  }

  // The image
  checkText('label', image.label, { required: true, ...LIMITS.label });
  checkText('big', image.big, LIMITS.big);
  checkText('headline', image.headline, { required: true, ...LIMITS.headline });
  checkText('sub', image.sub, LIMITS.sub);
  for (const field of ['label', 'big', 'headline', 'sub']) {
    if (EMOJI.test(image[field] ?? '')) problems.push(`${field} has an emoji (none inside images)`);
  }
  if (image.headline && /[A-Z]/.test(image.headline) && image.headline === image.headline.toUpperCase()) {
    problems.push('headline is in capitals (use sentence case)');
  }
  if (image.size && !['portrait', 'square'].includes(image.size)) {
    problems.push('size must be "portrait" or "square"');
  }
  if (post.type === 'Stat' && !image.big) problems.push('Stat posts need a big number');

  // The caption
  checkText('hook', caption.hook, { required: true, ...LIMITS.hook });
  const body = caption.body ?? [];
  if (body.length < LIMITS.bodyLines.min || body.length > LIMITS.bodyLines.max) {
    problems.push(
      `caption body has ${body.length} lines (${LIMITS.bodyLines.min} to ${LIMITS.bodyLines.max})`,
    );
  }
  checkText('action', caption.action, { required: true });
  const hashtags = caption.hashtags ?? [];
  if (hashtags.length > HASHTAGS.max) problems.push(`${hashtags.length} hashtags (at most ${HASHTAGS.max})`);
  for (const tag of hashtags) {
    if (!HASHTAGS.allowed.includes(tag)) problems.push(`${tag} isn't an allowed hashtag`);
  }
  const captionWords = [caption.hook, ...body, caption.action].join('\n');
  if (/https?:\/\/|forethrive\.(ai|com)/i.test(captionWords)) {
    problems.push('links go in the first comment, not the caption');
  }
  if (!post.firstComment?.includes(SITE)) problems.push(`firstComment must include ${SITE}`);

  // Facts: nothing invented
  const hasBacking = Boolean(post.fromIdea) || (post.sources ?? []).length > 0;
  if (REAL_EVENT_TYPES.includes(post.type) && !post.fromIdea) {
    problems.push(`${post.type} posts must come from brand/ideas.md (set fromIdea)`);
  }
  if (image.big && !hasBacking) problems.push('the big number needs a source or an idea behind it');
  const allText = [image.label, image.big, image.headline, image.sub, captionWords, post.firstComment].join(' ');
  if (/\d\s?%/.test(allText) && !hasBacking) problems.push('a percentage needs a source or an idea behind it');
  for (const source of post.sources ?? []) {
    if (!/^https?:\/\//.test(source.url ?? '')) problems.push(`source "${source.title}" needs a url`);
  }

  // Words to avoid
  const lowerText = allText.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lowerText.includes(word)) problems.push(`uses "${word}" (on the list of words to avoid)`);
  }

  return problems;
}

const dir = findBatch(process.argv[2]);
const { posts } = readBatch(dir);
const seenIds = new Set();
let failing = 0;

for (const post of posts) {
  const problems = checkPost(post);
  if (seenIds.has(post.id)) problems.push(`id "${post.id}" is used more than once`);
  seenIds.add(post.id);

  if (problems.length > 0) {
    failing++;
    console.log(`✗ ${post.id} ${post.type}: ${post.image?.headline ?? ''}`);
    for (const problem of problems) console.log(`    - ${problem}`);
  } else {
    console.log(`✓ ${post.id} ${post.type}: ${post.image.headline}`);
  }
}

console.log(`\n${posts.length - failing} of ${posts.length} posts pass (${path.relative(ROOT, dir)}).`);
process.exitCode = failing > 0 ? 1 : 0;
