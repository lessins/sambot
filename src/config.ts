import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port:      parseInt(process.env.PORT ?? '4242', 10),
  host:      process.env.HOST ?? 'localhost',
  logLevel:  process.env.LOG_LEVEL ?? 'info',
  memoryDb:  process.env.MEMORY_DB_PATH ?? './.sambot/memory.sqlite',
  useLocal:  process.env.USE_LOCAL_LLM === 'true',
  localModelPath: process.env.LOCAL_LLM_MODEL_PATH ?? '',
};
