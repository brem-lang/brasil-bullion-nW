import hero from "@/assets/hero-trader.jpg";
import { fmt, type Quote } from "@/lib/prices.functions";

/** Hero photo with the live gold price drawn on the phone screen (SVG keeps text aligned under object-cover-like cropping). */
export function HeroPhoto({ gold, className, label, viewBox = "0 0 1024 1280" }: { gold?: Quote | undefined; className?: string; label: string; viewBox?: string }) {
  const up = (gold?.change ?? 0) >= 0;
  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={label}>
      <image href={hero} width="1024" height="1280" />
      {gold && (
        <g fontFamily="Manrope, sans-serif">
          <text x="150" y="526" fontSize="18" fontWeight="700" className="fill-deep-foreground">
            ${gold.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </text>
          <text x="152" y="541" fontSize="9" className={up ? "fill-success" : "fill-destructive"}>
            {up ? "▲" : "▼"} {fmt(Math.abs(gold.change))} ({up ? "+" : "-"}{fmt(Math.abs(gold.changePct))}%)
          </text>
        </g>
      )}
    </svg>
  );
}
