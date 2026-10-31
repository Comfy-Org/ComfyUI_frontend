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

export const AUTOGROW_GROUP_WIDGET_TYPE = 'autogrow_group'

/** Gives a socket-only input a label widget so it can take a widget row. */
export function addShimWidget(
  node: LGraphNode,
  input: INodeInputSlot,
  {
    advanced,
    autogrowGroup
  }: Pick<NonNullable<InputSpec[1]>, 'advanced'> & {
    autogrowGroup?: boolean
  } = {}
) {
  node.addCustomWidget(
    new ShimWidget(
      {
        name: input.name,
        label: input.label ?? input.localized_name,
        hidden: autogrowGroup,
        options: autogrowGroup
          ? { serialize: false }
          : { advanced, hideInPanel: advanced },
        serialize: false,
        type: autogrowGroup ? AUTOGROW_GROUP_WIDGET_TYPE : 'shim',
        value: undefined,
        y: 0
      },
      node
    )
  )
  if (!autogrowGroup) input.alwaysVisible = true
  input.widget = { name: input.name }
}
