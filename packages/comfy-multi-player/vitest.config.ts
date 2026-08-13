import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // purity: this package is never tested under a DOM
    include: ["test/**/*.test.ts"],
  },
});
