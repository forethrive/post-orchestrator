// Connects to the AI provider chosen in .env. LangChain's initChatModel gives
// every provider the same interface, so the agents don't care which one it is.
import path from 'node:path';
import { initChatModel } from 'langchain';
import { ROOT } from '../lib/batch.js';

// Reads the settings in .env, if there's one, into process.env (built into Node).
export function loadDotEnv() {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch {
    // No .env yet: loadSettings explains what to do.
  }
}

export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    keyVar: 'OPENAI_API_KEY',
    model: 'gpt-6.1-sol',
    // OpenAI's newest models need the Responses API for tool calls.
    options: { useResponsesApi: true },
  },
  gemini: {
    name: 'Gemini',
    keyVar: 'GEMINI_API_KEY',
    model: 'gemini-3.8-flash',
    langchainProvider: 'google',
  },
  groq: {
    name: 'Groq',
    keyVar: 'GROQ_API_KEY',
    model: 'openai/gpt-oss-120b',
  },
  anthropic: {
    name: 'Anthropic',
    keyVar: 'ANTHROPIC_API_KEY',
    model: 'claude-sonnet-5-5',
    options: { maxTokens: 16000 },
  },
  // Any service that speaks OpenAI's API: OpenRouter, Together, a local Ollama…
  custom: {
    name: 'OpenAI-compatible service',
    keyVar: 'LLM_API_KEY',
    langchainProvider: 'openai',
  },
};

// A problem with the settings in .env, explained in plain words.
export class SetupError extends Error {}

export function loadSettings(env = process.env) {
  const id = (env.LLM_PROVIDER ?? '').trim().toLowerCase();
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new SetupError(
      `Set LLM_PROVIDER in .env to one of: ${Object.keys(PROVIDERS).join(', ')}.\n` +
        'Copy .env.example to .env to start (see README.md).',
    );
  }
  const settings = {
    id,
    ...provider,
    apiKey: env[provider.keyVar] || env.LLM_API_KEY,
    model: env.LLM_MODEL || provider.model,
    baseUrl: env.LLM_BASE_URL,
  };
  if (!settings.model) throw new SetupError('Set LLM_MODEL in .env to the model you want to use.');
  if (id === 'custom' && !settings.baseUrl) {
    throw new SetupError('Set LLM_BASE_URL in .env to your service\'s address, for example http://localhost:11434/v1');
  }
  if (id !== 'custom' && !settings.apiKey) {
    throw new SetupError(`Add your ${provider.name} API key to .env as ${provider.keyVar}=...`);
  }
  return settings;
}

export async function makeModel(settings) {
  const options = {
    modelProvider: settings.langchainProvider ?? settings.id,
    // Local services such as Ollama don't check the key, but the library wants one.
    apiKey: settings.apiKey || 'not-needed',
    // Wait and try again when the provider is busy or rate-limits us.
    maxRetries: 6,
    ...settings.options,
  };
  if (settings.id === 'custom') options.configuration = { baseURL: settings.baseUrl };
  return initChatModel(settings.model, options);
}
