/// <reference types='vitest' />
import { defineConfig } from "vite"
import path from "path"
import dts from "vite-plugin-dts"

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/litegraph"),
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
    alias: { "@/": path.resolve(__dirname, "./src/") },
    environment: "jsdom",
  },
})
