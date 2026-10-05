import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import SplitterGroup from '@/components/ui/splitter/SplitterGroup.vue'
import SplitterPanel from '@/components/ui/splitter/SplitterPanel.vue'
import SplitterResizeHandle from '@/components/ui/splitter/SplitterResizeHandle.vue'
import { usePanelSizing } from './usePanelSizing'

beforeEach(() => localStorage.clear())

async function setupSizing({ left = 400, right = 200, total = 1000 } = {}) {
  const containerWidth = ref(total)
  const rightVisible = ref(true)
  const leftVisible = ref(true)
  const leftKey = ref('left')
  const state = render({
    setup() {
      const sizing = usePanelSizing(
        [
          {
            id: 'left',
            storageKey: leftKey,
            visible: true,
            minWidth: 300,
            defaultWidth: () => left
          },
          {
            id: 'right',
            storageKey: 'right',
            visible: rightVisible,
            minWidth: 0,
            defaultWidth: () => right
          }
        ],
        containerWidth,
        160
      )
      return { ...sizing, leftVisible }
    },
    template: `
      <div @pointerup="onResizeEnd" @keydown.capture="onResizeStart" @keyup="onResizeEnd" @focusout="onResizeEnd">
        <div v-if="leftVisible" data-panel-id="left" data-testid="left" />
        <button data-panel-resize-handle-id="left-handle" data-orientation="horizontal">Left handle</button>
        <div />
        <button data-panel-resize-handle-id="right-handle" data-orientation="horizontal" @pointerdown="onResizeDragging(true, 'right')">Right handle</button>
        <div data-panel-id="right" data-testid="right" />
        <output data-testid="sizes">{{ panelPercentages }}</output>
      </div>
    `
  })
  const leftWidth = ref(left)
  const rightWidth = ref(right)
  vi.spyOn(
    screen.getByTestId('left'),
    'getBoundingClientRect'
  ).mockImplementation(() => new DOMRect(0, 0, leftWidth.value, 600))
  vi.spyOn(
    screen.getByTestId('right'),
    'getBoundingClientRect'
  ).mockImplementation(() => new DOMRect(0, 0, rightWidth.value, 600))
  await nextTick()
  await nextTick()
  return {
    ...state,
    containerWidth,
    rightVisible,
    leftVisible,
    leftKey,
    leftWidth,
    rightWidth
  }
}

