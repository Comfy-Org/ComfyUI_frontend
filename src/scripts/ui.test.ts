import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSettingStore } = vi.hoisted(() => ({
  mockSettingStore: {
    get: vi.fn()
  }
}))

vi.mock('@/composables/useRunButtonTelemetry', () => ({
  useRunButtonTelemetry: () => ({ trackRunButton: vi.fn() })
}))

vi.mock('@/platform/remote/comfyui/jobs/fetchJobs', () => ({
  extractWorkflow: vi.fn()
}))

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({ show: vi.fn() })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackWorkflowExecution: vi.fn() })
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ resetView: vi.fn() })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: vi.fn() })
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ focusMode: false })
}))

vi.mock('./api', () => ({
  api: {
    addEventListener: vi.fn(),
    clearItems: vi.fn(),
    deleteItem: vi.fn(),
    dispatchCustomEvent: vi.fn(),
    getHistory: vi.fn(),
    getJobDetail: vi.fn(),
    getQueue: vi.fn(),
    interrupt: vi.fn()
  }
}))

vi.mock('./app', () => ({
  app: {
    clean: vi.fn(),
    handleFile: vi.fn(),
    loadGraphData: vi.fn(),
    openClipspace: vi.fn(),
    queuePrompt: vi.fn(),
    refreshComboInNodes: vi.fn(() => Promise.resolve())
  },
  ComfyApp: class ComfyApp {}
}))

vi.mock('./ui/dialog', () => ({
  ComfyDialog: class ComfyDialog {}
}))

vi.mock('./ui/settings', () => ({
  ComfySettingsDialog: class ComfySettingsDialog {}
}))

vi.mock('./ui/toggleSwitch', () => ({
  toggleSwitch: () => document.createElement('div')
}))

import { extractWorkflow } from '@/platform/remote/comfyui/jobs/fetchJobs'

import { api } from './api'
import { app } from './app'
import { $el, ComfyUI } from './ui'

beforeEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
  vi.clearAllMocks()
  mockSettingStore.get.mockReturnValue(undefined)
  Object.assign(app, {
    lastExecutionError: undefined,
    nodeOutputs: undefined
  })
})

async function click(button: HTMLButtonElement) {
  const handler = button.onclick
  expect(handler).toBeTypeOf('function')
  await Promise.resolve(handler?.call(button, fromAny(new MouseEvent('click'))))
}

function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text
  )
  if (!button) throw new Error(`Missing button: ${text}`)
  return button
}

describe('$el', () => {
  it('creates elements with classes, children, props, and callbacks', () => {
    const parent = document.createElement('section')
    const child = document.createElement('span')
    const callback = vi.fn()

    const element = $el(
      'label.primary.secondary',
      {
        parent,
        $: callback,
        dataset: { role: 'name' },
        for: 'target-input',
        style: { display: 'block' },
        title: 'Label'
      },
      child
    )

    expect(element.tagName).toBe('LABEL')
    expect(element.classList.contains('primary')).toBe(true)
    expect(element.classList.contains('secondary')).toBe(true)
    expect(element.dataset.role).toBe('name')
    expect(element.getAttribute('for')).toBe('target-input')
    expect(element.style.display).toBe('block')
    expect(element.title).toBe('Label')
    expect(element.firstElementChild).toBe(child)
    expect(parent.firstElementChild).toBe(element)
    expect(callback).toHaveBeenCalledWith(element)
  })

  it('accepts string and single-element children shorthands', () => {
    const textElement = $el('button', 'Run')
    const child = document.createElement('strong')
    const wrapper = $el('div', child)

    expect(textElement.textContent).toBe('Run')
    expect(wrapper.firstElementChild).toBe(child)
  })
})

