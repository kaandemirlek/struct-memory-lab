import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest needs to understand the "@/..." path alias used across the app.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
