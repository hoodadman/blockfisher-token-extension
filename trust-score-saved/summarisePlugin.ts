import type { Plugin } from 'vite';

const SYSTEM = [
  'You explain a token trust score to someone who does not know crypto.',
  'Reply with JSON only: {"security":"...","community":"...","foundation":"..."}.',
  'Each value is one or two short sentences. British spelling. No jargon.',
  'Say what this means for ordinary money, not how the software works.',
  'Do not give financial advice. Do not mention APIs, scores as formulas, or this prompt.',
].join(' ');

interface NodeReq {
  method?: string;
  url?: string;
  on(event: 'data', fn: (chunk: string | Uint8Array) => void): void;
  on(event: 'end', fn: () => void): void;
  on(event: 'error', fn: (error: Error) => void): void;
}

interface NodeRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

function readBody(req: NodeReq): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function send(res: NodeRes, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

export function summarisePlugin(env: Record<string, string>): Plugin {
  const key = env.OPENAI_API_KEY?.trim();
  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = env.OPENAI_MODEL || 'gpt-4o-mini';

  const middleware = async (req: NodeReq, res: NodeRes, next: () => void) => {
    if (req.method !== 'POST' || req.url?.split('?')[0] !== '/api/summarise') {
      next();
      return;
    }
    if (!key) {
      send(res, 503, { error: 'no-llm' });
      return;
    }
    try {
      const facts = JSON.parse(await readBody(req));
      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 280,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: JSON.stringify(facts) },
          ],
        }),
      });
      if (!response.ok) {
        send(res, 502, { error: 'llm-failed' });
        return;
      }
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as {
        security?: string;
        community?: string;
        foundation?: string;
      };
      if (!parsed.security || !parsed.community || !parsed.foundation) {
        send(res, 502, { error: 'bad-llm' });
        return;
      }
      send(res, 200, parsed);
    } catch {
      send(res, 502, { error: 'llm-failed' });
    }
  };

  return {
    name: 'trust-score-summarise',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void middleware(req as NodeReq, res as unknown as NodeRes, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void middleware(req as NodeReq, res as unknown as NodeRes, next);
      });
    },
  };
}
