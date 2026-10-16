// Checks every post in a batch against the brand guide and the "no invented
// facts" rules, and lists anything that needs fixing.
// Usage: npm run validate              (newest batch)
//        npm run validate -- posts/2026-10-13
//        npm run validate -- posts/2026-10-13 --json
// --json prints { "problems": { "01": [...] } } for programs such as the
// Python agents, which use this same checker.
import path from 'node:path';
import { ROOT, findBatch, readBatch } from './lib/batch.js';
import { checkPost, loadAllowedUrls } from './lib/checks.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const dir = findBatch(args.find((arg) => !arg.startsWith('--')));
const { posts } = readBatch(dir);
const factUrls = loadAllowedUrls(dir);
const seenIds = new Set();
const results = {};
let failing = 0;

for (const post of posts) {
  const problems = checkPost(post, factUrls);
  if (seenIds.has(post.id)) problems.push(`id "${post.id}" is used more than once`);
  seenIds.add(post.id);
  results[post.id] = problems;
  if (problems.length > 0) failing++;

  if (asJson) continue;
  if (problems.length > 0) {
    console.log(`✗ ${post.id} ${post.type}: ${post.image?.headline ?? ''}`);
    for (const problem of problems) console.log(`    - ${problem}`);
  } else {
    console.log(`✓ ${post.id} ${post.type}: ${post.image.headline}`);
  }
}

if (asJson) {
  console.log(JSON.stringify({ problems: results }));
} else {
  console.log(`\n${posts.length - failing} of ${posts.length} posts pass (${path.relative(ROOT, dir)}).`);
  process.exitCode = failing > 0 ? 1 : 0;
}
