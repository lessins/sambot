import { v4 as uuidv4 } from 'uuid';
import { LLMClient }    from '../llm/LLMClient';
import {
  AgentConfig, AgentRun, AgentStep,
  Message, Plugin, RunOptions,
  ToolCall, ToolResult,
} from '../types';

const DEFAULT_SYSTEM = `You are sambot — a capable local AI agent running on the user's machine.
You have access to tools that let you browse the web, read and write files, execute code,
and analyze images. Use them to complete tasks fully and accurately.
Think step by step. When a tool gives you a result, reason over it before deciding what to do next.
Always complete the task — don't stop halfway.`;

export class Agent {
  private llm:      LLMClient;
  private plugins:  Map<string, Plugin> = new Map();
  private config:   AgentConfig;

  constructor(llm: LLMClient, config: Partial<AgentConfig> = {}) {
    this.llm    = llm;
    this.config = {
      model:         config.model         ?? 'gpt-4o',
      maxIterations: config.maxIterations ?? 20,
      systemPrompt:  config.systemPrompt  ?? DEFAULT_SYSTEM,
      tools:         config.tools         ?? [],
      temperature:   config.temperature   ?? 0.7,
      verbose:       config.verbose       ?? false,
    };
  }

  registerPlugin(plugin: Plugin): void {
    this.plugins.set(plugin.name, plugin);
    this.config.tools.push(...plugin.tools);
    if (this.config.verbose) {
      console.log(`[sambot] plugin registered: ${plugin.name} (${plugin.tools.length} tools)`);
    }
  }

  async run(opts: RunOptions): Promise<AgentRun> {
    const sessionId = opts.sessionId ?? uuidv4();
    const startTime = Date.now();
    const steps:    AgentStep[] = [];
    const messages: Message[]   = [
      { role: 'system',  content: this.config.systemPrompt },
      { role: 'user',    content: opts.input },
    ];

    let iterations = 0;
    let finalOutput = '';

    if (this.config.verbose) {
      console.log(`\n[sambot] run ${sessionId}`);
      console.log(`[sambot] input: ${opts.input}\n`);
    }

    while (iterations < this.config.maxIterations) {
      iterations++;

      const response = await this.llm.complete(messages, this.config.tools);

      if (response.content && response.toolCalls.length === 0) {
        finalOutput = response.content;
        steps.push({ type: 'final', content: finalOutput, timestamp: Date.now() });
        break;
      }

      if (response.content) {
        steps.push({ type: 'thought', content: response.content, timestamp: Date.now() });
        messages.push({ role: 'assistant', content: response.content });
      }

      if (response.toolCalls.length === 0) break;

      const toolResults: ToolResult[] = [];
      for (const call of response.toolCalls) {
        const result = await this.dispatchTool(call);
        toolResults.push(result);
        steps.push({
          type:     'tool_call',
          content:  `${call.name}(${JSON.stringify(call.arguments)})`,
          toolName: call.name,
          toolArgs: call.arguments,
          timestamp: Date.now(),
        });
        steps.push({
          type:     'tool_result',
          content:  result.error ?? result.result,
          toolName: call.name,
          timestamp: Date.now(),
        });
        if (this.config.verbose) {
          console.log(`[tool] ${call.name}`, call.arguments);
          console.log(`[result] ${(result.error ?? result.result).slice(0, 200)}`);
        }
      }

      messages.push({
        role:    'assistant',
        content: response.content ?? '',
      });

      for (const tr of toolResults) {
        messages.push({
          role:        'tool',
          content:     tr.error ? `error: ${tr.error}` : tr.result,
          toolCallId:  tr.toolCallId,
          toolName:    tr.name,
        });
      }
    }

    if (!finalOutput) {
      finalOutput = messages[messages.length - 1]?.content ?? '';
    }

    return {
      sessionId,
      input:      opts.input,
      output:     finalOutput,
      steps,
      duration:   Date.now() - startTime,
      tokensUsed: 0,
    };
  }

  private async dispatchTool(call: ToolCall): Promise<ToolResult> {
    for (const [, plugin] of this.plugins) {
      const hasTool = plugin.tools.some((t) => t.name === call.name);
      if (hasTool) {
        try {
          const result = await plugin.execute(call.name, call.arguments);
          return { toolCallId: call.id, name: call.name, result };
        } catch (err) {
          return {
            toolCallId: call.id,
            name:       call.name,
            result:     '',
            error:      (err as Error).message,
          };
        }
      }
    }
    return {
      toolCallId: call.id,
      name:       call.name,
      result:     '',
      error:      `no handler registered for tool: ${call.name}`,
    };
  }
}
