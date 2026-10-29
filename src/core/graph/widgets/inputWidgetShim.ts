import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import type { DrawWidgetOptions } from '@/lib/litegraph/src/widgets/BaseWidget'
import type { InputSpec } from '@/schemas/nodeDefSchema'

class ShimWidget extends BaseWidget {
  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    if (options.showText) this.drawSuppressedRowLabel(ctx, options)
  }

  onClick(): void {}
}

/** Gives a socket-only input a label widget so it can take a widget row. */
export function addShimWidget(
  node: LGraphNode,
  input: INodeInputSlot,
  { advanced }: Pick<NonNullable<InputSpec[1]>, 'advanced'> = {}
) {
  node.addCustomWidget(
    new ShimWidget(
      {
        name: input.name,
        label: input.label ?? input.localized_name,
        options: { advanced, hideInPanel: advanced },
        serialize: false,
        type: 'shim',
        value: undefined,
        y: 0
      },
      node
    )
  )
  input.alwaysVisible = true
  input.widget = { name: input.name }
}
