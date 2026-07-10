import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// "@/..." import'larının testlerde de src/ klasörüne çözülmesi için.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Motor testleri düz "node" ortamında koşar; React bileşen testleri (.test.tsx)
    // kendi dosya başındaki `// @vitest-environment jsdom` docblock'u ile DOM alır.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
