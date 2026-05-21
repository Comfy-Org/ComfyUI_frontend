/**
 * @comfyorg/extension-api — Public Extension API for ComfyUI
 *
 * This is the package entry point compiled to `build/index.js` + `build/index.d.ts`.
 * It is a single re-export of the canonical surface defined in
 * `src/extension-api/index.ts` in the main app — that file is the one source
 * of truth for what is part of the stable, semver-versioned public contract.
 *
 * Do NOT add exports here. Add them to `src/extension-api/index.ts` and they
 * will flow through this barrel automatically.
 *
 * The tsconfig.json `paths` alias `@/*` → `../../src/*` resolves the import
 * below at both typecheck and build time.
 *
 * @packageDocumentation
 */
export * from '@/extension-api/index'
