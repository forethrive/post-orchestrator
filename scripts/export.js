// Makes what gets shared from a batch. The review page's "Export shortlist"
// button does the same as the first form.
// Usage: npm run export              (newest batch: approved posts as one zip)
//        npm run export -- posts/2026-10-13
//        npm run export -- --all     (zip of every post that wasn't skipped)
//        npm run export -- --drafts  (every post as a PDF and an HTML page, for
//                                     the weekly email: python3 -m agents.mail)
import path from 'node:path';
import { ROOT, findBatch } from './lib/batch.js';
import { buildShortlist, buildDrafts, EMAIL_LIMIT_MB } from './lib/shortlist.js';

const args = process.argv.slice(2);
const dir = findBatch(args.find((arg) => !arg.startsWith('--')));
const plural = (n) => `${n} ${n === 1 ? 'post' : 'posts'}`;

try {
  if (args.includes('--drafts')) {
    const { pdfPath, htmlPath, count, megabytes } = await buildDrafts(dir);
    console.log(`Exported ${plural(count)} to ${path.relative(ROOT, pdfPath)} and ${path.basename(htmlPath)} (${megabytes.toFixed(1)} MB).`);
  } else {
    const { zipPath, count, megabytes } = await buildShortlist(dir, { all: args.includes('--all') });
    console.log(`Exported ${plural(count)} to ${path.relative(ROOT, zipPath)} (${megabytes.toFixed(1)} MB).`);
    if (megabytes > EMAIL_LIMIT_MB - 1) {
      console.log(`That's close to or over the ${EMAIL_LIMIT_MB} MB email limit: export fewer posts, or share it as a link.`);
    } else {
      console.log('Attach it to an email.');
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
