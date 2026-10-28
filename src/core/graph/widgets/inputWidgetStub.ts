import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDefSchema'

/** Gives a socket-only input a label widget so it can take a widget row. */
export function addShimWidget(
  node: LGraphNode,
  input: INodeInputSlot,
  { advanced }: Pick<NonNullable<InputSpec[1]>, 'advanced'> = {}
) {
  node.widgets ??= []
  node.widgets.push({
    draw(ctx, _n, _w, y) {
      ctx.save()
      ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR
      ctx.fillText(input.label ?? input.name, 20, y + 15)
      ctx.restore()
    },
    name: input.name,
    options: { advanced, hideInPanel: advanced },
    serialize: false,
    type: 'shim',
    y: 0
  })
  input.alwaysVisible = true
  input.widget = { name: input.name }
}
