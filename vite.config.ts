import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Server-only settings for `vite dev` (production: systemd loads .env). Not VITE_*, so they
// never reach the browser bundle. Same approach as arabic-trading-spark.
const SERVER_ENV = [
  "BASE_ENDPOINT",
  "BASE_API_KEY",
  "LEAD_FUNNEL",
  "LEAD_AUTOLOGIN_HOSTS",
  "DEV_IP_ADDRESS",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_HOSTNAMES",
];

export default defineConfig(({ command, mode }) => {
  if (command === "serve") {
    const env = loadEnv(mode, process.cwd(), "");
    for (const key of SERVER_ENV) if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [
      tsConfigPaths(),
      tailwindcss(),
      tanstackStart({
        // Use src/server.ts (our SSR error wrapper) as the server entry.
        server: { entry: "server" },
      }),
      ...(command === "build" ? [nitro()] : []),
      viteReact(),
    ],
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    },
  };
});
