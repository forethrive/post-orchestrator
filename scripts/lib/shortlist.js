// Builds what gets shared from a batch:
// - the shortlist: the approved posts as one zip with a PDF (easy to read in any
//   mail app), an all-in-one HTML page, the full-quality images and a captions file
// - the drafts: every post as a PDF and an all-in-one HTML page, for the weekly
//   email to reviewers
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT, readBatch, imageFile, captionText } from './batch.js';
import { createZip } from './zip.js';

// Gmail and most mail services refuse attachments over about 25 MB.
export const EMAIL_LIMIT_MB = 25;

// The approved posts, or with all: every post that wasn't skipped.
export function shortlistPosts(batch, { all = false } = {}) {
  return batch.posts.filter((post) => (all ? post.status !== 'skipped' : post.status === 'approved'));
}

function captionsFile(name, posts) {
  const lines = [`Forethrive LinkedIn shortlist: batch ${name}, ${posts.length} posts`, ''];
  for (const post of posts) {
    lines.push(`=== Post ${post.id} (${post.type}): images/${post.id}.png ===`, '');
    lines.push('Caption:', captionText(post), '');
    lines.push('First comment:', post.firstComment, '');
    if (post.sources?.length) {
      lines.push('Sources:', ...post.sources.map((s) => `- ${s.title}: ${s.url}`), '');
    }
  }
  return lines.join('\n');
}

// Full-size PNGs are about 1 MB each, so the copies inside the HTML page and
// the PDF are JPEGs at high quality, which keeps them small enough to email.
async function jpegCopy(page, png) {
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, dataUrl);
}

function readImages(dir, posts) {
  return posts.map((post) => {
    const file = path.join(dir, imageFile(post));
    if (!fs.existsSync(file)) throw new Error(`Post ${post.id} has no image yet. Run npm run render first.`);
    return fs.readFileSync(file);
  });
}

// The all-in-one HTML page and the same page printed as a PDF.
async function renderPages(name, posts, pngs, { title, withImagesFolder }) {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const images = [];
    for (const png of pngs) images.push(await jpegCopy(page, png));

    const data = {
      title,
      withImagesFolder,
      batch: name,
      exportedAt: new Date().toLocaleDateString('en-CA'),
      posts: posts.map((post, i) => ({
        id: post.id,
        type: post.type,
        angle: post.angle,
        headline: post.image.headline,
        captionText: captionText(post),
        firstComment: post.firstComment,
        sources: post.sources ?? [],
        image: images[i],
        imageName: `forethrive-${name}-${post.id}.jpg`,
      })),
    };
    // "<" is escaped so no caption can end the <script> block early.
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    const html = fs.readFileSync(path.join(ROOT, 'review', 'shortlist.html'), 'utf8').replace('/*DATA*/', () => json);

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
    return { html, pdf };
  } finally {
    await browser.close();
  }
}

export async function buildShortlist(dir, options = {}) {
  const name = path.basename(dir);
  const posts = shortlistPosts(readBatch(dir), options);
  if (posts.length === 0) {
    throw new Error(options.all ? 'There are no posts to export.' : 'Approve at least one post first.');
  }
  const pngs = readImages(dir, posts);
  const { html, pdf } = await renderPages(name, posts, pngs, { title: 'LinkedIn shortlist', withImagesFolder: true });

  const folder = `forethrive-shortlist-${name}`;
  const zip = createZip([
    { name: `${folder}/shortlist.pdf`, data: pdf },
    { name: `${folder}/shortlist.html`, data: Buffer.from(html) },
    { name: `${folder}/captions.txt`, data: Buffer.from(captionsFile(name, posts)) },
    ...posts.map((post, i) => ({ name: `${folder}/images/${post.id}.png`, data: pngs[i] })),
  ]);
  const zipPath = path.join(dir, `${folder}.zip`);
  fs.writeFileSync(zipPath, zip);
  return { zipPath, count: posts.length, megabytes: zip.length / 1024 / 1024 };
}

// Every post that wasn't skipped, as a PDF and an HTML page saved in the batch folder.
export async function buildDrafts(dir) {
  const name = path.basename(dir);
  const posts = shortlistPosts(readBatch(dir), { all: true });
  if (posts.length === 0) throw new Error('There are no posts to export.');
  const pngs = readImages(dir, posts);
  const { html, pdf } = await renderPages(name, posts, pngs, { title: 'LinkedIn drafts', withImagesFolder: false });

  const pdfPath = path.join(dir, `forethrive-drafts-${name}.pdf`);
  const htmlPath = path.join(dir, `forethrive-drafts-${name}.html`);
  fs.writeFileSync(pdfPath, pdf);
  fs.writeFileSync(htmlPath, html);
  return { pdfPath, htmlPath, count: posts.length, megabytes: (pdf.length + html.length) / 1024 / 1024 };
}
