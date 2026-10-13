// Generates a batch of posts with the AI provider set in .env (no Claude Code
// needed): the Research agent finds material, the Writer agent writes the
// posts, then the images are drawn and the review page opens.
// Usage: npm run generate                  (14 posts)
//        npm run generate -- --count 6
//        npm run generate -- --no-research  (skip the web research)
//        npm run generate -- --no-review    (don't open the review page)
import { parseArgs } from 'node:util';
import { today } from './lib/batch.js';
import { saveDrawAndReview } from './lib/finish.js';
import { loadDotEnv, loadSettings, makeModel, SetupError } from './agents/models.js';
import { tavilyServices } from './agents/research-tools.js';
import { researchMarkdown } from './agents/brief.js';
import { buildOrchestrator } from './agents/orchestrator.js';

loadDotEnv();

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

  const result = await buildOrchestrator(model, search).invoke({ count });
  if (result.posts.length === 0) {
    throw new SetupError('No posts passed the checks. Try again, or try another model.');
  }

  const files = {};
  if (result.brief) {
    const { brief, verifiedFacts, rejectedFacts } = result;
    files['research.json'] = JSON.stringify({ brief, verifiedFacts, rejectedFacts }, null, 2) + '\n';
    files['research.md'] = researchMarkdown(brief, verifiedFacts, rejectedFacts, today());
  }
  await saveDrawAndReview({
    posts: result.posts,
    generator: `${settings.id}/${settings.model}${search ? ' with research' : ''}`,
    files,
    review: !args['no-review'],
  });
} catch (error) {
  // Setup problems and errors from the provider (a wrong key, an unknown model)
  // are shown as a plain message instead of a stack trace.
  console.error(error instanceof SetupError ? error.message : `Something went wrong: ${error.message}`);
  process.exitCode = 1;
}
