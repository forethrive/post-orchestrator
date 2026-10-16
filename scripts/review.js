// A small web server for reviewing a batch on this Mac: see each post, copy its
// caption, edit it, mark it approved, skipped or posted, and export the
// approved ones as a shortlist to share. Changes are saved straight into the
// batch's posts.json.
// Usage: npm run review              (newest batch)
//        npm run review -- posts/2026-10-13
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { ROOT, findBatch, readBatch, writeBatch, imageFile, captionText } from './lib/batch.js';
import { buildShortlist, EMAIL_LIMIT_MB } from './lib/shortlist.js';
import { checkPost, loadAllowedUrls } from './lib/checks.js';
import { STATUSES } from '../brand/rules.js';

const PORT = 4400;
const HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
const args = process.argv.slice(2);
const dir = findBatch(args.find((arg) => !arg.startsWith('--')));
const reviewPage = fs.readFileSync(path.join(ROOT, 'review', 'index.html'));
let lastExport = null;

// The fields an edit may change. Everything else (id, type, sources, status…)
// stays as it was.
function applyEdit(post, edit) {
  const text = (value) => String(value ?? '');
  const list = (value) => (Array.isArray(value) ? value.map(text) : []);
  return {
    ...post,
    image: {
      ...post.image,
      label: text(edit.image?.label),
      big: text(edit.image?.big),
      headline: text(edit.image?.headline),
      sub: text(edit.image?.sub),
      size: edit.image?.size === 'square' ? 'square' : 'portrait',
    },
    caption: {
      hook: text(edit.caption?.hook),
      body: list(edit.caption?.body),
      action: text(edit.caption?.action),
      hashtags: list(edit.caption?.hashtags),
    },
    firstComment: text(edit.firstComment),
  };
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, 'application/json', JSON.stringify(value));
}

// Reads a JSON request body. Requiring JSON means a browser won't let another
// website send these requests.
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (req.headers['content-type'] !== 'application/json') return reject(new Error('Expected JSON'));
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      } catch {
        reject(new Error('Bad JSON'));
      }
    });
  });
}

async function handle(req, res) {
  // Only answer requests addressed to this Mac, so other websites can't use it.
  if (!HOSTS.includes(req.headers.host)) return send(res, 403, 'text/plain', 'Forbidden');
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, 'text/html; charset=utf-8', reviewPage);
  }

  if (req.method === 'GET' && url.pathname === '/batch') {
    const batch = readBatch(dir);
    const posts = batch.posts.map((post) => ({
      ...post,
      captionText: captionText(post),
      imageFile: imageFile(post),
    }));
    return sendJson(res, 200, { name: path.basename(dir), posts });
  }

  const image = url.pathname.match(/^\/images\/([\w-]+\.png)$/);
  if (req.method === 'GET' && image) {
    const file = path.join(dir, image[1]);
    if (!fs.existsSync(file)) return send(res, 404, 'text/plain', 'Image not drawn yet');
    return send(res, 200, 'image/png', fs.readFileSync(file));
  }

  if (req.method === 'POST' && url.pathname === '/status') {
    const { id, status } = await readJson(req);
    const batch = readBatch(dir);
    const post = batch.posts.find((p) => p.id === id);
    if (!post || !STATUSES.includes(status)) return send(res, 400, 'text/plain', 'Unknown post or status');
    post.status = status;
    writeBatch(dir, batch);
    return sendJson(res, 200, { id, status });
  }

  // Post Studio itself, so the page can redraw an image while it's being edited.
  if (req.method === 'GET' && url.pathname === '/post-studio.html') {
    return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(ROOT, 'post-studio.html')));
  }

  // Runs the brand checks on an edit that isn't saved yet.
  if (req.method === 'POST' && url.pathname === '/check') {
    const { id, edit } = await readJson(req);
    const post = readBatch(dir).posts.find((p) => p.id === id);
    if (!post) return send(res, 400, 'text/plain', 'Unknown post');
    return sendJson(res, 200, { problems: checkPost(applyEdit(post, edit), loadAllowedUrls(dir)) });
  }

  // Saves an edit and its redrawn image, but only if it passes the checks.
  if (req.method === 'POST' && url.pathname === '/save') {
    const { id, edit, png } = await readJson(req);
    const batch = readBatch(dir);
    const index = batch.posts.findIndex((p) => p.id === id);
    if (index === -1) return send(res, 400, 'text/plain', 'Unknown post');
    const updated = applyEdit(batch.posts[index], edit);
    const problems = checkPost(updated, loadAllowedUrls(dir));
    if (problems.length > 0) return sendJson(res, 400, { problems });
    const prefix = 'data:image/png;base64,';
    if (typeof png !== 'string' || !png.startsWith(prefix)) return send(res, 400, 'text/plain', 'Missing image');

    fs.writeFileSync(path.join(dir, imageFile(updated)), Buffer.from(png.slice(prefix.length), 'base64'));
    batch.posts[index] = updated;
    writeBatch(dir, batch);
    return sendJson(res, 200, { post: { ...updated, captionText: captionText(updated), imageFile: imageFile(updated) } });
  }

  // Builds the shortlist zip from the approved posts, then the page downloads it.
  if (req.method === 'POST' && url.pathname === '/export') {
    await readJson(req);
    try {
      lastExport = await buildShortlist(dir);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
    return sendJson(res, 200, {
      file: path.relative(ROOT, lastExport.zipPath),
      count: lastExport.count,
      megabytes: Number(lastExport.megabytes.toFixed(1)),
      overEmailLimit: lastExport.megabytes > EMAIL_LIMIT_MB - 1,
    });
  }

  if (req.method === 'GET' && url.pathname === '/export/download' && lastExport) {
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${path.basename(lastExport.zipPath)}"`,
    });
    return res.end(fs.readFileSync(lastExport.zipPath));
  }

  send(res, 404, 'text/plain', 'Not found');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) send(res, 400, 'text/plain', 'Bad request');
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is busy. A review page is probably already running: use that one, or stop it first.`);
    process.exit(1);
  }
  throw error;
});

// 127.0.0.1 means only this Mac can open the page.
server.listen(PORT, '127.0.0.1', () => {
  const link = `http://localhost:${PORT}`;
  console.log(`Reviewing ${path.relative(ROOT, dir)} at ${link}  (Ctrl+C stops it)`);
  if (!args.includes('--no-open')) {
    // The command that opens a link in the default browser differs on Mac,
    // Windows and Linux. If none works, the link printed above still does.
    const [command, ...commandArgs] =
      { darwin: ['open', link], win32: ['cmd', '/c', 'start', '', link] }[process.platform] ??
      ['xdg-open', link];
    execFile(command, commandArgs, () => {});
  }
});
