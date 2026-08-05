/**
 * Runs one pack image and prints its observations as JSON.
 *
 * A separate process per image is not optional: litegraph's type registry and
 * the ES module cache are both global, so a second load in the same process
 * would see the first image's registrations and report success it did not earn.
 *
 *   tsx runImage.mjs <spec.json>
 */
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

// Before every other import: the hook has to be in place prior to anything
// pulling in litegraph, which reaches i18n at module scope.
register('./loader.mjs', import.meta.url)

// The DOM has to exist before anything else is imported: litegraph reaches
// DOMPurify at module scope, and DOMPurify degrades to a no-op export when it
// loads without a window.
const { Window } = await import('happy-dom')
const window = new Window({ url: 'http://localhost/' })
for (const key of Object.getOwnPropertyNames(window)) {
  if (globalThis[key] === undefined) {
    try {
      globalThis[key] = window[key]
    } catch {
      // Some accessors throw off-document; none of them matter here.
    }
  }
}
globalThis.window ??= window
globalThis.document ??= window.document
globalThis.requestAnimationFrame ??= (fn) => setTimeout(() => fn(0), 0)
globalThis.cancelAnimationFrame ??= clearTimeout

// Entity state lives in Pinia stores, so the graph cannot register a node
// without an active instance.
const { createPinia, setActivePinia } = await import('pinia')
setActivePinia(createPinia())

const { runPack } = await import('./runPack.mjs')
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'))

try {
  process.stdout.write(JSON.stringify(await runPack(spec)))
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      loaded: false,
      loadErrors: [`harness: ${error?.stack ?? error}`],
      driveErrors: [],
      registered: [],
      constructed: {},
      wire: {}
    })
  )
}
