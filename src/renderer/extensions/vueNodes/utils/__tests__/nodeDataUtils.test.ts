import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type {
  INodeInputSlot,
  IWidgetLocator
} from '@/lib/litegraph/src/interfaces'
import type { LinkId } from '@/renderer/core/layout/types'
import {
  linkedWidgetedInputs,
  nonWidgetedInputs
} from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { useLinkStore } from '@/stores/linkStore'
import { beforeEach, describe, it } from 'vitest'

const GRAPH_ID = 'graph-test'
const NODE_ID = toNodeId(1)

function makeFakeInputSlot(
  name: string,
  withWidget = false,
  link: LinkId | null = null
): INodeInputSlot {
  const widget: IWidgetLocator | undefined = withWidget ? { name } : undefined
  return {
    name,
    widget,
    link,
    boundingRect: [0, 0, 0, 0],
    type: 'FAKE'
  }
}

function connectInputSlot(slot: number, linkId = slot + 1) {
  useLinkStore().registerLink(GRAPH_ID, {
    id: toLinkId(linkId),
    originNodeId: toNodeId(99),
    originSlot: 0,
    targetNodeId: NODE_ID,
    targetSlot: slot,
    type: 'FAKE'
  })
}

describe('nodeDataUtils', () => {
  describe('nonWidgetedInputs', () => {
    it('should handle an empty inputs list', () => {
      const inputs: INodeInputSlot[] = []
      const actual = nonWidgetedInputs(inputs)

      expect(actual.length).toBe(0)
    })

    it('should handle a list of only widgeted inputs', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first', true),
        makeFakeInputSlot('second', true)
      ]
      const actual = nonWidgetedInputs(inputs)

      expect(actual.length).toBe(0)
    })

    it('should handle a list of only slot inputs', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first'),
        makeFakeInputSlot('second')
      ]
      const actual = nonWidgetedInputs(inputs)

      expect(actual.length).toBe(2)
    })

    it('should handle a list of mixed inputs', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first'),
        makeFakeInputSlot('second'),
        makeFakeInputSlot('third', true),
        makeFakeInputSlot('fourth', true)
      ]
      const actual = nonWidgetedInputs(inputs)

      expect(actual.length).toBe(2)
    })
  })

  describe('linkedWidgetedInputs', () => {
    beforeEach(() => {
      setActivePinia(createTestingPinia({ stubActions: false }))
    })

    it('returns nothing when no input slot is connected', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first'),
        makeFakeInputSlot('second'),
        makeFakeInputSlot('third', true),
        makeFakeInputSlot('fourth', true)
      ]
      const actual = linkedWidgetedInputs(NODE_ID, inputs, GRAPH_ID)

      expect(actual.length).toBe(0)
    })

    it('returns the widgeted inputs whose slots are connected', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first'),
        makeFakeInputSlot('second'),
        makeFakeInputSlot('third', true),
        makeFakeInputSlot('fourth', true),
        makeFakeInputSlot('fifth', true)
      ]
      connectInputSlot(3)
      connectInputSlot(4)

      const actual = linkedWidgetedInputs(NODE_ID, inputs, GRAPH_ID)

      expect(actual.map((slot) => slot.name)).toEqual(['fourth', 'fifth'])
    })

    it('excludes connected inputs that have no widget', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first'),
        makeFakeInputSlot('second', true)
      ]
      connectInputSlot(0)

      const actual = linkedWidgetedInputs(NODE_ID, inputs, GRAPH_ID)

      expect(actual.length).toBe(0)
    })

    it('ignores the stale slot link mirror field', () => {
      const inputs: INodeInputSlot[] = [
        makeFakeInputSlot('first', true, toLinkId(1)),
        makeFakeInputSlot('second', true)
      ]
      connectInputSlot(1)

      const actual = linkedWidgetedInputs(NODE_ID, inputs, GRAPH_ID)

      expect(actual.map((slot) => slot.name)).toEqual(['second'])
    })
  })
})
