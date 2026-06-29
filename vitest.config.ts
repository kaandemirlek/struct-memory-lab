import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// "@/..." import'larının testlerde de src/ klasörüne çözülmesi için.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
