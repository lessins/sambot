#ifndef SAMBOT_INFER_H
#define SAMBOT_INFER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * sambot native inference bridge
 *
 * Thin C layer over llama.cpp-compatible GGUF model loading.
 * Called from Node.js via N-API (see sambot_napi.c).
 * Allows sambot to run fully local inference without a cloud API key.
 *
 * Build: make -C native
 * Usage in Node: require('./native/build/sambot_infer.node')
 */

typedef struct SambotModel SambotModel;
typedef struct SambotContext SambotContext;

typedef struct {
  int     n_ctx;          /* context window size (default 4096) */
  int     n_threads;      /* inference threads (default: cpu count - 1) */
  int     n_gpu_layers;   /* layers to offload to GPU (0 = CPU only) */
  int     seed;           /* RNG seed (-1 = random) */
  float   temperature;    /* sampling temperature */
  float   top_p;          /* nucleus sampling p */
  int     max_tokens;     /* max output tokens */
  int     verbose;        /* print loading progress */
} SambotModelParams;

typedef struct {
  const char *text;         /* generated text (null-terminated) */
  int         tokens_in;
  int         tokens_out;
  double      ms_per_token;
} SambotInferResult;

/* Load a GGUF model from disk. Returns NULL on failure. */
SambotModel *sambot_load_model(const char *model_path, SambotModelParams params);

/* Create an inference context from a loaded model. */
SambotContext *sambot_new_context(SambotModel *model);

/* Run inference. Caller must free result->text with sambot_free_result(). */
SambotInferResult sambot_infer(
  SambotContext *ctx,
  const char    *prompt,
  int            max_tokens
);

/* Run inference with a streaming callback.
 * callback is invoked for each generated token.
 * Return non-zero from callback to stop generation early.
 */
int sambot_infer_stream(
  SambotContext *ctx,
  const char    *prompt,
  int            max_tokens,
  int (*callback)(const char *token, void *user_data),
  void *user_data
);

void sambot_free_result(SambotInferResult *result);
void sambot_free_context(SambotContext *ctx);
void sambot_free_model(SambotModel *model);

/* Tokenizer helpers */
int     sambot_tokenize(SambotModel *model, const char *text, int32_t *out, int out_len);
char   *sambot_detokenize(SambotModel *model, const int32_t *tokens, int n_tokens);
int     sambot_context_size(SambotModel *model);
int     sambot_vocab_size(SambotModel *model);
const char *sambot_model_name(SambotModel *model);

#ifdef __cplusplus
}
#endif

#endif /* SAMBOT_INFER_H */
