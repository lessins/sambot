import { Agent }     from '../src/agent/Agent';
import { LLMClient } from '../src/llm/LLMClient';
import { Plugin, ToolDefinition } from '../src/types';

// mock LLM that always returns a fixed response
function mockLLM(responses: Array<{ content: string; toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }> }>): LLMClient {
  let callIndex = 0;
  return {
    complete: jest.fn().mockImplementation(async () => {
      const r = responses[Math.min(callIndex++, responses.length - 1)];
      return {
        content:    r.content,
        toolCalls:  r.toolCalls ?? [],
        tokensUsed: 100,
        model:      'mock',
      };
    }),
  } as unknown as LLMClient;
}

// simple echo plugin
class EchoPlugin implements Plugin {
  name    = 'echo';
  version = '0.0.1';
  tools: ToolDefinition[] = [
    {
      name: 'echo',
      description: 'Echoes input back',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  ];
  async execute(_: string, args: Record<string, unknown>): Promise<string> {
    return `echo: ${args['text']}`;
  }
}

describe('Agent', () => {
  it('returns final text on first response with no tool calls', async () => {
    const llm   = mockLLM([{ content: 'hello there' }]);
    const agent = new Agent(llm);
    const run   = await agent.run({ input: 'hi' });
    expect(run.output).toBe('hello there');
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0].type).toBe('final');
  });

  it('dispatches tool calls and loops', async () => {
    const llm = mockLLM([
      { content: null as unknown as string, toolCalls: [{ id: 'c1', name: 'echo', arguments: { text: 'world' } }] },
      { content: 'done: echo: world' },
    ]);
    const agent = new Agent(llm);
    agent.registerPlugin(new EchoPlugin());
    const run = await agent.run({ input: 'echo world' });
    expect(run.output).toBe('done: echo: world');
    expect(run.steps.some((s) => s.type === 'tool_call')).toBe(true);
    expect(run.steps.some((s) => s.type === 'tool_result')).toBe(true);
  });

  it('includes sessionId in run result', async () => {
    const agent = new Agent(mockLLM([{ content: 'ok' }]));
    const run   = await agent.run({ input: 'test', sessionId: 'abc-123' });
    expect(run.sessionId).toBe('abc-123');
  });

  it('generates a sessionId when none provided', async () => {
    const agent = new Agent(mockLLM([{ content: 'ok' }]));
    const run   = await agent.run({ input: 'test' });
    expect(typeof run.sessionId).toBe('string');
    expect(run.sessionId.length).toBeGreaterThan(0);
  });

  it('returns error result when plugin throws', async () => {
    const llm = mockLLM([
      { content: null as unknown as string, toolCalls: [{ id: 'c1', name: 'echo', arguments: { text: 'boom' } }] },
      { content: 'handled error' },
    ]);
    const badPlugin: Plugin = {
      name:    'echo',
      version: '0.0.1',
      tools:   new EchoPlugin().tools,
      execute: async () => { throw new Error('plugin exploded'); },
    };
    const agent = new Agent(llm);
    agent.registerPlugin(badPlugin);
    const run = await agent.run({ input: 'cause error' });
    expect(run.steps.some((s) => s.type === 'tool_result' && s.content.includes('plugin exploded'))).toBe(true);
  });

  it('respects maxIterations', async () => {
    // always returns tool calls, never terminates naturally
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content:    null,
        toolCalls:  [{ id: 'x', name: 'echo', arguments: { text: 'loop' } }],
        tokensUsed: 10,
        model:      'mock',
      }),
    } as unknown as LLMClient;

    const agent = new Agent(llm, { maxIterations: 3 });
    agent.registerPlugin(new EchoPlugin());
    const run = await agent.run({ input: 'loop forever' });
    expect((llm.complete as jest.Mock).mock.calls.length).toBeLessThanOrEqual(4);
    expect(run).toBeDefined();
  });
});
