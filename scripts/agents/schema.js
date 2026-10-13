// The exact shape of a post, described with zod. The model is asked to reply in
// this shape, and LangChain checks the reply against it before we see it.
import * as z from 'zod';
import { POST_TYPES } from '../../brand/rules.js';

export const Post = z.object({
  id: z.string().describe('Two digits, as asked, e.g. "01"'),
  type: z.enum(POST_TYPES),
  angle: z.string().describe('One line for the reviewer: why this post is worth posting now'),
  image: z.object({
    label: z.string().describe('Short tag at the top, up to 28 characters'),
    big: z.string().describe('One checked number such as "46%", or an empty string'),
    headline: z.string().describe('12 words or fewer, sentence case'),
    sub: z.string().describe('Supporting line, 25 words or fewer, or an empty string'),
    size: z.enum(['portrait', 'square']),
  }),
  caption: z.object({
    hook: z.string().describe('One sentence under 125 characters'),
    body: z.array(z.string()).describe('One to four short lines'),
    action: z.string().describe('One question, or "Message us to talk about your use case."'),
    hashtags: z.array(z.string()).describe('Up to three of #AI #GenerativeAI #Automation #Forethrive'),
  }),
  firstComment: z.string().describe('Includes https://forethrive.ai'),
  sources: z
    .array(z.object({ title: z.string(), url: z.string() }))
    .describe('Copied exactly from the checked facts; empty if the post has no numbers'),
  fromIdea: z.string().nullable().describe('The heading of the idea it came from, or null'),
});

export const PostsReply = z.object({ posts: z.array(Post) });
