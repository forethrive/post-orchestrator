// The post orchestrator: the Research agent finds material, plain code checks
// the facts it reports, and the Writer agent writes the batch from the brief.
// Each agent is its own graph, run as one step of this one.
//
//   START → research → verify_facts → write → END
//     └──(no search key)──────────────→ write
import * as z from 'zod';
import { StateGraph, StateSchema, START, END } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { buildResearchGraph } from './research.js';
import { makeResearchTools } from './research-tools.js';
import { verifyFacts } from './verify.js';
import { briefText } from './brief.js';
import { buildWriterGraph } from './writer.js';
import { loadFactUrls, normaliseUrl } from '../lib/checks.js';
import { today } from '../lib/batch.js';

const OrchestratorState = new StateSchema({
  count: z.number(),
  brief: z.any().default(null),
  verifiedFacts: z.array(z.any()).default(() => []),
  rejectedFacts: z.array(z.any()).default(() => []),
  posts: z.array(z.any()).default(() => []),
});

// searchServices is null when there's no search key; then research is skipped.
export function buildOrchestrator(model, searchServices) {
  const pages = new Map();
  const researchGraph = searchServices
    ? buildResearchGraph(model, makeResearchTools(searchServices, pages))
    : null;
  const writerGraph = buildWriterGraph(model);

  async function research(state) {
    const result = await researchGraph.invoke(
      {
        count: state.count,
        messages: [new HumanMessage(`Today is ${today()}. Research material for a batch of ${state.count} posts.`)],
      },
      { recursionLimit: 100 },
    );
    return { brief: result.brief };
  }

  function checkFacts(state) {
    const { verified, rejected } = verifyFacts(state.brief.facts, pages);
    console.log(`Fact check: ${verified.length} of ${state.brief.facts.length} facts match their pages.`);
    for (const fact of rejected) console.log(`  Dropped "${fact.claim}": ${fact.reason}.`);
    return { verifiedFacts: verified, rejectedFacts: rejected };
  }

  async function write(state) {
    const allowedUrls = new Set([...loadFactUrls(), ...state.verifiedFacts.map((f) => normaliseUrl(f.url))]);
    const result = await writerGraph.invoke(
      {
        count: state.count,
        brief: state.brief ? briefText(state.brief, state.verifiedFacts) : '',
        allowedUrls: [...allowedUrls],
      },
      { recursionLimit: 200 },
    );
    return { posts: result.posts };
  }

  return new StateGraph(OrchestratorState)
    .addNode('research', research)
    .addNode('verify_facts', checkFacts)
    .addNode('write', write)
    .addConditionalEdges(START, () => (researchGraph ? 'research' : 'write'), ['research', 'write'])
    .addEdge('research', 'verify_facts')
    .addEdge('verify_facts', 'write')
    .addEdge('write', END)
    .compile();
}
