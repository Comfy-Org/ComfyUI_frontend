import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export const SURVEY_WIDGET = 'survey "quoted" widget'

export async function installSurveyProbeWidget(
  comfyPage: ComfyPage,
  { name = SURVEY_WIDGET, height = 40, throwOnClick = false } = {}
) {
  await comfyPage.page.evaluate(
    ({ name, height, throwOnClick }) => {
      const prototype =
        window.LiteGraph!.registered_node_types['Note'].prototype
      const created = prototype.onNodeCreated
      prototype.onNodeCreated = function () {
        created?.call(this)
        this.addCustomWidget({
          name,
          type: 'custom',
          value: 0,
          y: 0,
          options: {},
          computeSize: () => [220, height],
          draw(context, _node, width, y) {
            context.fillStyle = '#48ff84'
            context.fillRect(0, y, width, height)
          },
          mouse(event) {
            if (event.type !== 'pointerdown') return false
            this.value += 1
            if (throwOnClick)
              queueMicrotask(() => {
                throw new Error('Survey probe click error')
              })
            return true
          }
        })
        this.setSize(this.computeSize())
      }
    },
    { name, height, throwOnClick }
  )
}

export async function failSurveyWidgetRedraw(comfyPage: ComfyPage, id: NodeId) {
  await comfyPage.page.evaluate(
    ({ id, name }) => {
      const widget = window
        .app!.graph.getNodeById(id)
        ?.widgets?.find((widget) => widget.name === name)
      if (!widget) throw new Error('Survey widget is missing')
      widget.triggerDraw = () => {
        throw new Error('Survey redraw failure')
      }
    },
    { id, name: SURVEY_WIDGET }
  )
}
