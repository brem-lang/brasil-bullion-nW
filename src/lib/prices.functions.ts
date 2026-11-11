import { createServerFn } from "@tanstack/react-start";

export const SYMBOLS = [
  ["GC=F", "OURO (XAU/USD)"],
  ["BZ=F", "PETRÓLEO BRENT"],
  ["CL=F", "PETRÓLEO WTI"],
  ["SI=F", "PRATA"],
  ["NG=F", "GÁS NATURAL"],
  ["BRL=X", "USD/BRL"],
] as const;

export type Quote = { symbol: string; label: string; price: number; change: number; changePct: number };

let cache: { at: number; data: Quote[] } | null = null;

export const getPrices = createServerFn({ method: "GET" }).handler(async (): Promise<Quote[]> => {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const results = await Promise.all(
    SYMBOLS.map(async ([symbol, label]) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
          { headers: { "User-Agent": "Mozilla/5.0" } },
        );
        if (!res.ok) return null;
        const j = (await res.json()) as { chart?: { result?: { meta: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number } }[] } };
        const m = j.chart?.result?.[0]?.meta;
        if (!m?.regularMarketPrice) return null;
        const prev = m.chartPreviousClose ?? m.previousClose ?? m.regularMarketPrice;
        const price = m.regularMarketPrice;
        return { symbol, label, price, change: price - prev, changePct: ((price - prev) / prev) * 100 } as Quote;
      } catch {
        return null;
      }
    }),
  );
  const data = results.filter((q): q is Quote => q !== null);
  if (data.length) cache = { at: Date.now(), data };
  return data;
});

export const fmt = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
