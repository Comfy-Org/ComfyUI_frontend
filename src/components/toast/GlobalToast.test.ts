/* eslint-disable testing-library/no-node-access */
import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import GlobalToast from '@/components/toast/GlobalToast.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn(), remove: vi.fn(), removeAllGroups: vi.fn() })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => 'left' })
}))

const WINDOW_WIDTH = 1200
const DEBOUNCE_MS = 100

function stubRect(
  element: HTMLElement,
  left: number,
  width: number,
  top = 0
): void {
  element.getBoundingClientRect = () =>
    ({
      top,
      bottom: top,
      left,
      right: left + width,
      width,
      height: 0,
      x: left,
      y: top,
      toJSON: () => ({})
    }) as DOMRect
}

function addCanvasElement(
  className: string,
  left: number,
  width: number,
  top = 0
): HTMLElement {
  const element = document.createElement('div')
  element.className = className
  stubRect(element, left, width, top)
  document.body.appendChild(element)
  return element
}

function renderToast() {
  return render(GlobalToast, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: { Toast: true }
    }
  })
}

function injectedToastStyle(): string {
  return document.getElementById('dynamic-toast-style')?.textContent ?? ''
}

async function flushDebouncedPosition(): Promise<void> {
  await nextTick()
  vi.advanceTimersByTime(DEBOUNCE_MS)
  await nextTick()
}

describe('GlobalToast dynamic positioning', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: WINDOW_WIDTH
    })
  })

  afterEach(() => {
    cleanup()
    document.getElementById('dynamic-toast-style')?.remove()
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('anchors the toast offset to the graph panel, excluding the docked agent panel', async () => {
    addCanvasElement('graph-canvas-container', 0, 1000)
    addCanvasElement('graph-canvas-panel', 0, 600)

    renderToast()
    await nextTick()

    expect(injectedToastStyle()).toContain('right: 620px')
    expect(injectedToastStyle()).not.toContain('right: 220px')
  })

  it('falls back to the graph canvas container when the graph panel is absent', async () => {
    addCanvasElement('graph-canvas-container', 0, 1000)

    renderToast()
    await nextTick()

    expect(injectedToastStyle()).toContain('right: 220px')
  })

  it('re-anchors when the agent panel opens', async () => {
    addCanvasElement('graph-canvas-container', 0, 1000)
    const panel = addCanvasElement('graph-canvas-panel', 0, 600)

    renderToast()
    await nextTick()
    expect(injectedToastStyle()).toContain('right: 620px')

    stubRect(panel, 0, 400)
    useAgentPanelStore().isOpen = true
    await flushDebouncedPosition()

    expect(injectedToastStyle()).toContain('right: 820px')
  })

  it('re-anchors while the agent panel width changes during a drag', async () => {
    addCanvasElement('graph-canvas-container', 0, 1000)
    const panel = addCanvasElement('graph-canvas-panel', 0, 600)

    renderToast()
    await nextTick()

    stubRect(panel, 0, 350)
    useAgentPanelStore().width = 720
    await flushDebouncedPosition()

    expect(injectedToastStyle()).toContain('right: 870px')
  })

  it('takes the vertical offset from the container even when the panel anchors the edge', async () => {
    addCanvasElement('graph-canvas-container', 0, 1000, 0)
    addCanvasElement('graph-canvas-panel', 0, 600, 88)

    renderToast()
    await nextTick()

    expect(injectedToastStyle()).toContain('top: 100px')
    expect(injectedToastStyle()).toContain('right: 620px')
    expect(injectedToastStyle()).not.toContain('top: 188px')
  })

  it('keeps the last good position when the graph anchors are hidden', async () => {
    const container = addCanvasElement('graph-canvas-container', 0, 1000)
    const panel = addCanvasElement('graph-canvas-panel', 0, 600)

    renderToast()
    await nextTick()
    expect(injectedToastStyle()).toContain('right: 620px')

    stubRect(container, 0, 0)
    stubRect(panel, 0, 0)
    useToastStore().messagesToAdd = [
      { severity: 'info', summary: 'hidden anchors' }
    ]
    await nextTick()
    await nextTick()

    expect(injectedToastStyle()).toContain('right: 620px')
  })

  it('anchors beside the docked panel when the graph container is hidden', async () => {
    const container = addCanvasElement('graph-canvas-container', 0, 1000)

    renderToast()
    await nextTick()
    expect(injectedToastStyle()).toContain('right: 220px')

    stubRect(container, 0, 0)
    const panel = document.createElement('div')
    panel.className = 'docked-agent-panel'
    stubRect(panel, 780, 420, 40)
    document.body.appendChild(panel)

    useToastStore().messagesToAdd = [{ severity: 'info', summary: 'app mode' }]
    await nextTick()
    await nextTick()

    expect(injectedToastStyle()).toContain('right: 440px')
    expect(injectedToastStyle()).toContain('top: 140px')
  })

  it('re-anchors from the live DOM whenever a toast is shown', async () => {
    addCanvasElement('graph-canvas-container', 0, 1000)
    const panel = addCanvasElement('graph-canvas-panel', 0, 600)

    renderToast()
    await nextTick()
    expect(injectedToastStyle()).toContain('right: 620px')

    stubRect(panel, 0, 500)
    useToastStore().messagesToAdd = [
      { severity: 'info', summary: 'position test' }
    ]
    await nextTick()
    await nextTick()

    expect(injectedToastStyle()).toContain('right: 720px')
  })
})
