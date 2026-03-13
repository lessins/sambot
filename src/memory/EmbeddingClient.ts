import axios from 'axios';

export class EmbeddingClient {
  private apiKey: string;
  private model:  string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.model  = model  ?? process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
  }

  async embed(text: string): Promise<number[]> {
    const { data } = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { model: this.model, input: text },
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );
    return data.data[0].embedding as number[];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const { data } = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { model: this.model, input: texts },
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );
    return (data.data as Array<{ embedding: number[] }>).map((d) => d.embedding);
  }
}
