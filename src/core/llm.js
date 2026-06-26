// OpenAI-compatible LLM client (Chutes, free) for ranking viral moments.
// Credentials are NOT stored in this repo. They are read from the process env,
// and if absent we borrow ONLY the LLM_* lines from an existing local .env
// (default: Youtubeauto/.env) so the secret lives in exactly one place.
import fs from 'node:fs';

function borrowLLMEnv() {
  if (process.env.LLM_API_KEY) return;
  const candidates = [
    process.env.CLIPFARM_LLM_ENV,
    `${process.env.HOME}/Youtubeauto/.env`,
  ].filter(Boolean);
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*(LLM_[A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    if (process.env.LLM_API_KEY) break;
  }
}

export async function chat(messages, { temperature = 0.3, maxTokens = 1500, json = false } = {}) {
  borrowLLMEnv();
  const base = process.env.LLM_BASE_URL;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!base || !key || !model) throw new Error('llm: missing LLM_BASE_URL/API_KEY/MODEL');

  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, messages, temperature, max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`llm: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message ?? {};
  // Some reasoning models put the answer in reasoning_content; prefer content.
  return (msg.content || msg.reasoning_content || '').trim();
}
