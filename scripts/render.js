// Draws each post's image with Post Studio itself, in a hidden Chrome window,
// so generated images look exactly like ones made by hand.
// Usage: npm run render              (newest batch)
//        npm run render -- posts/2026-10-13
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { ROOT, findBatch, readBatch, imageFile } from './lib/batch.js';

const dir = findBatch(process.argv[2]);
const { posts } = readBatch(dir);

// channel: 'chrome' uses the Google Chrome already installed on this Mac.
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(ROOT, 'post-studio.html')).href);

  for (const post of posts) {
    const dataUrl = await page.evaluate((fields) => window.renderPost(fields), post.image);
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(dir, imageFile(post)), png);
    console.log(`Drew ${imageFile(post)}  ${post.image.headline}`);
  }
} finally {
  await browser.close();
}

console.log(`\n${posts.length} images saved in ${path.relative(ROOT, dir)}.`);
