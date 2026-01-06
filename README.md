# sambot

**your local AI agent.**

sambot runs on your machine and actually does things. it browses the web, reads and writes files, executes code, analyzes images, and carries out multi-step tasks — all from a single prompt.

no cloud middleman. no sending your files to someone else's server. it runs where you run it.

---

## what it does

- **web** — searches, reads pages, follows links, summarizes
- **code** — writes and executes in a sandboxed environment, reads back results
- **files** — reads, writes, organizes files on your local machine
- **vision** — describes and reasons over images and screenshots
- **memory** — remembers context across sessions using local embeddings
- **plugins** — extend with your own tools

## status

early. things break. building in public.

test deployment: [wlessin.com](https://wlessin.com)

---

## quick start

```bash
git clone https://github.com/lessins/sambot
cd sambot
npm install
cp .env.example .env
# add your API keys
npm run dev
```

## stack

- TypeScript / Node.js
- local LLM inference via native C bindings (optional)
- pluggable tool system
- sqlite for memory

---

*built by lessin*
