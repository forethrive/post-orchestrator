// The Research agent: a LangGraph graph that searches the web, reads sources
// and looks at what similar companies post on LinkedIn, then writes a research
// brief for the Writer agent.
//
//   START → think ──(wants a tool)──→ tools ──→ think
//             └──(has enough, or out of turns)──→ write_brief → END
import * as z from 'zod';
import { StateGraph, StateSchema, MessagesValue, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { researchInstructions } from './context.js';

// The most times the agent can decide what to do next before it must write the
// brief. Keeps a run's time and cost in check.
const MAX_TURNS = 12;

export const ResearchBrief = z.object({
  news: z.array(
    z.object({
      headline: z.string(),
      summary: z.string().describe('Two sentences: what happened and why it matters to a business owner'),
      url: z.string(),
      date: z.string().describe('When it was published, as YYYY-MM-DD if known'),
    }),
  ),
  facts: z.array(
    z.object({
      claim: z.string().describe('The number and what it means, in one sentence'),
      quote: z.string().describe('The sentence from the page containing the number, copied word for word'),
      sourceTitle: z.string().describe('Report or article title, publisher, date'),
      url: z.string().describe('The page it was read on'),
      date: z.string(),
    }),
  ),
  inspiration: z.array(
    z.object({
      theme: z.string().describe('What the post was about'),
      format: z.string().describe('For example: a list of tips, a myth busted, a before and after'),
      notes: z.string().describe("What made it work, in your own words. Don't copy its text."),
      url: z.string(),
    }),
  ),
  angles: z.array(z.string()).describe('Post ideas for Forethrive that use this material'),
});

const ResearchState = new StateSchema({
  count: z.number(),
  messages: MessagesValue,
  turns: z.number().default(0),
  brief: z.any().default(null),
});

function describeCall({ name, args }) {
  if (name === 'search_web') return `searching the web for "${args.query}"${args.recent ? ' (last month)' : ''}`;
  if (name === 'search_linkedin') return `searching LinkedIn posts for "${args.query}"`;
  if (name === 'read_page') return `reading ${args.url}`;
  return name;
}

// Everything the agent found, as plain text for the brief.
function transcript(messages) {
  return messages
    .map((m) => {
      if (m.type === 'tool') return `Result of ${m.name}:\n${m.text}`;
      if (m.type === 'ai' && m.text) return `Your notes:\n${m.text}`;
      return '';
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

export function buildResearchGraph(model, tools) {
  const researcher = model.bindTools(tools);
  const briefWriter = model.withStructuredOutput(ResearchBrief, { name: 'research_brief' });

  async function think(state) {
    const reply = await researcher.invoke([new SystemMessage(researchInstructions()), ...state.messages]);
    for (const call of reply.tool_calls ?? []) console.log(`Research agent: ${describeCall(call)}`);
    return { messages: [reply], turns: state.turns + 1 };
  }

  async function writeBrief(state) {
    console.log('Research agent: writing the research brief…');
    const result = await briefWriter.invoke([
      new SystemMessage(researchInstructions()),
      new HumanMessage(
        `Here is everything you found:\n\n${transcript(state.messages)}\n\n` +
          `Now write the research brief for a batch of ${state.count} posts. Include only facts ` +
          'from pages you read, with the quote copied word for word.',
      ),
    ]);
    return { brief: result };
  }

  const afterThink = (state) => {
    const wantsTool = (state.messages.at(-1).tool_calls ?? []).length > 0;
    return wantsTool && state.turns < MAX_TURNS ? 'tools' : 'write_brief';
  };

  return new StateGraph(ResearchState)
    .addNode('think', think)
    .addNode('tools', new ToolNode(tools))
    .addNode('write_brief', writeBrief)
    .addEdge(START, 'think')
    .addConditionalEdges('think', afterThink, ['tools', 'write_brief'])
    .addEdge('tools', 'think')
    .addEdge('write_brief', END)
    .compile();
}
