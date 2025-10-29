import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type {
  INodeInputSlot,
  IWidgetLocator
} from '@/lib/litegraph/src/interfaces'
import { nonWidgetedInputs } from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { describe, it } from 'vitest'

function makeFakeInputSlot(name: string, withWidget = false): INodeInputSlot {
  const widget: IWidgetLocator | undefined = withWidget ? { name } : undefined
  return {
    name,
    widget,
    link: null,
    boundingRect: [0, 0, 0, 0],
    type: 'FAKE'
  }
}

function makeFakeNodeData(inputs: INodeInputSlot[]): VueNodeData {
  const nodeData: Partial<VueNodeData> = { inputs }
  return nodeData as VueNodeData
}

describe('nodeDataUtils', () => {
  describe('nonWidgetedInputs', () => {
    it('should handle an empty inputs list', () => {
      const inputs: INodeInputSlot[] = []
      const nodeData = makeFakeNodeData(inputs)

      const actual = nonWidgetedInputs(nodeData)

      expect(actual.length).toBe(0)
    })

    it('should handle a list of only widgeted inputs', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first', true),
        makeFakeInputSlot('second', true)
      ]
      const nodeData = makeFakeNodeData(inputs)

      const actual = nonWidgetedInputs(nodeData)

      expect(actual.length).toBe(0)
    })
    it('should handle a list of only slot inputs', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first'),
        makeFakeInputSlot('second')
      ]
      const nodeData = makeFakeNodeData(inputs)

      const actual = nonWidgetedInputs(nodeData)

      expect(actual.length).toBe(2)
    })
    it('should handle a list of mixed inputs', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first'),
        makeFakeInputSlot('second'),
        makeFakeInputSlot('third', true),
        makeFakeInputSlot('fourth', true)
      ]
      const nodeData = makeFakeNodeData(inputs)

      const actual = nonWidgetedInputs(nodeData)

      expect(actual.length).toBe(2)
    })
  })
})
