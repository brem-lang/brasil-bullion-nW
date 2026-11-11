import { useEffect, useState } from "react";
import { Coins } from "lucide-react";

/** How long the loader shows before the next page opens. */
export const ROUTE_LOADER_MS = 2000;

/** Full-screen loader shown between the pre-landing page and the signup page. */
export function RouteLoader({ message = "Preparando seu cadastro…" }: { message?: string }) {
  // Start the bar at 0 and fill it on the next frame so the CSS transition runs.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-deep/95 px-6 text-deep-foreground backdrop-blur-sm"
    >
      <div className="relative grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-gold/20 border-t-gold motion-reduce:animate-none" />
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold-gradient text-accent-foreground">
          <Coins className="h-6 w-6" />
        </span>
      </div>
      <p className="text-center font-display text-lg font-bold sm:text-xl">{message}</p>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-deep-foreground/15">
        <div
          className="h-full bg-gold-gradient ease-out"
          style={{
            width: filled ? "100%" : "0%",
            transition: `width ${ROUTE_LOADER_MS}ms`,
          }}
        />
      </div>
    </div>
  );
}
