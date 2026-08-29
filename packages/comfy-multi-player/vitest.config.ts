import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // purity: this package is never tested under a DOM
    testTimeout: 15000,
    include: ["test/**/*.test.ts"],
  },
});
