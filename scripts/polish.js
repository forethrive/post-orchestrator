// Turns a rough write-up into a polished post, ready to publish: fills in Post
// Studio's fields, writes the caption, draws the image and opens the review
// page. Uses the AI provider set in .env.
// Usage: npm run polish -- my-draft.txt
//        npm run polish -- "We cut invoice processing from 3 days to 4 hours…"
//        npm run polish -- my-draft.txt --versions 3   (a few to choose from)
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/batch.js';
import { loadFactUrls, numbersIn } from './lib/checks.js';
import { saveDrawAndReview } from './lib/finish.js';
import { loadDotEnv, loadSettings, makeModel, SetupError } from './agents/models.js';
import { buildWriterGraph } from './agents/writer.js';

loadDotEnv();

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    versions: { type: 'string', default: '1' },
    'no-review': { type: 'boolean', default: false },
  },
});

// The draft is either a file (found from the folder npm was run in) or the text itself.
function readDraft(input) {
  const file = path.resolve(process.env.INIT_CWD ?? process.cwd(), input);
  return fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8').trim() : input;
}

try {
  const input = positionals.join(' ').trim();
  if (!input) {
    throw new SetupError('Give it your draft: npm run polish -- my-draft.txt, or the text itself in quotes.');
  }
  const versions = Number(args.versions);
  if (!Number.isInteger(versions) || versions < 1 || versions > 5) {
    throw new SetupError('--versions must be a whole number from 1 to 5.');
  }
  const draft = readDraft(input);

  const settings = loadSettings();
  console.log(`Using ${settings.name} (${settings.model}).\n`);
  const writer = buildWriterGraph(await makeModel(settings));

  // The post may only use numbers from the draft or the checked facts.
  const facts = fs.readFileSync(path.join(ROOT, 'brand', 'facts.md'), 'utf8');
  const result = await writer.invoke(
    {
      count: versions,
      draft,
      allowedUrls: [...loadFactUrls()],
      allowedNumbers: [...new Set(numbersIn(`${draft}\n${facts}`))],
    },
    { recursionLimit: 100 },
  );
  if (result.posts.length === 0) {
    throw new SetupError(
      "The draft couldn't be turned into a post that passes the checks. Try adding detail, or another model.",
    );
  }

  await saveDrawAndReview({
    posts: result.posts,
    generator: `${settings.id}/${settings.model} polish`,
    files: { 'draft.txt': `${draft}\n` },
    review: !args['no-review'],
  });
} catch (error) {
  console.error(error instanceof SetupError ? error.message : `Something went wrong: ${error.message}`);
  process.exitCode = 1;
}
