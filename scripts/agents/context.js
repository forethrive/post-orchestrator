// Gathers everything the Writer agent needs to know into its instructions: the
// writing rules, the brand guide, the company notes, the checked facts, the
// team's ideas and the posts made before.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, pastPosts } from '../lib/batch.js';

const HISTORY_LIMIT = 60;

function read(file) {
  const full = path.join(ROOT, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8').trim() : '';
}

// The brand guide is the <main> part of Post Studio, as plain text.
function guideText() {
  const main = read('post-studio.html').match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
  return main
    .replace(/<\/(h2|h3|li|p|pre)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&times;/g, '×')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function history() {
  const posts = pastPosts().slice(-HISTORY_LIMIT);
  if (posts.length === 0) return 'None yet.';
  return posts
    .map((p) => {
      const idea = p.fromIdea ? ` | from idea: ${p.fromIdea}` : '';
      return `- [${p.status}] ${p.type}: ${p.image.headline} | hook: ${p.caption.hook}${idea}`;
    })
    .join('\n');
}

export function researchInstructions() {
  const recent = pastPosts()
    .slice(-HISTORY_LIMIT)
    .map((p) => `- ${p.image.headline}`)
    .join('\n');
  return [
    read('brand/research-rules.md'),
    `# About Forethrive\n\n${read('brand/company.md')}`,
    `# Already posted or drafted\n\n${recent || 'Nothing yet.'}`,
  ].join('\n\n');
}

export function writerInstructions(brief = '') {
  const ideas = read('brand/ideas.md');
  const sections = [
    [
      'Your job',
      'You write LinkedIn posts for the Forethrive company page, following the writing rules below exactly. ' +
        "You can't browse the web, so use only the facts and research given here.",
    ],
    ['Writing rules', read('brand/writing-rules.md')],
    ['Brand guide (from Post Studio)', guideText()],
    ['About Forethrive', read('brand/company.md')],
    ['Checked facts', read('brand/facts.md')],
    [
      'Ideas from the team',
      ideas || "None yet, so don't write Client win, Announcement or Hiring posts.",
    ],
    ['Earlier posts (status in brackets)', history()],
  ];
  if (brief) sections.push(['Research for this batch', brief]);
  return sections.map(([title, body]) => `# ${title}\n\n${body}`).join('\n\n');
}
