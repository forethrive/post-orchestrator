// Generates a batch of posts with the AI provider set in .env (no Claude Code
// needed), then draws the images and opens the review page.
// Usage: npm run generate                (14 posts)
//        npm run generate -- --count 6
//        npm run generate -- --no-review  (don't open the review page)
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT, today, newBatchDir, writeBatch } from './lib/batch.js';
import { loadFactUrls } from './lib/checks.js';
import { renderBatch } from './lib/draw.js';
import { loadSettings, makeModel, SetupError } from './agents/models.js';
import { buildWriterGraph } from './agents/writer.js';

// Read the settings in .env, if there's one, into process.env (built into Node).
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // No .env yet: loadSettings explains what to do.
}

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: '14' },
    'no-review': { type: 'boolean', default: false },
  },
});
const count = Number(args.count);

try {
  if (!Number.isInteger(count) || count < 1 || count > 30) {
    throw new SetupError('--count must be a whole number from 1 to 30.');
  }
  const settings = loadSettings();
  console.log(`Using ${settings.name} (${settings.model}).\n`);
  const model = await makeModel(settings);

  // A batch takes several steps per chunk of posts, so allow more than the
  // default 25 steps.
  const writer = buildWriterGraph(model);
  const result = await writer.invoke(
    { count, allowedUrls: [...loadFactUrls()] },
    { recursionLimit: 200 },
  );

  // Number the posts that passed 01, 02 and so on, with no gaps.
  const posts = result.posts.map((post, i) => ({ ...post, id: String(i + 1).padStart(2, '0') }));
  if (posts.length === 0) {
    throw new SetupError('No posts passed the checks. Try again, or try another model.');
  }

  const dir = newBatchDir();
  writeBatch(dir, { createdAt: today(), generator: `${settings.id}/${settings.model}`, posts });
  console.log(`\nSaved ${posts.length} posts in ${path.relative(ROOT, dir)}. Drawing the images…`);
  await renderBatch(dir);

  if (!args['no-review']) {
    console.log('');
    spawn(process.execPath, [path.join(ROOT, 'scripts', 'review.js'), dir], { stdio: 'inherit' });
  }
} catch (error) {
  // Setup problems and errors from the provider (a wrong key, an unknown model)
  // are shown as a plain message instead of a stack trace.
  console.error(error instanceof SetupError ? error.message : `Something went wrong: ${error.message}`);
  process.exitCode = 1;
}
