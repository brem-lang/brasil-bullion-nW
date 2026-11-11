import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  Droplet,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { HeroPhoto } from "@/components/landing/HeroPhoto";
import { ROUTE_LOADER_MS, RouteLoader } from "@/components/landing/RouteLoader";
import { fmt, getPrices, type Quote } from "@/lib/prices.functions";

export const Route = createFileRoute("/descubra")({
  head: () => ({
    meta: [
      { title: "Por que o ouro e o petróleo estão chamando atenção dos brasileiros" },
      {
        name: "description",
        content:
          "Inflação, real fraco e poupança perdendo valor: entenda por que brasileiros acima de 30 anos estão olhando para ouro e petróleo — a partir de US$250.",
      },
      { property: "og:title", content: "Sua poupança está perdendo para o ouro?" },
      {
        property: "og:description",
        content:
          "Veja por que ouro e petróleo entraram no radar de quem quer proteger o patrimônio.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => getPrices().catch(() => [] as Quote[]),
  component: Prelander,
});

function CTA({ children = "QUERO VER COMO COMEÇAR AGORA" }: { children?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Show the loader for ROUTE_LOADER_MS, preloading /cadastro meanwhile so it opens instantly.
  // Ctrl/Cmd/Shift/middle clicks keep the browser's normal "open in new tab" behaviour.
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    void router.preloadRoute({ to: "/cadastro", search: true }).catch(() => {});
    setTimeout(() => void navigate({ to: "/cadastro", search: true }), ROUTE_LOADER_MS);
  };

  return (
    <>
      <Link
        to="/cadastro"
        search={true}
        onClick={onClick}
        className="group mx-auto flex w-full max-w-xl items-center justify-center gap-3 rounded-xl bg-gold-gradient px-6 py-5 text-center text-lg font-extrabold text-accent-foreground shadow-gold transition-transform hover:scale-[1.02] sm:text-xl"
      >
        {children} <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
      </Link>
      {loading && <RouteLoader />}
    </>
  );
}

function Countdown() {
  const [s, setS] = useState(15 * 60);
  useEffect(() => {
    const id = setInterval(() => setS((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

function Prelander() {
  const quotes = Route.useLoaderData() ?? [];
  const gold = quotes.find((q) => q.symbol === "GC=F");
  const brent = quotes.find((q) => q.symbol === "BZ=F");
  const brl = quotes.find((q) => q.symbol === "BRL=X");
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-destructive px-4 py-2 text-center text-sm font-bold text-destructive-foreground">
        <Clock className="mr-1 inline h-4 w-4" /> ALERTA: vagas de atendimento com especialista hoje
        se encerram em <Countdown />
      </div>

      <article className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Economia · {today}
        </p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
          Enquanto sua poupança <span className="text-destructive">perde para a inflação</span>,
          brasileiros acima de 30 anos estão migrando para o{" "}
          <span className="text-gold-gradient">ouro</span> e o{" "}
          <span className="text-gold-gradient">petróleo</span>
        </h1>
        <p className="mt-5 text-xl text-muted-foreground">
          O real perdeu valor, os preços no mercado só sobem — e quem deixou o dinheiro parado ficou
          para trás. Veja o que os mais atentos estão fazendo agora.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl shadow-card">
          <HeroPhoto
            gold={gold}
            label="Investidor acompanhando o preço do ouro"
            viewBox="0 60 1024 720"
            className="block aspect-[1024/720] w-full"
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            [Coins, "Ouro hoje", gold ? `US$ ${fmt(gold.price)}` : "—", gold?.changePct],
            [Droplet, "Petróleo Brent", brent ? `US$ ${fmt(brent.price)}` : "—", brent?.changePct],
            [TrendingDown, "1 dólar custa", brl ? `R$ ${fmt(brl.price)}` : "—", brl?.changePct],
          ].map(([I, l, v, c]) => {
            const Icon = I as typeof Coins;
            const pct = c as number | undefined;
            return (
              <div key={l as string} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary" /> {l as string}
                </div>
                <div className="mt-1 font-display text-2xl font-bold">{v as string}</div>
                {pct !== undefined && (
                  <div
                    className={`text-sm font-semibold ${pct >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {pct >= 0 ? "+" : ""}
                    {fmt(pct)}% hoje
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Cotações reais, atualizadas a cada minuto.
        </p>

        <h2 className="mt-12 text-3xl font-bold">A verdade que o seu banco não conta</h2>
        <p className="mt-4 text-lg leading-relaxed">
          Há poucos anos o dólar valia menos de R$4. Hoje vale{" "}
          <b>{brl ? `R$ ${fmt(brl.price)}` : "muito mais"}</b>. Cada real guardado na poupança
          compra menos a cada mês. Enquanto isso, o ouro bateu recordes históricos e passou de{" "}
          <b>US$ {gold ? fmt(gold.price, 0) : "4.000"}</b> a onça.
        </p>
        <p className="mt-4 text-lg leading-relaxed">
          Grandes fundos e bancos centrais do mundo inteiro estão comprando ouro. O petróleo
          continua sendo o combustível da economia global.{" "}
          <b>
            A pergunta não é se você deveria olhar para esses ativos — é quanto tempo mais você vai
            esperar.
          </b>
        </p>

        <div className="my-10">
          <CTA />
        </div>

        <h2 className="text-3xl font-bold">Por que ouro e petróleo — e por que agora?</h2>
        <ul className="mt-6 space-y-4">
          {[
            [
              "O ouro é proteção há 5.000 anos",
              "Em crises, guerras e inflação, é para o ouro que o dinheiro grande corre.",
            ],
            [
              "O petróleo se move todos os dias",
              "Notícias globais geram movimentos fortes — na alta e na baixa.",
            ],
            [
              "Você não precisa ser rico para começar",
              "Com apenas US$250 (cerca de R$" +
                (brl ? fmt(brl.price * 250, 0) : "1.400") +
                ") você já pode operar.",
            ],
            [
              "Você não vai estar sozinho",
              "Um especialista em português acompanha você desde o primeiro dia.",
            ],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3 rounded-xl bg-secondary p-5">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <b className="text-lg">{t}</b>
                <p className="text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-12 rounded-2xl bg-deep-gradient p-8 text-deep-foreground">
          <TrendingUp className="h-10 w-10 text-gold" />
          <h2 className="mt-4 text-3xl font-bold">Quem espera, paga mais caro.</h2>
          <p className="mt-3 text-lg text-deep-foreground/80">
            Todo dia que você adia é mais um dia com o seu dinheiro perdendo valor. O cadastro leva
            menos de 1 minuto — e um especialista entra em contato pelo WhatsApp.
          </p>
          <div className="mt-6">
            <CTA>SIM, QUERO FALAR COM UM ESPECIALISTA</CTA>
          </div>
        </div>

        <div className="mt-10 flex gap-3 rounded-xl border border-border p-5 text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p>
            Conteúdo publicitário. Operar commodities e CFDs envolve alto risco e pode resultar na
            perda de todo o capital investido. Desempenho passado não garante resultados futuros.
            Destinado a maiores de 30 anos residentes no Brasil.
          </p>
        </div>
      </article>
    </div>
  );
}
