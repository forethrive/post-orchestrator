// Checks every post in a batch against the brand guide and the "no invented
// facts" rules, and lists anything that needs fixing.
// Usage: npm run validate              (newest batch)
//        npm run validate -- posts/2026-10-13
import path from 'node:path';
import { ROOT, findBatch, readBatch } from './lib/batch.js';
import { checkPost, loadFactUrls } from './lib/checks.js';

const dir = findBatch(process.argv[2]);
const { posts } = readBatch(dir);
const factUrls = loadFactUrls();
const seenIds = new Set();
let failing = 0;

for (const post of posts) {
  const problems = checkPost(post, factUrls);
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
