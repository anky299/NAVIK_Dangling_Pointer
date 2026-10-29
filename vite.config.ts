// TanStack Start & Nitro build configuration
// Bundled plugins already include: TanStack devtools, tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, nitro (build-only), VITE_* env injection, and @ path alias.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
