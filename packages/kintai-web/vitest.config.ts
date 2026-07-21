import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // TS の "@/*" パスエイリアスを vitest でも解決する。
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" はランタイム値を持たないためテストでは no-op スタブへ。
      "server-only": fileURLToPath(
        new URL("./src/server/__stubs__/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
