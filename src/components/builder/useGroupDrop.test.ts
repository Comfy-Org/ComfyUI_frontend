import { describe, expect, it, vi, onTestFinished } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h, withDirectives } from 'vue'
import DraggableList from '@/components/common/DraggableList.vue'
import { useInputGroupStore } from '@/stores/inputGroupStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import {
  getDragItemKey,
  getEdgeTriZone,
  vGroupDropTarget
} from './useGroupDrop'

vi.mock(import('@/scripts/app'))

function mockElement(top: number, height: number): HTMLElement {
  const element = document.createElement('div')
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, top, 100, height)
  )
  return element
}

describe('getEdgeTriZone', () => {
  it.for([
    { clientY: 110, expected: 'before' },
    { clientY: 145, expected: 'center' },
    { clientY: 180, expected: 'after' },
    { clientY: 100, expected: 'before' },
    { clientY: 190, expected: 'after' }
  ] as const)('maps y=$clientY to $expected', ({ clientY, expected }) => {
    expect(getEdgeTriZone(mockElement(100, 90), clientY)).toBe(expected)
  })
})

describe('getDragItemKey', () => {
  const inputId = widgetId('root', toNodeId(1), 'steps')

  it('returns a canonical WidgetId for a group item', () => {
    expect(getDragItemKey({ type: 'group-item', itemKey: inputId })).toBe(
      inputId
    )
  })

  it.for([
    { type: 'other', itemKey: inputId },
    { type: 'group-item', itemKey: 'legacy:missing' },
    { type: 'group-item', itemKey: 123 },
    {}
  ])('rejects non-group drag data: %j', (data) => {
    expect(getDragItemKey(data)).toBeNull()
  })
})

describe('list-to-group drop bridge', () => {
  it.for([
    {
      gesture: 'drag',
      active: true,
      button: 0,
      endX: 100,
      cancel: false,
      expected: true
    },
    {
      gesture: 'click',
      active: true,
      button: 0,
      endX: 0,
      cancel: false,
      expected: false
    },
    {
      gesture: 'inactive item',
      active: false,
      button: 0,
      endX: 100,
      cancel: false,
      expected: false
    },
    {
      gesture: 'right click',
      active: true,
      button: 2,
      endX: 100,
      cancel: false,
      expected: false
    },
    {
      gesture: 'cancelled drag',
      active: true,
      button: 0,
      endX: 100,
      cancel: true,
      expected: false
    }
  ])('handles $gesture', async ({ active, button, endX, cancel, expected }) => {
    useWorkflowStore().activeWorkflow = createMockLoadedWorkflow({
      activeMode: 'builder:arrange'
    })
    const store = useInputGroupStore()
    const groupId = store.createGroup()
    const key = widgetId('root', toNodeId(1), 'steps')
    render(
      defineComponent({
        setup() {
          return () =>
            h('div', [
              h(
                DraggableList,
                { modelValue: [key] },
                {
                  default: () =>
                    h('div', {
                      role: 'button',
                      'aria-label': 'Source',
                      class: active
                        ? 'draggable-item drag-handle'
                        : 'draggable-item',
                      'data-widget-key': key
                    })
                }
              ),
              withDirectives(
                h('div', { role: 'region', 'aria-label': 'Group target' }),
                [[vGroupDropTarget, { groupId }]]
              )
            ])
        }
      })
    )
    const target = screen.getByRole('region', { name: 'Group target' })
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [target]
    })
    onTestFinished(() => {
      Reflect.deleteProperty(document, 'elementsFromPoint')
    })
    const user = userEvent.setup()
    await user.pointer({
      keys: button === 0 ? '[MouseLeft>]' : '[MouseRight>]',
      target: screen.getByRole('button', { name: 'Source' }),
      coords: { clientX: 0, clientY: 0 }
    })
    if (cancel) await user.keyboard('{Escape}')
    await user.pointer({
      keys: button === 0 ? '[/MouseLeft]' : '[/MouseRight]',
      target,
      coords: { clientX: endX, clientY: 0 }
    })
    expect(store.findGroup(groupId)?.items).toEqual(expected ? [{ key }] : [])
  })
})
