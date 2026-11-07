import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so logic tests don't boot the Cloudflare runtime.
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
