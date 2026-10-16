import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const alchemyInjectsCloudflare =
  process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1";

export default defineConfig({
  plugins: [
    alchemyInjectsCloudflare
      ? null
      : cloudflare({
          config: {
            compatibility_date: "2026-05-28",
            compatibility_flags: ["nodejs_compat"],
            main: "./src/server.ts",
            name: "savour-web",
            services: [{ binding: "API", service: "savour-api" }],
          },
          viteEnvironment: { name: "ssr" },
        }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
