import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Coins,
  Droplet,
  Headphones,
  PhoneCall,
  Smartphone,
  TrendingUp,
  UserCheck,
  Wallet,
  Star,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LeadForm } from "@/components/landing/LeadForm";
import { useEffect, useState } from "react";
import { HeroPhoto } from "@/components/landing/HeroPhoto";
import { fmt, getPrices, type Quote } from "@/lib/prices.functions";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Invista em Ouro e Petróleo a partir de US$250 | Commodities Brasil" },
      {
        name: "description",
        content:
          "Opere ouro e petróleo com depósito mínimo de US$250, suporte em português e especialista dedicado. Cadastro em 1 minuto.",
      },
      { property: "og:title", content: "Invista em Ouro e Petróleo a partir de US$250" },
      {
        property: "og:description",
        content:
          "Suporte em português, especialista dedicado e depósito via PIX. Cadastre-se em 1 minuto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => getPrices().catch(() => [] as Quote[]),
  component: Index,
});

/** Scroll to the signup form without putting "#cadastro" in the address bar. */
function scrollToForm() {
  const form = document.getElementById("cadastro");
  form?.scrollIntoView({ behavior: "smooth", block: "start" });
  form?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
}

function Index() {
  const initial = Route.useLoaderData();
  const [quotes, setQuotes] = useState<Quote[]>(initial ?? []);
  useEffect(() => {
    const id = setInterval(
      () =>
        getPrices()
          .then((q) => Array.isArray(q) && q.length && setQuotes(q))
          .catch(() => {}),
      60_000,
    );
    return () => clearInterval(id);
  }, []);
  const gold = (quotes ?? []).find((q) => q.symbol === "GC=F");
  const ticker = (quotes ?? []).map((q) => [
    q.label,
    fmt(q.price, q.symbol === "NG=F" ? 3 : 2),
    `${q.changePct >= 0 ? "+" : ""}${fmt(q.changePct)}%`,
  ]);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-deep-foreground/10 bg-deep/95 text-deep-foreground backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-gradient text-accent-foreground">
              <Coins className="h-5 w-5" />
            </span>
            Commodities <span className="text-gold">Brasil</span>
          </div>
          <button
            type="button"
            onClick={scrollToForm}
            className="rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-bold text-accent-foreground shadow-gold"
          >
            Cadastre-se
          </button>
        </div>
        <div className="overflow-hidden border-t border-deep-foreground/10 py-2 text-xs">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
            {[...ticker, ...ticker].map(([n, p, c], i) => (
              <span key={i} className="flex gap-2">
                <b className="text-deep-foreground/70">{n}</b> {p}{" "}
                <span className={c?.startsWith("+") ? "text-success" : "text-destructive"}>
                  {c}
                </span>
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-deep-gradient text-deep-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              Invista em <span className="text-gold-gradient">Ouro</span> e{" "}
              <span className="text-gold-gradient">Petróleo</span> a partir de US$250
            </h1>
            <p className="mt-5 max-w-xl text-lg text-deep-foreground/80">
              Diversifique seu patrimônio com os ativos que o mundo inteiro procura em tempos de
              incerteza. Com um especialista ao seu lado, em português.
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-4">
              {[
                ["US$250", "Depósito mínimo"],
                ["PIX", "Depósito rápido"],
                ["24/5", "Suporte em PT"],
              ].map(([a, b]) => (
                <div
                  key={a}
                  className="rounded-xl border border-deep-foreground/15 bg-deep-foreground/5 p-4"
                >
                  <div className="font-display text-2xl font-bold text-gold">{a}</div>
                  <div className="text-xs text-deep-foreground/70">{b}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 hidden overflow-hidden rounded-2xl border border-gold/30 lg:block">
              <HeroPhoto
                gold={gold}
                label="Investidor brasileiro acompanhando o preço do ouro no celular"
                viewBox="0 60 1024 720"
                className="block aspect-[1024/720] w-full"
              />
            </div>
          </div>
          <LeadForm id="cadastro" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">Por que ouro e petróleo?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Ativos reais, negociados no mundo todo, que historicamente ganham destaque quando o real
          perde força.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            [
              Coins,
              "Proteção do patrimônio",
              "O ouro é procurado há séculos como reserva de valor contra inflação e desvalorização da moeda.",
            ],
            [
              Droplet,
              "Demanda global",
              "O petróleo move a economia mundial — notícias e movimentos de preço criam oportunidades todos os dias.",
            ],
            [
              TrendingUp,
              "Opere na alta e na baixa",
              "Você pode buscar oportunidades tanto quando o preço sobe quanto quando cai.",
            ],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Coins;
            return (
              <div
                key={t as string}
                className="rounded-2xl border border-border bg-card p-7 shadow-card"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold-gradient text-accent-foreground">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-bold">{t as string}</h3>
                <p className="mt-2 text-muted-foreground">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-secondary py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">Comece em 3 passos simples</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              [
                UserCheck,
                "Cadastre-se",
                "Leva menos de 1 minuto. Apenas nome, e-mail, WhatsApp e 3 perguntas.",
              ],
              [
                PhoneCall,
                "Fale com um especialista",
                "Um consultor em português liga para entender seu perfil e tirar suas dúvidas.",
              ],
              [
                Wallet,
                "Comece com US$250",
                "Deposite via PIX e faça suas primeiras operações com acompanhamento.",
              ],
            ].map(([I, t, d], i) => {
              const Icon = I as typeof Coins;
              return (
                <div key={i} className="relative text-center">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-deep text-gold shadow-card">
                    <Icon className="h-8 w-8" />
                  </div>
                  <span className="absolute left-1/2 top-0 ml-6 grid h-8 w-8 place-items-center rounded-full bg-gold-gradient text-sm font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-bold">{t as string}</h3>
                  <p className="mt-2 text-muted-foreground">{d as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
        <HeroPhoto
          gold={gold}
          label="Investidor com barras de ouro"
          className="block h-[520px] w-full overflow-hidden rounded-3xl shadow-card"
        />
        <div>
          <h2 className="text-3xl font-bold sm:text-4xl">
            Feito para quem já tem experiência de vida — não necessariamente de mercado
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              [Headphones, "Gerente de conta pessoal", "Uma pessoa que conhece você pelo nome."],
              [BookOpen, "Material educativo", "Aulas e guias em português, do zero."],
              [Smartphone, "App simples", "Acompanhe ouro e petróleo pelo celular."],
              [BarChart3, "Análises diárias", "Resumos do mercado direto no WhatsApp."],
            ].map(([I, t, d]) => {
              const Icon = I as typeof Coins;
              return (
                <div key={t as string} className="flex gap-4">
                  <Icon className="h-7 w-7 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-bold">{t as string}</h3>
                    <p className="text-sm text-muted-foreground">{d as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={scrollToForm}
            className="mt-10 inline-block rounded-lg bg-gold-gradient px-8 py-4 text-lg font-bold text-accent-foreground shadow-gold"
          >
            Quero meu especialista
          </button>
        </div>
      </section>

      <section className="bg-deep-gradient py-20 text-deep-foreground">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">
            O que dizem nossos clientes
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              [
                "Carlos M., 47",
                "São Paulo, SP",
                "Sempre quis investir em ouro mas achava complicado. O especialista explicou tudo com paciência.",
              ],
              [
                "Ana Paula R., 39",
                "Belo Horizonte, MG",
                "Comecei com o mínimo para conhecer. O atendimento em português fez toda a diferença.",
              ],
              [
                "Roberto S., 55",
                "Curitiba, PR",
                "Queria diversificar além da poupança. Hoje acompanho o petróleo pelo app todo dia.",
              ],
            ].map(([n, c, q]) => (
              <figure
                key={n}
                className="rounded-2xl border border-deep-foreground/15 bg-deep-foreground/5 p-7"
              >
                <div className="flex gap-1 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 text-deep-foreground/90">“{q}”</blockquote>
                <figcaption className="mt-5 text-sm">
                  <b>{n}</b> · <span className="text-deep-foreground/60">{c}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-deep-foreground/50">
            Depoimentos ilustrativos. Resultados passados não garantem resultados futuros.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">Perguntas frequentes</h2>
        <Accordion type="single" collapsible className="mt-10">
          {[
            [
              "Qual o depósito mínimo?",
              "Você pode começar com US$250 (aproximadamente R$1.300), depositando via PIX, cartão ou transferência.",
            ],
            [
              "Preciso ter experiência?",
              "Não. Seu especialista e nosso material educativo ajudam você desde o primeiro passo.",
            ],
            [
              "Existe risco?",
              "Sim. Operar commodities envolve risco de perda do capital investido. Invista apenas o que você pode perder e conte com orientação.",
            ],
            [
              "Como faço para sacar?",
              "Os saques podem ser solicitados pela plataforma e enviados para sua conta bancária no Brasil.",
            ],
            [
              "Qual o horário de atendimento?",
              "Atendimento em português de segunda a sexta, 24 horas, durante o funcionamento do mercado.",
            ],
          ].map(([q, a]) => (
            <AccordionItem key={q} value={q ?? ""}>
              <AccordionTrigger className="text-left text-lg font-semibold">{q}</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="bg-secondary py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold sm:text-5xl">
              Seu patrimônio merece mais do que a <span className="text-primary">poupança</span>.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Cadastre-se agora e receba o contato de um especialista em ouro e petróleo.
            </p>
          </div>
          <LeadForm />
        </div>
      </section>

      <footer className="bg-deep py-10 text-sm text-deep-foreground/60">
        <div className="mx-auto max-w-7xl space-y-4 px-5">
          <p>
            <b className="text-deep-foreground/80">Aviso de risco:</b> Operar commodities e CFDs
            envolve alto risco e pode resultar na perda de todo o capital investido. Não é adequado
            para todos os investidores. Nenhum resultado é garantido. Este site é destinado apenas a
            maiores de 30 anos residentes no Brasil.
          </p>
          <p>
            © {new Date().getFullYear()} Commodities Brasil · Política de Privacidade · Termos de
            Uso
          </p>
        </div>
      </footer>
    </div>
  );
}
