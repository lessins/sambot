/*
 * sambot_infer.c
 *
 * Local inference backend for sambot.
 * Wraps llama.cpp for GGUF model support.
 *
 * To build:
 *   1. clone llama.cpp into native/llama.cpp
 *   2. run make -C native
 *
 * If llama.cpp is not present, sambot falls back to the cloud API.
 */

#include "sambot_infer.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>

#ifdef HAVE_LLAMA_CPP
  #include "llama.cpp/llama.h"
#endif

/* ---- default params ---- */

static SambotModelParams default_params(void) {
  SambotModelParams p;
  p.n_ctx        = 4096;
  p.n_threads    = 4;
  p.n_gpu_layers = 0;
  p.seed         = -1;
  p.temperature  = 0.7f;
  p.top_p        = 0.9f;
  p.max_tokens   = 512;
  p.verbose      = 0;
  return p;
}

/* ---- stub structs (used when llama.cpp not available) ---- */

struct SambotModel {
  char   model_path[512];
  int    ctx_size;
  int    vocab_size;
  int    loaded;
#ifdef HAVE_LLAMA_CPP
  struct llama_model *llama;
#endif
};

struct SambotContext {
  SambotModel        *model;
  SambotModelParams   params;
#ifdef HAVE_LLAMA_CPP
  struct llama_context *lctx;
#endif
};

/* ---- model loading ---- */

SambotModel *sambot_load_model(const char *model_path, SambotModelParams params)
{
  if (!model_path || strlen(model_path) == 0) return NULL;

  SambotModel *m = calloc(1, sizeof(SambotModel));
  if (!m) return NULL;

  strncpy(m->model_path, model_path, sizeof(m->model_path) - 1);
  m->ctx_size   = params.n_ctx;
  m->vocab_size = 32000;  /* default; overridden after load */

#ifdef HAVE_LLAMA_CPP
  struct llama_model_params lparams = llama_model_default_params();
  lparams.n_gpu_layers = params.n_gpu_layers;

  m->llama = llama_load_model_from_file(model_path, lparams);
  if (!m->llama) {
    fprintf(stderr, "[sambot] failed to load model: %s\n", model_path);
    free(m);
    return NULL;
  }
  m->vocab_size = llama_n_vocab(m->llama);
  m->loaded     = 1;
#else
  fprintf(stderr, "[sambot] llama.cpp not compiled in — using stub\n");
  m->loaded = 0;
#endif

  return m;
}

SambotContext *sambot_new_context(SambotModel *model)
{
  if (!model) return NULL;
  SambotContext *ctx = calloc(1, sizeof(SambotContext));
  if (!ctx) return NULL;
  ctx->model  = model;
  ctx->params = default_params();

#ifdef HAVE_LLAMA_CPP
  struct llama_context_params cparams = llama_context_default_params();
  cparams.n_ctx     = model->ctx_size;
  cparams.n_threads = ctx->params.n_threads;
  cparams.seed      = ctx->params.seed == -1 ? time(NULL) : (uint32_t)ctx->params.seed;

  ctx->lctx = llama_new_context_with_model(model->llama, cparams);
  if (!ctx->lctx) {
    free(ctx);
    return NULL;
  }
#endif

  return ctx;
}

/* ---- inference ---- */

SambotInferResult sambot_infer(SambotContext *ctx, const char *prompt, int max_tokens)
{
  SambotInferResult result = { NULL, 0, 0, 0.0 };
  if (!ctx || !prompt) return result;

#ifdef HAVE_LLAMA_CPP
  /* full implementation — tokenize → decode → sample */
  int n_prompt_tokens = llama_tokenize(
    ctx->model->llama, prompt, strlen(prompt), NULL, 0, true, false
  );

  llama_token *tokens_in = malloc(sizeof(llama_token) * n_prompt_tokens);
  llama_tokenize(
    ctx->model->llama, prompt, strlen(prompt),
    tokens_in, n_prompt_tokens, true, false
  );

  llama_decode(ctx->lctx, llama_batch_get_one(tokens_in, n_prompt_tokens, 0, 0));
  free(tokens_in);

  char *out  = malloc(max_tokens * 8);
  int   pos  = 0;
  clock_t t0 = clock();

  for (int i = 0; i < max_tokens; i++) {
    llama_token next = llama_sample_token_greedy(ctx->lctx, NULL);
    if (next == llama_token_eos(ctx->model->llama)) break;

    char piece[16] = {0};
    llama_token_to_piece(ctx->model->llama, next, piece, sizeof(piece));
    int plen = strlen(piece);
    memcpy(out + pos, piece, plen);
    pos += plen;

    llama_decode(ctx->lctx, llama_batch_get_one(&next, 1, n_prompt_tokens + i, 0));
  }
  out[pos] = '\0';

  result.text          = out;
  result.tokens_in     = n_prompt_tokens;
  result.tokens_out    = pos;
  result.ms_per_token  = (double)(clock() - t0) / CLOCKS_PER_SEC * 1000.0 / (pos + 1);
#else
  /* stub: echo prompt back so the node layer knows inference isn't available */
  const char *stub = "[local inference not available — llama.cpp not compiled]";
  result.text      = strdup(stub);
  result.tokens_in  = 0;
  result.tokens_out = 0;
#endif

  return result;
}

int sambot_infer_stream(
  SambotContext *ctx,
  const char    *prompt,
  int            max_tokens,
  int (*callback)(const char *token, void *user_data),
  void *user_data
) {
  if (!ctx || !prompt || !callback) return -1;

#ifdef HAVE_LLAMA_CPP
  /* streaming decode loop — call callback per token */
  int n = llama_tokenize(ctx->model->llama, prompt, strlen(prompt), NULL, 0, true, false);
  llama_token *tokens_in = malloc(sizeof(llama_token) * n);
  llama_tokenize(ctx->model->llama, prompt, strlen(prompt), tokens_in, n, true, false);
  llama_decode(ctx->lctx, llama_batch_get_one(tokens_in, n, 0, 0));
  free(tokens_in);

  for (int i = 0; i < max_tokens; i++) {
    llama_token next = llama_sample_token_greedy(ctx->lctx, NULL);
    if (next == llama_token_eos(ctx->model->llama)) break;

    char piece[16] = {0};
    llama_token_to_piece(ctx->model->llama, next, piece, sizeof(piece));
    if (callback(piece, user_data) != 0) break;

    llama_decode(ctx->lctx, llama_batch_get_one(&next, 1, n + i, 0));
  }
  return 0;
#else
  callback("[local inference not available]", user_data);
  return 0;
#endif
}

/* ---- cleanup ---- */

void sambot_free_result(SambotInferResult *r)  { if (r && r->text) free((void *)r->text); }
void sambot_free_context(SambotContext *ctx)    { if (ctx) { free(ctx); } }
void sambot_free_model(SambotModel *m)          { if (m)   { free(m);   } }

/* ---- tokenizer helpers ---- */

int sambot_tokenize(SambotModel *m, const char *text, int32_t *out, int out_len)
{
#ifdef HAVE_LLAMA_CPP
  return llama_tokenize(m->llama, text, strlen(text), (llama_token *)out, out_len, false, false);
#else
  (void)m; (void)text; (void)out; (void)out_len;
  return 0;
#endif
}

int  sambot_context_size(SambotModel *m) { return m ? m->ctx_size   : 0; }
int  sambot_vocab_size(SambotModel *m)   { return m ? m->vocab_size : 0; }
const char *sambot_model_name(SambotModel *m) {
  return m ? m->model_path : "";
}
