/**
 * Which serialization is running, for `widget.on('beforeSerialize')`.
 *
 * `LGraphNode.serialize` is called for two different destinations and cannot
 * tell them apart on its own: the file a user saves, and the copy of the
 * workflow embedded in a queued prompt as `extra_pnginfo`, which is what gets
 * written into the output image. `graphToPrompt` builds the second with the
 * very same call the first uses.
 *
 * They need different answers. rgthree's Seed keeps its `-1` sentinel in the
 * saved file but writes the rolled seed into the embedded copy, so that
 * dragging the output PNG back in reproduces the run. Reporting both as
 * `'workflow'` forced a pack to choose between a corrupted save and an
 * irreproducible image.
 *
 * A flag rather than a parameter because the signal has to cross
 * `graph.serialize()` -> each node -> each widget, and threading a context
 * argument through litegraph's serializer would change a signature that 40+
 * packs override.
 */
let embedding = false

/** Marks `fn` as building the workflow copy that travels with a prompt. */
export function whileEmbeddingWorkflow<T>(fn: () => T): T {
  const previous = embedding
  embedding = true
  try {
    return fn()
  } finally {
    embedding = previous
  }
}

export const isEmbeddingWorkflow = () => embedding
