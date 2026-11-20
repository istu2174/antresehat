import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    // .env.local hanya dipakai test integrasi (tests/integration); di CI tidak ada → di-skip.
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 60_000,
  },
}));
