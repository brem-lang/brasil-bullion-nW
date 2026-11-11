import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | undefined;

/** Loads Cloudflare's script once, only when the widget is first shown. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing"));
    s.onerror = () => {
      scriptPromise = undefined; // allow a retry on the next mount
      s.remove();
      reject(new Error("turnstile script failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export type TurnstileHandle = {
  /** Get a fresh token: each token works once, so call this after every failed submit. */
  reset(): void;
};

type Props = {
  siteKey: string;
  action: string;
  /** Called with the token, or "" when it expires, errors or is reset. */
  onToken(token: string): void;
  /** The script could not load (e.g. blocked) or the widget errored. */
  onError(): void;
};

export const Turnstile = forwardRef<TurnstileHandle, Props>(function Turnstile(
  { siteKey, action, onToken, onError },
  ref,
) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  // Latest callbacks without re-rendering the widget when the parent re-renders.
  const cb = useRef({ onToken, onError });
  cb.current = { onToken, onError };

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        cb.current.onToken("");
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current) return;
        widgetId.current = ts.render(box.current, {
          sitekey: siteKey,
          action,
          language: "pt-br",
          size: "flexible",
          callback: (token: string) => cb.current.onToken(token),
          "expired-callback": () => cb.current.onToken(""),
          "error-callback": () => {
            cb.current.onToken("");
            cb.current.onError();
          },
        });
      })
      .catch(() => {
        if (!cancelled) cb.current.onError();
      });
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [siteKey, action]);

  return <div ref={box} className="min-h-[65px]" />;
});
