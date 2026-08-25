import type { Page } from '@playwright/test'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'

export class BAD_DO_NOT_DO_THIS_LegacyApiHelper {
  constructor(private readonly page: Page) {}

  disconnectInputByAssigningNull(nodeType: string, inputIndex: number) {
    return this.page.evaluate(
      ([nodeType, inputIndex]) => {
        const graph = window.app!.graph
        const node = graph.nodes.find((node) => node.type === nodeType)
        if (!node) throw new Error(`${nodeType} not found`)

        const link = node.inputs[inputIndex].link
        node.inputs[inputIndex].link = null
        return link != null && !graph.links.has(link)
      },
      [nodeType, inputIndex] as const
    )
  }

  spliceOutputLinks(nodeType: string, outputIndex: number) {
    return this.page.evaluate(
      ([nodeType, outputIndex]) => {
        const graph = window.app!.graph
        const node = graph.nodes.find((node) => node.type === nodeType)
        if (!node) throw new Error(`${nodeType} not found`)

        const links = node.outputs[outputIndex].links!
        const removedLink = links[0]
        const retainedLink = links[1]
        links.splice(0, 1)

        return {
          removed: removedLink != null && !graph.links.has(removedLink),
          retained: retainedLink != null && graph.links.has(retainedLink),
          viewSynchronized: links.length === 1 && links[0] === retainedLink
        }
      },
      [nodeType, outputIndex] as const
    )
  }

  replaceOutputLinksWithEmptyArray(nodeType: string, outputIndex: number) {
    return this.page.evaluate(
      ([nodeType, outputIndex]) => {
        const graph = window.app!.graph
        const node = graph.nodes.find((node) => node.type === nodeType)
        if (!node) throw new Error(`${nodeType} not found`)

        const link = node.outputs[outputIndex].links![0]
        node.outputs[outputIndex].links = []
        return link != null && !graph.links.has(link)
      },
      [nodeType, outputIndex] as const
    )
  }

  addWidgetsForLegacyArrayReordering() {
    return this.page.evaluate(() => {
      const node = window.app!.graph.nodes.find(
        (node) => (node.widgets?.length ?? 0) === 1
      )
      if (!node) throw new Error('Node with one widget not found')

      node.addWidget('text', 'saola-workflow', '', () => {})
      node.addWidget('text', 'okapi-resolution', '', () => {})

      const element = document.createElement('div')
      element.textContent = 'numbat-stage'
      node.addDOMWidget('numbat-stage', 'numbat-stage', element, {
        serialize: false
      })

      node.addWidget('button', 'quoll-upload', undefined, () => {})
      node.addWidget('button', 'olm-link', undefined, () => {})
      return node.id
    })
  }

  reorderWidgetsWithSplice(
    nodeId: NodeId,
    moves: readonly (readonly [widgetName: string, afterWidgetName: string])[]
  ) {
    return this.page.evaluate(
      ([nodeId, moves]) => {
        const node = window.app!.graph.getNodeById(nodeId)
        if (!node) throw new Error(`Node ${nodeId} not found`)

        const widgets = node.widgets!
        for (const [widgetName, afterWidgetName] of moves) {
          const widget = widgets.find((widget) => widget.name === widgetName)!
          const afterWidget = widgets.find(
            (widget) => widget.name === afterWidgetName
          )!
          widgets.splice(widgets.indexOf(widget), 1)
          widgets.splice(widgets.indexOf(afterWidget) + 1, 0, widget)
        }
      },
      [nodeId, moves] as const
    )
  }

  removeLastWidgetWithPop(nodeId: NodeId) {
    return this.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.widgets!.pop()
    }, nodeId)
  }

  removeLastWidgetByDecrementingLength(nodeId: NodeId) {
    return this.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.widgets!.length--
    }, nodeId)
  }

  removeFirstWidgetWithSplice(nodeId: NodeId) {
    return this.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.widgets!.splice(0, 1)
    }, nodeId)
  }

  assignInputType(nodeId: NodeId, inputIndex: number, type: string) {
    return this.page.evaluate(
      ([nodeId, inputIndex, type]) => {
        const node = window.app!.graph.getNodeById(nodeId)
        if (!node) throw new Error(`Node ${nodeId} not found`)
        node.inputs[inputIndex].type = type
      },
      [nodeId, inputIndex, type] as const
    )
  }

  moveFirstNodeByMutatingPositionX(nodeId: NodeId, offset: number) {
    return this.page.evaluate(
      ([nodeId, offset]) => {
        const node = window.app!.graph.getNodeById(nodeId)
        if (!node) throw new Error('Graph has no nodes')
        node.pos[0] += offset
        window.app!.graph.setDirtyCanvas(true, true)
      },
      [nodeId, offset] as const
    )
  }

  setImageCropWidgetValue(
    nodeId: NodeId,
    bounds: { x: number; y: number; width: number; height: number }
  ) {
    return this.page.evaluate(
      ({ nodeId, bounds }) => {
        const node = window.app!.graph.getNodeById(nodeId)
        const widget = node?.widgets?.find(
          (widget) => widget.type === 'imagecrop'
        )
        if (!widget) throw new Error(`Image crop widget not found: ${nodeId}`)

        widget.value = bounds
        widget.callback?.(bounds)
      },
      { nodeId, bounds }
    )
  }

  growNodeByMutatingSizeAfterAddingWidget(nodeId: NodeId) {
    return this.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)

      node.addWidget(
        'text',
        `runtime_widget_${node.widgets?.length ?? 0}`,
        '',
        () => {}
      )
      node.size[1] += 80
      node.setDirtyCanvas(true, true)
    }, nodeId)
  }

  growNodeByMutatingSizeAfterLoadingPreview(nodeId: NodeId) {
    return this.page.evaluate(
      ([nodeId, imageSource]) =>
        new Promise<void>((resolve, reject) => {
          const node = window.app!.graph.getNodeById(nodeId) as
            | (LGraphNode & { imgs?: HTMLImageElement[] })
            | null
          if (!node) throw new Error(`Node ${nodeId} not found`)

          const image = new Image()
          image.onload = () => {
            node.imgs = [image]
            node.size[1] += 120
            node.setDirtyCanvas(true, true)
            resolve()
          }
          image.onerror = () =>
            reject(new Error('Preview image failed to load'))
          image.src = imageSource
        }),
      [
        nodeId,
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      ] as const
    )
  }
}
