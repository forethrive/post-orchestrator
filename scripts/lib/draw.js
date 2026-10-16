// Draws each post's image with Post Studio itself, in a hidden Chrome window,
// so generated images look exactly like ones made by hand.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { ROOT, readBatch, imageFile } from './batch.js';

export async function renderBatch(dir) {
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
  return posts.length;
}
