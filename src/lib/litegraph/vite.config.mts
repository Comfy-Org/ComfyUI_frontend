/// <reference types='vitest' />
import path from "node:path"

import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, "src/litegraph"),
      name: "litegraph.js",
      fileName: format => `litegraph.${format}.js`,
      formats: ["es", "umd"],
    },
    sourcemap: true,
    target: ["es2022"],
  },
  esbuild: {
    minifyIdentifiers: false,
    minifySyntax: false,
  },
  plugins: [
    dts({
      entryRoot: "src",
      insertTypesEntry: true,
      include: ["src/**/*.ts"],
      outDir: "dist",
      aliasesExclude: ["@"],
    }),
  ],
  resolve: {
    alias: { "@": "/src" },
  },
  test: {
    alias: { "@/": path.resolve(import.meta.dirname, "./src/") },
    environment: "jsdom",
    restoreMocks: true,
    unstubGlobals: true,
  },
})
