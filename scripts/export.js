// Makes the shortlist to share: one zip of the approved posts with a PDF, an
// all-in-one HTML page, the images and their captions. The review page's
// "Export shortlist" button does the same.
// Usage: npm run export              (newest batch, approved posts)
//        npm run export -- posts/2026-10-13
//        npm run export -- --all     (every post that wasn't skipped)
import path from 'node:path';
import { ROOT, findBatch } from './lib/batch.js';
import { buildShortlist, EMAIL_LIMIT_MB } from './lib/shortlist.js';

const args = process.argv.slice(2);
const dir = findBatch(args.find((arg) => !arg.startsWith('--')));

try {
  const { zipPath, count, megabytes } = await buildShortlist(dir, { all: args.includes('--all') });
  console.log(`Exported ${count} ${count === 1 ? 'post' : 'posts'} to ${path.relative(ROOT, zipPath)} (${megabytes.toFixed(1)} MB).`);
  if (megabytes > EMAIL_LIMIT_MB - 1) {
    console.log(`That's close to or over the ${EMAIL_LIMIT_MB} MB email limit: export fewer posts, or share it as a link.`);
  } else {
    console.log('Attach it to an email.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
