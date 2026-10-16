// Generates a batch of posts with the AI provider set in .env (no Claude Code
// needed): the Research agent finds material, the Writer agent writes the
// posts, then the images are drawn and the review page opens.
// Usage: npm run generate                  (14 posts)
//        npm run generate -- --count 6
//        npm run generate -- --no-research  (skip the web research)
//        npm run generate -- --no-review    (don't open the review page)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT, today, newBatchDir, writeBatch } from './lib/batch.js';
import { renderBatch } from './lib/draw.js';
import { loadSettings, makeModel, SetupError } from './agents/models.js';
import { tavilyServices } from './agents/research-tools.js';
import { researchMarkdown } from './agents/brief.js';
import { buildOrchestrator } from './agents/orchestrator.js';

// Read the settings in .env, if there's one, into process.env (built into Node).
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // No .env yet: loadSettings explains what to do.
}

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: '14' },
    'no-research': { type: 'boolean', default: false },
    'no-review': { type: 'boolean', default: false },
  },
});
const count = Number(args.count);

try {
  if (!Number.isInteger(count) || count < 1 || count > 30) {
    throw new SetupError('--count must be a whole number from 1 to 30.');
  }
  const settings = loadSettings();
  console.log(`Using ${settings.name} (${settings.model}).`);
  const model = await makeModel(settings);

  let search = null;
  if (args['no-research']) {
    console.log('Skipping research: using the facts in brand/facts.md.');
  } else if (process.env.TAVILY_API_KEY) {
    search = tavilyServices(process.env.TAVILY_API_KEY);
  } else {
    console.log('No TAVILY_API_KEY in .env, so skipping research: using the facts in brand/facts.md.');
  }
  console.log('');

  const orchestrator = buildOrchestrator(model, search);
  const result = await orchestrator.invoke({ count });

  // Number the posts that passed 01, 02 and so on, with no gaps.
  const posts = result.posts.map((post, i) => ({ ...post, id: String(i + 1).padStart(2, '0') }));
  if (posts.length === 0) {
    throw new SetupError('No posts passed the checks. Try again, or try another model.');
  }

  const dir = newBatchDir();
  const generator = `${settings.id}/${settings.model}${search ? ' with research' : ''}`;
  writeBatch(dir, { createdAt: today(), generator, posts });
  if (result.brief) {
    const research = { brief: result.brief, verifiedFacts: result.verifiedFacts, rejectedFacts: result.rejectedFacts };
    fs.writeFileSync(path.join(dir, 'research.json'), JSON.stringify(research, null, 2) + '\n');
    fs.writeFileSync(
      path.join(dir, 'research.md'),
      researchMarkdown(result.brief, result.verifiedFacts, result.rejectedFacts, path.basename(dir)),
    );
  }
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
