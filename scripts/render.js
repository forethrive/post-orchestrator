// Draws the images for a batch with Post Studio.
// Usage: npm run render              (newest batch)
//        npm run render -- posts/2026-10-13
import path from 'node:path';
import { ROOT, findBatch } from './lib/batch.js';
import { renderBatch } from './lib/draw.js';

const dir = findBatch(process.argv[2]);
const count = await renderBatch(dir);
console.log(`\n${count} image${count === 1 ? "" : "s"} saved in ${path.relative(ROOT, dir)}.`);
