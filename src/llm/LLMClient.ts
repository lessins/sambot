import axios from 'axios';
import { Message, ToolCall, ToolDefinition } from '../types';

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
  tokensUsed: number;
  model: string;
}

export interface LLMClientConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMClient {
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
  }

  async complete(
    messages: Message[],
    tools: ToolDefinition[] = [],
  ): Promise<LLMResponse> {
    if (this.config.provider === 'openai') {
      return this.openaiComplete(messages, tools);
    }
    return this.anthropicComplete(messages, tools);
  }

  private async openaiComplete(
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<LLMResponse> {
    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      })),
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 4096,
    };

    if (tools.length > 0) {
      payload.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      payload.tool_choice = 'auto';
    }

    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      { headers: { Authorization: `Bearer ${this.config.apiKey}` } },
    );

    const choice    = data.choices[0];
    const message   = choice.message;
    const toolCalls: ToolCall[] = (message.tool_calls || []).map(
      (tc: { id: string; function: { name: string; arguments: string } }) => ({
        id:        tc.id,
        name:      tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}'),
      }),
    );

    return {
      content:    message.content,
      toolCalls,
      tokensUsed: data.usage?.total_tokens ?? 0,
      model:      data.model,
    };
  }

  private async anthropicComplete(
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<LLMResponse> {
    const system   = messages.find((m) => m.role === 'system')?.content ?? '';
    const filtered = messages.filter((m) => m.role !== 'system');

    const payload: Record<string, unknown> = {
      model:      this.config.model,
      system,
      messages:   filtered.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: this.config.maxTokens ?? 4096,
    };

    if (tools.length > 0) {
      payload.tools = tools.map((t) => ({
        name:         t.name,
        description:  t.description,
        input_schema: t.parameters,
      }));
    }

    const { data } = await axios.post(
      'https://api.anthropic.com/v1/messages',
      payload,
      {
        headers: {
          'x-api-key':         this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
    );

    const textBlock = data.content.find((b: { type: string }) => b.type === 'text');
    const toolBlocks = data.content.filter((b: { type: string }) => b.type === 'tool_use');

    const toolCalls: ToolCall[] = toolBlocks.map(
      (b: { id: string; name: string; input: Record<string, unknown> }) => ({
        id:        b.id,
        name:      b.name,
        arguments: b.input,
      }),
    );

    return {
      content:    textBlock?.text ?? null,
      toolCalls,
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      model:      data.model,
    };
  }

  static fromEnv(): LLMClient {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey    = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      return new LLMClient({
        provider:    'anthropic',
        model:       'claude-3-5-sonnet-20241022',
        apiKey:      anthropicKey,
        temperature: 0.7,
      });
    }
    if (openaiKey) {
      return new LLMClient({
        provider:    'openai',
        model:       'gpt-4o',
        apiKey:      openaiKey,
        temperature: 0.7,
      });
    }
    throw new Error('no LLM API key found — set OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }
}
