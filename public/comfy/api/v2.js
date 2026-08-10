/**
 * The published node API, as a converted pack imports it:
 *
 *   import { comfy } from '/comfy/api/v2.js'
 *
 * Served from `public/`, so it exists at this path in dev and in `dist/`
 * alike. It re-exports the instance rather than constructing one: there must be
 * exactly one `comfy` per page, and a second module graph would hand packs a
 * second registry that the app never reads.
 *
 * `installComfyApi` assigns `window.comfy` (the same object as
 * `globalThis.comfy` in a browser) immediately before
 * `loadExtensions()`, so the value is present by the time any pack evaluates.
 *
 * Without this file every converted pack fails at its first import. The
 * conversion harness resolves the specifier through its own loader hook, which
 * is why verification passed for weeks while nothing could actually load in the
 * app.
 */
if (!globalThis.comfy) {
  throw new Error(
    '[comfy] /comfy/api/v2.js was imported before the host installed the API. ' +
      'A pack must not be loaded before ComfyUI has started.'
  )
}

export const comfy = globalThis.comfy
