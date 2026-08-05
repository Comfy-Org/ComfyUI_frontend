/**
 * Deriving what to drive a pack with, from the pack's own source.
 *
 * Separate from `runPack` because these are pure string helpers with no
 * litegraph dependency: the verifier calls them in the parent process, which
 * has no DOM, and importing `runPack` there would fail at module scope.
 */

/**
 * Node type names the pack cares about.
 *
 * Both images are driven over the same set, so a difference in the result is
 * attributable to the conversion. Derived from source rather than from the
 * backend because the definitions are Python-side and not available here.
 */
export function candidateTypes(sources) {
  const found = new Set()
  const patterns = [
    // `nodeData.name === "X"`. The receiver is required: a bare `.name ===`
    // also matches `widgets.find((w) => w.name === 'displaytext')`, which puts
    // a widget name into the type list and drives a node that never existed.
    /\b(?:nodeData|nodeDef|def|data|nodeType|comfyClass)\??\.(?:name|comfyClass)\s*===?\s*["'`]([^"'`]+)["'`]/g,
    /["'`]([^"'`]+)["'`]\s*===?\s*\b(?:nodeData|nodeDef|def|data|nodeType)\??\.(?:name|comfyClass)\b/g,
    // `case "X":` — the usual switch on the type name
    /case\s+["'`]([^"'`]+)["'`]\s*:/g,
    // `comfy.defs.extend("X"` and its array form
    /defs\.extend\(\s*["'`]([^"'`]+)["'`]/g,
    /defs\.extend\(\s*\[([^\]]+)\]/g,
    // `["A","B"].includes(nodeData.name)`
    /\[([^\]]+)\]\s*\.includes\(\s*\w+\.name/g
  ]
  for (const source of sources) {
    for (const pattern of patterns) {
      for (const [, captured] of source.matchAll(pattern)) {
        for (const piece of captured.split(',')) {
          const name = piece.trim().replace(/^["'`]|["'`]$/g, '')
          // Type names are not empty, not sentences, not paths.
          if (name && name.length < 80 && !/[\s/\\]{2,}/.test(name)) {
            found.add(name)
          }
        }
      }
    }
  }
  return [...found].sort()
}

/**
 * The category the pack expects its nodes to be in.
 *
 * Packs guard their hook on the category before doing anything
 * (`nodeData.category.startsWith('essentials')`). Driving them with a category
 * they do not recognise makes every hook return early, so both images come out
 * equally empty and the comparison reports a false green.
 */
export function candidateCategory(sources) {
  const patterns = [
    /category\??\.startsWith\(\s*["'`]([^"'`]+)["'`]/g,
    /category\s*===?\s*["'`]([^"'`]+)["'`]/g,
    /category\??\.includes\(\s*["'`]([^"'`]+)["'`]/g
  ]
  for (const source of sources) {
    for (const pattern of patterns) {
      for (const [, category] of source.matchAll(pattern)) {
        if (category) return category
      }
    }
  }
  return 'harness'
}
