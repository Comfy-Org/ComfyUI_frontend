import { describe, expect, it } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'

type TestNode = {
  widgets?: IBaseWidget[]
  isSubgraphNode: () => boolean
  subgraph?: {
    getNodeById: (nodeId: string) => TestNode | null | undefined
  }
}

type TestPromotedWidget = IBaseWidget & {
  sourceNodeId: string
  sourceWidgetName: string
}

function createWidget(name: string): IBaseWidget {
  return {
    name,
    type: 'text',
    y: 0,
    options: {}
  }
}

function createPromotedWidget(
  name: string,
  sourceNodeId: string,
  sourceWidgetName: string
): TestPromotedWidget {
  return {
    ...createWidget(name),
    sourceNodeId,
    sourceWidgetName
  }
}

function createHostNode(
  widgets: IBaseWidget[],
  options: {
    isSubgraphNode?: boolean
    innerNodesById?: Record<string, TestNode>
  } = {}
): TestNode {
  const { isSubgraphNode = false, innerNodesById = {} } = options
  return {
    widgets,
    isSubgraphNode: () => isSubgraphNode,
    subgraph: {
      getNodeById: (nodeId: string) => innerNodesById[nodeId]
    }
  }
}

describe('resolveWidgetFromHostNode', () => {
  it('returns host node widget for non-promoted widgets', () => {
    const widget = createWidget('text_widget')
    const hostNode = createHostNode([widget])

    const resolved = resolveWidgetFromHostNode(hostNode, widget.name)

    expect(resolved).toEqual({ node: hostNode, widget })
  })

  it('resolves promoted widget to the interior node widget', () => {
    const innerWidget = createWidget('inner_text')
    const innerNode = createHostNode([innerWidget])
    const promotedWidget = createPromotedWidget(
      'promoted_text',
      '42',
      'inner_text'
    )
    const hostNode = createHostNode([promotedWidget], {
      isSubgraphNode: true,
      innerNodesById: { '42': innerNode }
    })

    const resolved = resolveWidgetFromHostNode(hostNode, promotedWidget.name)

    expect(resolved).toEqual({ node: innerNode, widget: innerWidget })
  })

  it('returns undefined when promoted interior node is missing', () => {
    const promotedWidget = createPromotedWidget(
      'promoted_text',
      '42',
      'inner_text'
    )
    const hostNode = createHostNode([promotedWidget], {
      isSubgraphNode: true
    })

    const resolved = resolveWidgetFromHostNode(hostNode, promotedWidget.name)

    expect(resolved).toBeUndefined()
  })

  it('returns undefined when promoted interior widget is missing', () => {
    const innerNode = createHostNode([])
    const promotedWidget = createPromotedWidget(
      'promoted_text',
      '42',
      'inner_text'
    )
    const hostNode = createHostNode([promotedWidget], {
      isSubgraphNode: true,
      innerNodesById: { '42': innerNode }
    })

    const resolved = resolveWidgetFromHostNode(hostNode, promotedWidget.name)

    expect(resolved).toBeUndefined()
  })

  it('treats promoted-shaped widgets on non-subgraph nodes as local widgets', () => {
    const widget = createPromotedWidget('promoted_text', '42', 'inner_text')
    const hostNode = createHostNode([widget], {
      isSubgraphNode: false
    })

    const resolved = resolveWidgetFromHostNode(hostNode, widget.name)

    expect(resolved).toEqual({ node: hostNode, widget })
  })
})
