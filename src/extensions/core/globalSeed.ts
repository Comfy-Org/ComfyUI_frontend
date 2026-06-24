import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'

app.registerExtension({
  name: 'Comfy.SimpleSeedNode',
  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) {
    if (nodeData.name !== 'SimpleSeedNode') return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, [])

      this.addWidget(
        'button',
        '🎲 Randomize Seed',
        '',
        () => {
          const seedWidget = this.widgets?.find((w) => w.name === 'seed')
          
          if (seedWidget) {
            // 1125899906842624 is 2^50. This matches the max safe integer 
            // used by ComfyUI's built-in control_after_generate randomizer.
            const randomSeed = Math.floor(Math.random() * 1125899906842624)
            seedWidget.value = randomSeed

            if (typeof seedWidget.callback === 'function') {
              seedWidget.callback(randomSeed)
            }

            // force visual update on the canvas
            this.setDirtyCanvas(true, true)
          } else {
            console.warn("[SimpleSeedNode] Could not find the 'seed' widget to randomize.")
          }
        },
        { serialize: false }
      )

      // Force LiteGraph to recalculate the node's height to fit the new button
      if (this.computeSize) {
        const newSize = this.computeSize()
        // Only expand the node, don't shrink it if the user manually resized it
        if (this.size[0] < newSize[0]) this.size[0] = newSize[0]
        if (this.size[1] < newSize[1]) this.size[1] = newSize[1]
      }
    }
  }
})
