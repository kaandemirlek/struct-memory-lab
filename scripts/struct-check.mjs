// struct-check launcher — runs the TypeScript CLI through jiti so the shared
// deterministic engine (parser, diff, compatibility) can be reused directly
// with no build step and no `@/` alias headaches.
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";

const jiti = createJiti(fileURLToPath(import.meta.url), {
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
});

const mod = await jiti.import("../src/cli/structCheck.ts");
mod.main(process.argv.slice(2));
