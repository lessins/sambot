import { Plugin, ToolDefinition } from '../types';
import { Sandbox, SupportedLang } from '../sandbox/Sandbox';

export class CodePlugin implements Plugin {
  name    = 'code';
  version = '0.2.0';

  private sandbox: Sandbox;

  constructor(sandbox?: Sandbox) {
    this.sandbox = sandbox ?? new Sandbox();
  }

  tools: ToolDefinition[] = [
    {
      name: 'run_code',
      description:
        'Execute code in a sandboxed subprocess and return stdout/stderr. ' +
        'Supported languages: python, javascript, bash. ' +
        'Use this to do calculations, data processing, or anything that needs code.',
      parameters: {
        type: 'object',
        properties: {
          code:     { type: 'string', description: 'The code to execute' },
          language: {
            type:    'string',
            enum:    ['python', 'javascript', 'bash'],
            description: 'Programming language (default: python)',
          },
        },
        required: ['code'],
      },
    },
  ];

  async execute(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (toolName === 'run_code') return this.runCode(args);
    throw new Error(`unknown tool: ${toolName}`);
  }

  private async runCode(args: Record<string, unknown>): Promise<string> {
    const code = args['code'] as string;
    const lang = (args['language'] as SupportedLang) ?? 'python';

    const result = await this.sandbox.run(code, lang);

    const parts: string[] = [];
    if (result.timedOut)       parts.push('⚠️  execution timed out');
    if (result.stdout)         parts.push(`stdout:\n${result.stdout}`);
    if (result.stderr)         parts.push(`stderr:\n${result.stderr}`);
    if (!result.stdout && !result.stderr) parts.push('(no output)');
    parts.push(`exit code: ${result.exitCode}  (${result.duration}ms)`);

    return parts.join('\n\n');
  }
}
