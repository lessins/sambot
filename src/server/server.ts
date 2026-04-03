import express, { Request, Response } from 'express';
import http                           from 'http';
import path                           from 'path';
import { Server as IOServer }         from 'socket.io';
import { Agent }                      from '../agent/Agent';
import { LLMClient }                  from '../llm/LLMClient';
import { PluginManager }              from '../plugins/PluginManager';
import { registerBuiltins }           from '../plugins/builtins';
import { MemoryStore }                from '../memory/MemoryStore';
import { logger }                     from '../utils/logger';
import { config }                     from '../config';

export function createServer(): http.Server {
  const app    = express();
  const server = http.createServer(app);
  const io     = new IOServer(server, { cors: { origin: '*' } });

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../public')));

  const llm     = LLMClient.fromEnv();
  const plugins = new PluginManager();
  registerBuiltins(plugins);

  const memory = new MemoryStore();

  // health
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, version: '0.5.0', plugins: plugins.list().map((p) => p.name) });
  });

  // list plugins/tools
  app.get('/api/tools', (_req: Request, res: Response) => {
    res.json(plugins.getAllTools());
  });

  // one-shot run
  app.post('/api/run', async (req: Request, res: Response) => {
    const { input, sessionId } = req.body as { input: string; sessionId?: string };
    if (!input) { res.status(400).json({ error: 'input required' }); return; }

    try {
      const agent = new Agent(llm, { tools: plugins.getAllTools(), verbose: false });
      plugins.getAll().forEach((p) => agent.registerPlugin(p));
      const run = await agent.run({ input, sessionId });
      res.json(run);
    } catch (err) {
      logger.error((err as Error).message);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // streaming via websocket
  io.on('connection', (socket) => {
    logger.info(`ws connect ${socket.id}`);

    socket.on('run', async (data: { input: string; sessionId?: string }) => {
      const agent = new Agent(llm, { tools: plugins.getAllTools(), verbose: false });
      plugins.getAll().forEach((p) => agent.registerPlugin(p));

      socket.emit('start', { sessionId: data.sessionId });

      try {
        const run = await agent.run({
          input:     data.input,
          sessionId: data.sessionId,
        });

        run.steps.forEach((step) => socket.emit('step', step));
        socket.emit('done', { output: run.output, duration: run.duration });

        memory.save({
          id:        run.sessionId + '-' + Date.now(),
          sessionId: run.sessionId,
          content:   `user: ${run.input}\nsambot: ${run.output}`,
        });
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    socket.on('disconnect', () => logger.info(`ws disconnect ${socket.id}`));
  });

  return server;
}

export function startServer(): void {
  const server = createServer();
  const port   = config.port;
  server.listen(port, () => {
    logger.info(`sambot server running at http://${config.host}:${port}`);
    logger.info(`test deployment: https://wlessin.com`);
  });
}
