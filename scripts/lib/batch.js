// Helpers shared by the scripts: finding a batch folder, reading and saving its
// posts.json, and putting a caption together from its parts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const POSTS_DIR = path.join(ROOT, 'posts');

// The batch folder given on the command line, or else the newest one in posts/.
export function findBatch(arg) {
  if (arg) return path.resolve(arg);
  const batches = fs.existsSync(POSTS_DIR)
    ? fs
        .readdirSync(POSTS_DIR)
        .filter((name) => fs.existsSync(path.join(POSTS_DIR, name, 'posts.json')))
        .sort()
    : [];
  if (batches.length === 0) {
    console.error('There are no batches in posts/ yet. Generate one first (see README.md).');
    process.exit(1);
  }
  return path.join(POSTS_DIR, batches.at(-1));
}

export function readBatch(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'posts.json'), 'utf8'));
}

export function writeBatch(dir, batch) {
  fs.writeFileSync(path.join(dir, 'posts.json'), JSON.stringify(batch, null, 2) + '\n');
}

export function imageFile(post) {
  return `${post.id}.png`;
}

// The caption exactly as it should be pasted into LinkedIn.
export function captionText(post) {
  const { hook, body, action, hashtags } = post.caption;
  return [hook, body.join('\n'), action, hashtags.join(' ')].filter(Boolean).join('\n\n');
}
