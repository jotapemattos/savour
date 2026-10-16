import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [viteReact()],
  test: {
    hookTimeout: 60_000,
    projects: [
      {
        extends: true,
        test: {
          environment: "happy-dom",
          environmentOptions: {
            happyDOM: {
              height: 812,
              url: "http://localhost:3000/",
              width: 375,
            },
          },
          include: ["test/**/*.test.tsx"],
          name: "dom",
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          include: ["test/**/*.test.ts"],
          name: "worker",
        },
      },
    ],
    testTimeout: 60_000,
  },
});
