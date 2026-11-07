import { defineConfig, exports } from "cf/config";
import * as entrypoint from "./worker/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "overlap",
    entrypoint,
    compatibilityDate: "2026-11-04",
    observability: { enabled: true },
    // Only room sockets reach the Worker; everything else is the Vite build. No SPA fallback.
    assets: { runWorkerFirst: ["/room/*"] },
    exports: {
      Room: exports.durableObject({ storage: "sqlite" }),
    },
  },
});
