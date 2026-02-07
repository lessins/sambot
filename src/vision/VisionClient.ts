import axios  from 'axios';
import fs      from 'fs';
import path    from 'path';

export type VisionBackend = 'openai' | 'anthropic';

export interface VisionAnalysis {
  description: string;
  text?:       string;   // OCR'd text if present
  objects?:    string[];
  model:       string;
}

export class VisionClient {
  private backend: VisionBackend;
  private apiKey:  string;

  constructor(backend?: VisionBackend, apiKey?: string) {
    this.backend = backend ?? (process.env.VISION_BACKEND as VisionBackend) ?? 'openai';
    this.apiKey  = apiKey  ?? (
      this.backend === 'anthropic'
        ? (process.env.ANTHROPIC_API_KEY ?? '')
        : (process.env.OPENAI_API_KEY    ?? '')
    );
  }

  async analyzeFile(filePath: string, prompt?: string): Promise<VisionAnalysis> {
    const abs    = path.resolve(filePath);
    const buffer = fs.readFileSync(abs);
    const ext    = path.extname(abs).toLowerCase().slice(1);
    const mime   = this.mimeType(ext);
    const b64    = buffer.toString('base64');
    return this.analyzeBase64(b64, mime, prompt);
  }

  async analyzeUrl(url: string, prompt?: string): Promise<VisionAnalysis> {
    const { data, headers } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });
    const mime = (headers['content-type'] as string).split(';')[0];
    const b64  = Buffer.from(data).toString('base64');
    return this.analyzeBase64(b64, mime, prompt);
  }

  private async analyzeBase64(
    b64:    string,
    mime:   string,
    prompt: string = 'Describe this image in detail. If there is any text, extract it.',
  ): Promise<VisionAnalysis> {
    if (this.backend === 'anthropic') return this.anthropicVision(b64, mime, prompt);
    return this.openaiVision(b64, mime, prompt);
  }

  private async openaiVision(b64: string, mime: string, prompt: string): Promise<VisionAnalysis> {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
        max_tokens: 1024,
      },
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );

    const content = data.choices[0].message.content as string;
    return { description: content, model: data.model };
  }

  private async anthropicVision(b64: string, mime: string, prompt: string): Promise<VisionAnalysis> {
    const { data } = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
    );

    const content = data.content.find((b: { type: string }) => b.type === 'text')?.text ?? '';
    return { description: content, model: data.model };
  }

  private mimeType(ext: string): string {
    const map: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png',  gif: 'image/gif',
      webp: 'image/webp', bmp: 'image/bmp',
    };
    return map[ext] ?? 'image/jpeg';
  }
}
