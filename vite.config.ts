import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare()],
  server: { port: 5173, strictPort: true, host: true },
  build: { chunkSizeWarningLimit: 2000 },
});
