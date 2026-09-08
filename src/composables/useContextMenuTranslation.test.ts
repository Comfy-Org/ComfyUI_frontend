import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type {
  IContextMenuOptions,
  IContextMenuValue,
  INodeInputSlot,
  IWidget
} from '@/lib/litegraph/src/litegraph'

import { translateContextMenuItems } from './useContextMenuTranslation'

vi.mock('@/i18n', () => ({
  resolveNodeDefText: vi.fn(),
  st: (_key: string, fallback: string) => fallback,
  te: () => false
}))

describe('translateContextMenuItems', () => {
  it.for([
    ['Convert seed to input', 'Convert Seed label to input'],
    ['Convert seed to widget', 'Convert Seed label to widget']
  ])('prefers a label over the internal name', ([content, expected]) => {
    const values = [fromPartial<IContextMenuValue>({ content })]
    const options = fromPartial<IContextMenuOptions>({
      extra: {
        inputs: [
          fromPartial<INodeInputSlot>({ name: 'seed', label: 'Seed label' })
        ],
        widgets: [fromPartial<IWidget>({ name: 'seed' })]
      }
    })

    translateContextMenuItems(values, options)

    expect(values[0].content).toBe(expected)
  })
})
