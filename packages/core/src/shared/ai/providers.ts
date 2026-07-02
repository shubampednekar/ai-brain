import OpenAI from 'openai';
import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResult,
  EmbeddingOptions,
  EmbeddingProvider,
  EmbeddingResult,
} from './types.js';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const response = await this.client.chat.completions.create({
      model: options.model ?? 'gpt-4o-mini',
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No response from OpenAI');
    }

    return {
      content: choice.message.content,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private defaultModel = 'text-embedding-3-small';

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const model = options.model ?? this.defaultModel;
    const inputs = Array.isArray(options.input) ? options.input : [options.input];

    const response = await this.client.embeddings.create({
      model,
      input: inputs,
    });

    return {
      embeddings: response.data.map((d) => d.embedding),
      model: response.model,
      dimensions: response.data[0]?.embedding.length ?? 1536,
    };
  }
}

export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const response = await this.client.chat.completions.create({
      model: options.model ?? 'llama-3.3-70b-versatile',
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No response from Groq');
    }

    return {
      content: choice.message.content,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}

export function createAIProvider(
  provider: string,
  openaiKey?: string,
  groqKey?: string,
): AIProvider {
  switch (provider) {
    case 'openai':
      if (!openaiKey) throw new Error('OpenAI API key required');
      return new OpenAIProvider(openaiKey);
    case 'groq':
      if (!groqKey) throw new Error('Groq API key required');
      return new GroqProvider(groqKey);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export function createEmbeddingProvider(provider: string, openaiKey?: string): EmbeddingProvider {
  switch (provider) {
    case 'openai':
      if (!openaiKey) throw new Error('OpenAI API key required for embeddings');
      return new OpenAIEmbeddingProvider(openaiKey);
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}
