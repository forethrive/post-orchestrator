// Helpers shared by the scripts: finding batch folders, reading and saving
// posts.json, and putting a caption together from its parts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const POSTS_DIR = path.join(ROOT, 'posts');

// Today's date as YYYY-MM-DD, in this computer's time zone.
export function today() {
  return new Date().toLocaleDateString('en-CA');
}

// Every batch folder in posts/, oldest first. The numeric option sorts
// 2026-10-13-10 after 2026-10-13-2.
export function listBatches() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((name) => fs.existsSync(path.join(POSTS_DIR, name, 'posts.json')))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// The batch folder given on the command line, or else the newest one in posts/.
export function findBatch(arg) {
  if (arg) return path.resolve(arg);
  const batches = listBatches();
  if (batches.length === 0) {
    console.error('There are no batches in posts/ yet. Generate one first (see README.md).');
    process.exit(1);
  }
  return path.join(POSTS_DIR, batches.at(-1));
}

// A new, empty folder for today's batch: posts/2026-10-14, or -2, -3 and so on
// if that already exists.
export function newBatchDir() {
  let dir = path.join(POSTS_DIR, today());
  for (let n = 2; fs.existsSync(dir); n++) dir = path.join(POSTS_DIR, `${today()}-${n}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readBatch(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'posts.json'), 'utf8'));
}

export function writeBatch(dir, batch) {
  fs.writeFileSync(path.join(dir, 'posts.json'), JSON.stringify(batch, null, 2) + '\n');
}

// Every post from every earlier batch, so new batches don't repeat them.
export function pastPosts() {
  return listBatches().flatMap((name) => readBatch(path.join(POSTS_DIR, name)).posts);
}

export function imageFile(post) {
  return `${post.id}.png`;
}

// The caption exactly as it should be pasted into LinkedIn.
export function captionText(post) {
  const { hook, body, action, hashtags } = post.caption;
  return [hook, body.join('\n'), action, hashtags.join(' ')].filter(Boolean).join('\n\n');
}
