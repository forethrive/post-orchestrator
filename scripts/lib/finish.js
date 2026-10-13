// The last steps shared by npm run generate and npm run polish: number and
// save the posts, draw the images, and open the review page.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, today, newBatchDir, writeBatch } from './batch.js';
import { renderBatch } from './draw.js';

// files: any extra files to save in the batch folder, as { name: content }.
export async function saveDrawAndReview({ posts, generator, files = {}, review = true }) {
  // Number the posts 01, 02 and so on, with no gaps.
  const numbered = posts.map((post, i) => ({ ...post, id: String(i + 1).padStart(2, '0') }));
  const dir = newBatchDir();
  writeBatch(dir, { createdAt: today(), generator, posts: numbered });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);

  const what = numbered.length === 1 ? '1 post' : `${numbered.length} posts`;
  console.log(`\nSaved ${what} in ${path.relative(ROOT, dir)}. Drawing the images…`);
  await renderBatch(dir);

  if (review) {
    console.log('');
    spawn(process.execPath, [path.join(ROOT, 'scripts', 'review.js'), dir], { stdio: 'inherit' });
  }
  return dir;
}
