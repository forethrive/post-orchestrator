// Turns the research brief into text: for the Writer agent's instructions, and
// as research.md in the batch folder for people to read.

const list = (items, line) => (items.length ? items.map(line).join('\n') : '- None found.');

export function briefText(brief, verifiedFacts) {
  return [
    '## Recent news',
    list(brief.news, (n) => `- ${n.headline} (${n.date}): ${n.summary} ${n.url}`),
    '## Facts checked against their pages today',
    'You may use these numbers and cite these sources, exactly as written.',
    list(verifiedFacts, (f) => `- ${f.claim}\n  Quote: "${f.quote}"\n  Source: ${f.sourceTitle}\n  URL: ${f.url}`),
    '## What similar companies post',
    "For ideas only: never copy their wording, and don't mention them.",
    list(brief.inspiration, (i) => `- ${i.theme} (${i.format}): ${i.notes} ${i.url}`),
    '## Angles to consider',
    list(brief.angles, (a) => `- ${a}`),
  ].join('\n\n');
}

export function researchMarkdown(brief, verified, rejected, date) {
  return [
    `# Research for the batch of ${date}`,
    'Written by the Research agent. Facts were checked against the pages they came from.',
    briefText(brief, verified),
    '## Facts that failed the check (not used)',
    list(rejected, (f) => `- ${f.claim} (${f.reason}) ${f.url}`),
    '## Keeping a fact for later batches',
    'Copy it into `brand/facts.md` in the same format as the others, after checking it reads right.',
  ].join('\n\n') + '\n';
}