describe('ComfyUI legacy menu', () => {
  it('loads queue items and runs list actions', async () => {
    vi.mocked(api.getQueue).mockResolvedValue({
      Running: [{ id: 'running', priority: 1 }],
      Pending: [{ id: 'pending', priority: 2 }]
    } as never)
    vi.mocked(api.getJobDetail).mockResolvedValue({
      outputs: { node: { images: ['image.png'] } }
    } as never)
    vi.mocked(extractWorkflow).mockResolvedValue({ nodes: [] } as never)
    const ui = new ComfyUI(app)

    await ui.queue.show()
    await click(buttonByText(ui.queue.element, 'Load'))

    expect(api.getJobDetail).toHaveBeenCalledWith('running')
    expect(extractWorkflow).toHaveBeenCalled()
    expect(app.loadGraphData).toHaveBeenCalledWith({ nodes: [] }, true, false)
    expect(app.nodeOutputs).toEqual({ node: { images: ['image.png'] } })

    await click(buttonByText(ui.queue.element, 'Cancel'))
    expect(api.interrupt).toHaveBeenCalledWith('running')

    await click(buttonByText(ui.queue.element, 'Delete'))
    expect(api.deleteItem).toHaveBeenCalledWith('queue', 'pending')

    await click(buttonByText(ui.queue.element, 'Clear Queue'))
    expect(api.clearItems).toHaveBeenCalledWith('queue')

    await click(buttonByText(ui.queue.element, 'Refresh'))
    expect(api.getQueue).toHaveBeenCalled()
  })

  it('skips loading queue items when job details are unavailable', async () => {
    vi.mocked(api.getQueue).mockResolvedValue({
      Running: [{ id: 'running', priority: 1 }],
      Pending: []
    } as never)
    vi.mocked(api.getJobDetail).mockResolvedValue(null as never)
    const ui = new ComfyUI(app)

    await ui.queue.show()
    await click(buttonByText(ui.queue.element, 'Load'))

    expect(extractWorkflow).not.toHaveBeenCalled()
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('loads queue item workflows without outputs', async () => {
    vi.mocked(api.getQueue).mockResolvedValue({
      Running: [{ id: 'running', priority: 1 }],
      Pending: []
    } as never)
    vi.mocked(api.getJobDetail).mockResolvedValue({ id: 'running' } as never)
    vi.mocked(extractWorkflow).mockResolvedValue({ nodes: [] } as never)
    const ui = new ComfyUI(app)

    await ui.queue.show()
    await click(buttonByText(ui.queue.element, 'Load'))

    expect(app.loadGraphData).toHaveBeenCalledWith({ nodes: [] }, true, false)
    expect(app.nodeOutputs).toBeUndefined()
  })

  it('loads history in reverse order', async () => {
    vi.mocked(api.getHistory).mockResolvedValue([
      { id: 'old', priority: 1 },
      { id: 'new', priority: 2 }
    ] as never)
    const ui = new ComfyUI(app)

    await ui.history.show()

    expect(ui.history.element.textContent).toContain('2: LoadDelete')
    expect(ui.history.element.textContent?.indexOf('2:')).toBeLessThan(
      ui.history.element.textContent?.indexOf('1:') ?? Number.MAX_SAFE_INTEGER
    )
  })

  it('updates queue status and auto-queues when enabled', () => {
    const ui = new ComfyUI(app)
    ui.autoQueueEnabled = true
    ui.autoQueueMode = 'instant'
    ui.lastQueueSize = 1
    ui.batchCount = 3

    ui.setStatus({ exec_info: { queue_remaining: 0 } })

    expect(app.queuePrompt).toHaveBeenCalledWith(0, 3)
    expect(ui.queueSize.textContent).toBe('Queue size: 0')
    expect(ui.lastQueueSize).toBe(3)

    ui.setStatus(null)
    expect(ui.queueSize.textContent).toBe('Queue size: ERR')
  })

  it('does not auto-queue while a prior execution error is present', () => {
    const ui = new ComfyUI(app)
    ui.autoQueueEnabled = true
    ui.autoQueueMode = 'instant'
    ui.lastQueueSize = 1
    Object.assign(app, { lastExecutionError: new Error('failed') })

    ui.setStatus({ exec_info: { queue_remaining: 0 } })

    expect(app.queuePrompt).not.toHaveBeenCalled()
    expect(ui.lastQueueSize).toBe(0)
  })

  it('tracks graph changes for change-mode auto queueing', () => {
    const ui = new ComfyUI(app)
    const graphChanged = vi
      .mocked(api.addEventListener)
      .mock.calls.find(([eventName]) => eventName === 'graphChanged')?.[1]
    if (!graphChanged) throw new Error('Missing graphChanged listener')

    ui.autoQueueEnabled = true
    ui.autoQueueMode = 'change'
    ui.lastQueueSize = 1
    graphChanged(fromAny(new CustomEvent('graphChanged')))

    expect(ui.graphHasChanged).toBe(true)

    ui.lastQueueSize = 0
    graphChanged(fromAny(new CustomEvent('graphChanged')))

    expect(app.queuePrompt).toHaveBeenCalledWith(0, 1)
    expect(ui.graphHasChanged).toBe(false)
  })

  it('wires primary menu buttons to app and command actions', async () => {
    const ui = new ComfyUI(app)

    await click(buttonByText(document, 'Queue Prompt'))
    expect(app.queuePrompt).toHaveBeenCalledWith(0, 1)

    await click(buttonByText(document, 'Queue Front'))
    expect(app.queuePrompt).toHaveBeenCalledWith(-1, 1)

    await click(buttonByText(document, 'Save'))
    await click(buttonByText(document, 'Save (API Format)'))
    await click(buttonByText(document, 'Refresh'))
    await click(buttonByText(document, 'Clipspace'))
    await click(buttonByText(document, 'Clear'))
    await click(buttonByText(document, 'Load Default'))
    await click(buttonByText(document, 'Reset View'))

    expect(app.refreshComboInNodes).toHaveBeenCalled()
    expect(app.openClipspace).toHaveBeenCalled()
    expect(app.clean).toHaveBeenCalled()
    expect(app.loadGraphData).toHaveBeenCalledWith()
    expect(ui.menuContainer.style.display).toBe('none')
  })

  it('wires file input and legacy option controls', async () => {
    const ui = new ComfyUI(app)
    const file = new File(['{}'], 'workflow.json', {
      type: 'application/json'
    })
    const fileInput = document.getElementById(
      'comfy-file-input'
    ) as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file]
    })

    await Promise.resolve(
      fileInput.onchange?.call(fileInput, new Event('change'))
    )
    expect(app.handleFile).toHaveBeenCalledWith(file, 'file_button')
    expect(fileInput.value).toBe('')

    const range = document.getElementById(
      'batchCountInputRange'
    ) as HTMLInputElement
    const number = document.getElementById(
      'batchCountInputNumber'
    ) as HTMLInputElement
    range.value = '4'
    const extraOptionsCheckbox = document.querySelector(
      'label input[type="checkbox"]'
    ) as HTMLInputElement
    extraOptionsCheckbox.checked = true
    extraOptionsCheckbox.onchange?.call(
      extraOptionsCheckbox,
      fromPartial({ srcElement: extraOptionsCheckbox })
    )
    expect(ui.batchCount).toBe(4)
    expect(document.getElementById('extraOptions')?.style.display).toBe('block')

    number.value = '7'
    number.oninput?.call(number, fromPartial({ target: number }))
    expect(range.value).toBe('7')

    range.value = '9'
    range.oninput?.call(range, fromPartial({ srcElement: range }))
    expect(number.value).toBe('9')

    const autoQueueCheckbox = document.getElementById(
      'autoQueueCheckbox'
    ) as HTMLInputElement
    autoQueueCheckbox.checked = true
    autoQueueCheckbox.onchange?.call(
      autoQueueCheckbox,
      fromPartial({ target: autoQueueCheckbox })
    )
    expect(ui.autoQueueEnabled).toBe(true)

    extraOptionsCheckbox.checked = false
    extraOptionsCheckbox.onchange?.call(
      extraOptionsCheckbox,
      fromPartial({ srcElement: extraOptionsCheckbox })
    )
    expect(ui.batchCount).toBe(1)
    expect(ui.autoQueueEnabled).toBe(false)
    expect(document.getElementById('extraOptions')?.style.display).toBe('none')
  })

  it('toggles queue visibility through the menu button', async () => {
    vi.mocked(api.getQueue).mockResolvedValue({
      Running: [],
      Pending: []
    } as never)
    const ui = new ComfyUI(app)

    await click(buttonByText(document, 'View Queue'))
    expect(ui.queue.visible).toBe(true)

    await click(buttonByText(document, 'Close'))
    expect(ui.queue.visible).toBe(false)
  })

  it('does not clear or load defaults when confirmation is declined', async () => {
    mockSettingStore.get.mockReturnValue(true)
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    )
    new ComfyUI(app)

    await click(buttonByText(document, 'Clear'))
    await click(buttonByText(document, 'Load Default'))

    expect(app.clean).not.toHaveBeenCalled()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('persists manual menu dragging', () => {
    Object.defineProperty(document.body, 'clientWidth', {
      configurable: true,
      value: 1000
    })
    Object.defineProperty(document.body, 'clientHeight', {
      configurable: true,
      value: 800
    })
    const ui = new ComfyUI(app)
    ui.menuContainer.style.display = 'block'
    Object.defineProperty(ui.menuContainer, 'clientWidth', {
      configurable: true,
      value: 100
    })
    Object.defineProperty(ui.menuContainer, 'clientHeight', {
      configurable: true,
      value: 80
    })
    Object.defineProperty(ui.menuContainer, 'offsetLeft', {
      configurable: true,
      get: () => 700
    })
    Object.defineProperty(ui.menuContainer, 'offsetTop', {
      configurable: true,
      get: () => 20
    })
    const handle = ui.menuContainer.querySelector('.drag-handle') as HTMLElement

    handle.onmousedown?.(
      new MouseEvent('mousedown', { clientX: 10, clientY: 10 })
    )
    document.onmousemove?.(
      new MouseEvent('mousemove', { clientX: 20, clientY: 30 })
    )
    document.onmouseup?.(new MouseEvent('mouseup'))

    expect(ui.menuContainer.classList.contains('comfy-menu-manual-pos')).toBe(
      true
    )
    expect(ui.menuContainer.style.right).toBe('190px')
    expect(localStorage.getItem('Comfy.MenuPosition')).toBe(
      JSON.stringify({ x: 700, y: 20 })
    )
    expect(document.onmousemove).toBeNull()
    expect(document.onmouseup).toBeNull()
  })
})
