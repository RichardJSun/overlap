import { cloudflare } from "@cloudflare/vite-plugin";
import process from "node:process";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare()],
  // PORT lets a worktree run its own `cf dev` next to the main checkout's.
  server: { port: Number(process.env.PORT) || 5173, strictPort: true, host: true },
  build: { chunkSizeWarningLimit: 2000 },
});
