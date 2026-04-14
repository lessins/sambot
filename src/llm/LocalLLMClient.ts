import path   from 'path';
import { LLMResponse } from './LLMClient';
import { Message }     from '../types';
import { logger }      from '../utils/logger';

interface NativeInfer {
  loadModel(modelPath: string, params: object): unknown;
  newContext(model: unknown): unknown;
  infer(ctx: unknown, prompt: string, maxTokens: number): { text: string; tokensIn: number; tokensOut: number; msPerToken: number };
  freeContext(ctx: unknown): void;
  freeModel(model: unknown): void;
}

export class LocalLLMClient {
  private native: NativeInfer | null = null;
  private model:  unknown            = null;
  private ctx:    unknown            = null;
  private modelPath: string;

  constructor(modelPath?: string) {
    this.modelPath = modelPath ?? process.env.LOCAL_LLM_MODEL_PATH ?? '';
  }

  async init(): Promise<void> {
    const nativePath = path.join(__dirname, '../../native/libsambot_infer');
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.native = require(nativePath) as NativeInfer;
      this.model  = this.native.loadModel(this.modelPath, { n_ctx: 4096, n_threads: 4 });
      this.ctx    = this.native.newContext(this.model);
      logger.info(`local model loaded: ${this.modelPath}`);
    } catch (err) {
      logger.warn(`local inference not available: ${(err as Error).message}`);
      this.native = null;
    }
  }

  isAvailable(): boolean {
    return this.native !== null && this.ctx !== null;
  }

  async complete(messages: Message[]): Promise<LLMResponse> {
    if (!this.native || !this.ctx) {
      throw new Error('local LLM not initialised — call init() first');
    }

    const prompt = this.messagesToPrompt(messages);
    const result = this.native.infer(this.ctx, prompt, 1024);

    return {
      content:    result.text,
      toolCalls:  [],
      tokensUsed: result.tokensIn + result.tokensOut,
      model:      path.basename(this.modelPath),
    };
  }

  private messagesToPrompt(messages: Message[]): string {
    return messages
      .map((m) => {
        if (m.role === 'system')    return `<|system|>\n${m.content}\n`;
        if (m.role === 'user')      return `<|user|>\n${m.content}\n`;
        if (m.role === 'assistant') return `<|assistant|>\n${m.content}\n`;
        return `${m.content}\n`;
      })
      .join('') + '<|assistant|>\n';
  }

  destroy(): void {
    if (this.native && this.ctx)   this.native.freeContext(this.ctx);
    if (this.native && this.model) this.native.freeModel(this.model);
  }
}
