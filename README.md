# sambot

**your local AI agent.**

sambot runs on your machine and actually does things. it browses the web, reads and writes files, executes code in a sandbox, analyzes images, remembers context across sessions, and carries out multi-step tasks — all from a single prompt.

no cloud middleman. no sending your files to someone else's server.

test deployment: **[wlessin.com](https://wlessin.com)**

---

## what it does

| capability | tools |
|-----------|-------|
| **web** | `web_search`, `browser_fetch`, `browser_links` |
| **code** | `run_code` (python / js / bash, sandboxed) |
| **files** | `fs_read`, `fs_write`, `fs_list`, `fs_delete`, `fs_exists` |
| **vision** | `analyze_image` (local file or URL) |
| **memory** | sqlite + embedding search across sessions |
| **plugins** | drop custom `.js` plugins in `~/.sambot/plugins/` |

## quick start

```bash
git clone https://github.com/lessins/sambot
cd sambot
npm install
cp .env.example .env
# add OPENAI_API_KEY or ANTHROPIC_API_KEY
npm run dev
```

then open `http://localhost:4242` — or just run from the terminal:

```bash
npm run dev -- "summarise everything in my ~/Downloads folder"
npm run dev -- "search for the latest rust release notes and save them to notes.md"
npm run dev -- "what is in this screenshot" ./path/to/img.png
```

## local inference (no API key needed)

sambot supports local GGUF models via native C bindings:

```bash
cd native && make HAVE_LLAMA=1
# download a model — e.g. mistral-7b-instruct.Q4_K_M.gguf
USE_LOCAL_LLM=true LOCAL_LLM_MODEL_PATH=./models/mistral.gguf npm run dev
```

## plugins

drop a directory in `~/.sambot/plugins/` with a `plugin.json` manifest and an entrypoint file. sambot loads it on startup.

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "does a thing",
  "entrypoint": "index.js"
}
```

## self-hosting

the web UI and API server are built in — just run `npm start` and point a reverse proxy at port 4242.

```nginx
location / {
    proxy_pass http://localhost:4242;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

the public test instance runs at [wlessin.com](https://wlessin.com).

## $SAMBOT token

certain features on [wlessin.com](https://wlessin.com) are gated by holding $SAMBOT — extended context, priority inference, private plugins.

**contract: `EgBvRUFV3o36EwnfLhUh49qNMKbHokQ7AvtW5yTfpump`** (Solana)

see [docs/token.md](docs/token.md) for tier details.

## tech

- TypeScript / Node.js
- express + socket.io (streaming)
- better-sqlite3 (memory)
- C native bindings for local inference
- pm2 for production process management

---

*built by lessin*
