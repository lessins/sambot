import { Plugin, ToolDefinition } from '../types';
import { VisionClient }           from '../vision/VisionClient';

export class ImagePlugin implements Plugin {
  name    = 'image';
  version = '0.1.0';

  private vision: VisionClient;

  constructor(vision?: VisionClient) {
    this.vision = vision ?? new VisionClient();
  }

  tools: ToolDefinition[] = [
    {
      name: 'analyze_image',
      description:
        'Analyze an image from a local file path or URL. Returns a description and any text found in the image.',
      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Local file path or URL of the image',
          },
          prompt: {
            type: 'string',
            description: 'Optional specific question or instruction about the image',
          },
        },
        required: ['source'],
      },
    },
  ];

  async execute(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (toolName === 'analyze_image') return this.analyze(args);
    throw new Error(`unknown tool: ${toolName}`);
  }

  private async analyze(args: Record<string, unknown>): Promise<string> {
    const source = args['source'] as string;
    const prompt = args['prompt'] as string | undefined;

    const isUrl = source.startsWith('http://') || source.startsWith('https://');
    const result = isUrl
      ? await this.vision.analyzeUrl(source, prompt)
      : await this.vision.analyzeFile(source, prompt);

    return result.description;
  }
}
