import dotenv from 'dotenv';
dotenv.config();

import { Agent }     from './agent/Agent';
import { LLMClient } from './llm/LLMClient';

async function main(): Promise<void> {
  const llm   = LLMClient.fromEnv();
  const agent = new Agent(llm, { verbose: true });

  const input = process.argv.slice(2).join(' ') || 'what can you help me with?';
  const run   = await agent.run({ input });

  console.log('\n' + run.output);
  console.log(`\n[sambot] done in ${run.duration}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
