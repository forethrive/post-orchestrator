// A small web server for reviewing a batch on this Mac: see each post, copy its
// caption and mark it approved, skipped or posted. Changes are saved straight
// into the batch's posts.json.
// Usage: npm run review              (newest batch)
//        npm run review -- posts/2026-10-13
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { ROOT, findBatch, readBatch, writeBatch, imageFile, captionText } from './lib/batch.js';
import { STATUSES } from '../brand/rules.js';

const PORT = 4400;
const HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
const args = process.argv.slice(2);
const dir = findBatch(args.find((arg) => !arg.startsWith('--')));
const reviewPage = fs.readFileSync(path.join(ROOT, 'review', 'index.html'));

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const server = http.createServer((req, res) => {
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
    return send(res, 200, 'application/json', JSON.stringify({ name: path.basename(dir), posts }));
  }

  const image = url.pathname.match(/^\/images\/([\w-]+\.png)$/);
  if (req.method === 'GET' && image) {
    const file = path.join(dir, image[1]);
    if (!fs.existsSync(file)) return send(res, 404, 'text/plain', 'Image not drawn yet');
    return send(res, 200, 'image/png', fs.readFileSync(file));
  }

  // Requiring JSON means a browser won't let another website send this request.
  if (req.method === 'POST' && url.pathname === '/status' && req.headers['content-type'] === 'application/json') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let id, status;
      try {
        ({ id, status } = JSON.parse(body));
      } catch {
        return send(res, 400, 'text/plain', 'Bad request');
      }
      const batch = readBatch(dir);
      const post = batch.posts.find((p) => p.id === id);
      if (!post || !STATUSES.includes(status)) return send(res, 400, 'text/plain', 'Unknown post or status');
      post.status = status;
      writeBatch(dir, batch);
      send(res, 200, 'application/json', JSON.stringify({ id, status }));
    });
    return;
  }

  send(res, 404, 'text/plain', 'Not found');
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
