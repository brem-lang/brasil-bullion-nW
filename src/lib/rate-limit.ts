// Fixed-window counter in this Node process's memory (same approach as
// arabic-trading-spark, without its Cloudflare Workers binding).

/** A limit of `limit` hits per `windowMs` for one key. */
export type RateRule = { limit: number; windowMs: number };

const hits = new Map<string, { start: number; count: number; windowMs: number }>();

export function isRateLimited(key: string, rule: RateRule, now = Date.now()): boolean {
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (now - v.start >= v.windowMs) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || now - entry.start >= entry.windowMs) {
    hits.set(key, { start: now, count: 1, windowMs: rule.windowMs });
    return false;
  }
  entry.count++;
  return entry.count > rule.limit;
}

export function resetRateLimit(): void {
  hits.clear();
}