describe('pixel panel sizing', () => {
  it('resizes both real side panels while preserving the center minimum', async () => {
    const total = ref(1000)
    render({
      components: { SplitterGroup, SplitterPanel, SplitterResizeHandle },
      setup() {
        const sizing = usePanelSizing(
          [
            {
              id: 'left',
              storageKey: 'left',
              visible: true,
              minWidth: 300,
              defaultWidth: () => 600
            },
            {
              id: 'right',
              storageKey: 'right',
              visible: true,
              minWidth: 0,
              defaultWidth: () => 300
            }
          ],
          total,
          160
        )
        const layout = ref<number[]>([])
        return { ...sizing, total, layout }
      },
      template: `
        <SplitterGroup @layout="layout = $event">
          <SplitterPanel id="left" :order="1" :ref="panelRefs.first" :min-size="300 / total * 100" :default-size="panelPercentages[0]" />
          <SplitterResizeHandle />
          <SplitterPanel :order="2" :min-size="160 / total * 100" :default-size="panelPercentages[1]" />
          <SplitterResizeHandle />
          <SplitterPanel id="right" :order="3" :ref="panelRefs.last" :default-size="panelPercentages[2]" />
        </SplitterGroup>
        <output data-testid="layout">{{ layout }}</output>
      `
    })
    await expect
      .poll(() => JSON.parse(screen.getByTestId('layout').textContent))
      .toEqual([57, 16, 27])

    total.value = 800

    await expect
      .poll(() => JSON.parse(screen.getByTestId('layout').textContent))
      .toEqual([58.75, 20, 21.25])
    expect(localStorage.getItem('left')).toBe('600')
    expect(localStorage.getItem('right')).toBe('300')
  })

  it.for([
    { stored: '450', expected: 450 },
    { stored: '0', expected: 400 },
    { stored: '-10', expected: 400 },
    { stored: 'NaN', expected: 400 },
    { stored: 'Infinity', expected: 400 }
  ])(
    'restores or replaces stored width $stored',
    async ({ stored, expected }) => {
      localStorage.setItem('left', stored)
      await setupSizing()
      await nextTick()
      expect(localStorage.getItem('left')).toBe(String(expected))
    }
  )

  it('reserves center space without overwriting widths when the container narrows', async () => {
    const { containerWidth, rightVisible } = await setupSizing()
    containerWidth.value = 600
    await nextTick()
    const narrow: number[] = JSON.parse(screen.getByTestId('sizes').textContent)
    expect(narrow[0]).toBeCloseTo(57.77778)
    expect(narrow[1]).toBeCloseTo(26.66667)
    expect(narrow[2]).toBeCloseTo(15.55556)
    expect(localStorage.getItem('left')).toBe('400')
    expect(localStorage.getItem('right')).toBe('200')

    rightVisible.value = false
    containerWidth.value = 1000
    await nextTick()
    expect(JSON.parse(screen.getByTestId('sizes').textContent)).toEqual([
      40, 60, 0
    ])
  })

  it('saves only the panel beside the dragged handle, not an automatically squeezed neighbour', async () => {
    const { leftWidth, rightWidth } = await setupSizing({ left: 800 })
    const handle = screen.getByRole('button', { name: 'Right handle' })
    handle.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    leftWidth.value = 480
    rightWidth.value = 250
    handle.dispatchEvent(new Event('pointerup', { bubbles: true }))
    await nextTick()
    expect(localStorage.getItem('left')).toBe('800')
    expect(localStorage.getItem('right')).toBe('250')
  })

  it('persists a resize after the previous keyboard gesture is interrupted by a remount', async () => {
    const { leftVisible, rightWidth } = await setupSizing()
    const leftHandle = screen.getByRole('button', { name: 'Left handle' })
    leftHandle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    )

    leftVisible.value = false
    await nextTick()

    const rightHandle = screen.getByRole('button', { name: 'Right handle' })
    rightHandle.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    rightWidth.value = 275
    rightHandle.dispatchEvent(new Event('pointerup', { bubbles: true }))
    await nextTick()

    expect(localStorage.getItem('right')).toBe('275')
  })

  it('finishes keyboard persistence when the resize handle loses focus', async () => {
    const { leftWidth } = await setupSizing()
    const handle = screen.getByRole('button', { name: 'Left handle' })
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    )
    leftWidth.value = 510
    handle.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await nextTick()

    expect(localStorage.getItem('left')).toBe('510')
  })

  it.for([
    { name: 'unchanged', width: 400, key: 'left', expected: '400' },
    { name: 'hidden', width: 0, key: 'left', expected: '400' },
    { name: 'new key', width: 520, key: 'other', expected: '400' },
    { name: 'resized', width: 520, key: 'left', expected: '520' }
  ])(
    'handles repeated keyboard starts with $name panel',
    async ({ width, key, expected }) => {
      const { leftWidth, leftKey } = await setupSizing()
      const handle = screen.getByRole('button', { name: 'Left handle' })
      handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      )
      leftWidth.value = width
      handle.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          repeat: true
        })
      )
      leftKey.value = key
      handle.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true })
      )
      await nextTick()
      expect(localStorage.getItem('left')).toBe(expected)
    }
  )

  it('loads a new storage key without overwriting the previous tab', async () => {
    localStorage.setItem('left', '550')
    localStorage.setItem('other', '-10')
    const { leftKey } = await setupSizing()
    leftKey.value = 'other'
    await nextTick()
    await nextTick()
    expect(localStorage.getItem('left')).toBe('550')
    expect(localStorage.getItem('other')).toBe('400')
  })
})
