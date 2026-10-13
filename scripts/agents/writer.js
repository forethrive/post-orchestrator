// The Writer agent: a LangGraph graph that writes a batch a few posts at a
// time, checks every post against the brand rules, and sends failing posts
// back to the model with the problems listed until they pass.
//
//   START → next_chunk ──(all written)──→ END
//               │
//             write → check ──(all pass)──→ next_chunk
//               ↑       ├──(problems)──→ request_fixes → write
//               │       └──(still failing after 2 fixes)──→ give_up → next_chunk
import * as z from 'zod';
import { StateGraph, StateSchema, START, END } from '@langchain/langgraph';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { PostsReply } from './schema.js';
import { writerInstructions } from './context.js';
import { checkPost } from '../lib/checks.js';

// Five posts per request keeps each request small enough for free tiers.
const CHUNK_SIZE = 5;
const MAX_FIX_ROUNDS = 2;
const pad = (n) => String(n).padStart(2, '0');

// What the graph remembers between steps. Each node returns only what it changes.
const WriterState = new StateSchema({
  count: z.number(),
  brief: z.string().default(''),
  allowedUrls: z.array(z.string()).default(() => []),
  posts: z.array(z.any()).default(() => []), // posts that passed
  nextId: z.number().default(1),
  chunk: z.array(z.string()).default(() => []), // ids being written now
  pending: z.array(z.string()).default(() => []), // ids in the chunk still failing
  conversation: z.array(z.any()).default(() => []),
  received: z.array(z.any()).default(() => []),
  problems: z.record(z.string(), z.array(z.string())).default(() => ({})),
  fixRounds: z.number().default(0),
});

function chunkRequest(ids, state) {
  const written = state.posts.map((p) => `- ${p.id} ${p.type}: ${p.image.headline}`).join('\n');
  return [
    `Write ${ids.length} posts with the ids ${ids.map((id) => `"${id}"`).join(', ')}.`,
    `The whole batch has ${state.count} posts. Across it, aim for mostly AI insight posts, about a ` +
      'quarter Stat posts (only with checked facts), and one post for each unused idea from the team.',
    `Posts already written in this batch (don't repeat their topics or hooks):\n${written || 'None yet.'}`,
  ].join('\n\n');
}

export function buildWriterGraph(model) {
  const writer = model.withStructuredOutput(PostsReply, { name: 'posts' });

  function nextChunk(state) {
    if (state.nextId > state.count) return { chunk: [] };
    const last = Math.min(state.nextId + CHUNK_SIZE - 1, state.count);
    const ids = [];
    for (let n = state.nextId; n <= last; n++) ids.push(pad(n));
    console.log(`Writer agent: writing posts ${ids[0]} to ${ids.at(-1)} of ${pad(state.count)}…`);
    return {
      chunk: ids,
      pending: ids,
      nextId: last + 1,
      fixRounds: 0,
      problems: {},
      conversation: [
        new SystemMessage(writerInstructions(state.brief)),
        new HumanMessage(chunkRequest(ids, state)),
      ],
    };
  }

  async function write(state) {
    const reply = await writer.invoke(state.conversation);
    return {
      received: reply.posts,
      conversation: [...state.conversation, new AIMessage(JSON.stringify(reply))],
    };
  }

  function check(state) {
    const allowed = new Set(state.allowedUrls);
    const accepted = [];
    const problems = {};
    for (const post of state.received) {
      if (!state.pending.includes(post.id) || accepted.some((p) => p.id === post.id)) continue;
      const draft = { ...post, status: 'draft' };
      const found = checkPost(draft, allowed);
      if (found.length > 0) problems[post.id] = found;
      else accepted.push(draft);
    }
    const pending = state.pending.filter((id) => !accepted.some((p) => p.id === id));
    for (const id of pending) problems[id] ??= ['missing from the reply'];
    console.log(`  ${accepted.length} passed the checks${pending.length ? `, ${pending.length} to fix` : ''}.`);
    return { posts: [...state.posts, ...accepted], pending, problems };
  }

  function requestFixes(state) {
    const list = state.pending
      .map((id) => `${id}:\n${state.problems[id].map((p) => `- ${p}`).join('\n')}`)
      .join('\n\n');
    return {
      fixRounds: state.fixRounds + 1,
      conversation: [
        ...state.conversation,
        new HumanMessage(
          'These posts broke the rules. Rewrite them so they pass, keeping their ids, and reply ' +
            `with only these posts.\n\n${list}`,
        ),
      ],
    };
  }

  function giveUp(state) {
    for (const id of state.pending) {
      console.log(`  Dropped post ${id}, still failing: ${state.problems[id].join('; ')}`);
    }
    return { pending: [] };
  }

  const afterNextChunk = (state) => (state.chunk.length > 0 ? 'write' : END);
  const afterCheck = (state) => {
    if (state.pending.length === 0) return 'next_chunk';
    return state.fixRounds < MAX_FIX_ROUNDS ? 'request_fixes' : 'give_up';
  };

  return new StateGraph(WriterState)
    .addNode('next_chunk', nextChunk)
    .addNode('write', write)
    .addNode('check', check)
    .addNode('request_fixes', requestFixes)
    .addNode('give_up', giveUp)
    .addEdge(START, 'next_chunk')
    .addConditionalEdges('next_chunk', afterNextChunk, ['write', END])
    .addEdge('write', 'check')
    .addConditionalEdges('check', afterCheck, ['next_chunk', 'request_fixes', 'give_up'])
    .addEdge('request_fixes', 'write')
    .addEdge('give_up', 'next_chunk')
    .compile();
}
