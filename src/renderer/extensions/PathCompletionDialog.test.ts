import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, expect, it, onTestFinished, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

import { i18n } from '@/i18n'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import type {
  PathCompletion,
  PathSuggestions,
  WidgetAugmentationTarget
} from '@/platform/extensions/widgetAugmentation'
import WidgetInputText from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue'
import { createMockWidget } from '@/renderer/extensions/vueNodes/widgets/components/widgetTestUtils'

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const target = { nodeType: 'PathTest', widgetName: 'path' }

const initialPath: string = '/media/'

function renderPath(
  suggest: PathCompletion['suggest'],
  options = {},
  {
    selector = target,
    widget = target
  }: {
    selector?: PathCompletion['target']
    widget?: WidgetAugmentationTarget
  } = {}
) {
  const provider: PathCompletion = {
    id: 'paths',
    kind: 'path-completion',
    target: selector,
    suggest,
    parent: () => '/'
  }
  useExtensionStore().registerExtension({
    name: 'test.paths',
    widgetAugmentations: [provider]
  })
  return render(WidgetInputText, {
    global: { plugins: [i18n] },
    props: {
      widget: createMockWidget({
        name: widget.widgetName,
        nodeType: widget.nodeType,
        value: initialPath,
        options
      }),
      modelValue: '/media/'
    }
  })
}

beforeEach(() => {
  const insert: Document['execCommand'] = (_command, _ui, text) => {
    const input = screen.getByRole('combobox')
    if (!(input instanceof HTMLInputElement)) return false
    input.setRangeText(text ?? '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: insert
  })
  onTestFinished(() => {
    Reflect.deleteProperty(document, 'execCommand')
  })
})

it('keeps directory navigation and Tab in a draft, then commits a file once', async () => {
  const user = userEvent.setup()
  const view = renderPath(async (value, { showAllFiles }) => ({
    status: 'ready',
    items:
      value === '/media/'
        ? [{ label: 'clips/', value: '/media/clips/', kind: 'directory' }]
        : showAllFiles
          ? [
              {
                label: 'notes.txt',
                value: '/media/clips/notes.txt',
                kind: 'file'
              }
            ]
          : [
              {
                label: 'scene [1], take #2.mp4',
                value: '/media/clips/scene [1], take #2.mp4',
                kind: 'file'
              }
            ]
  }))
  await user.click(screen.getByRole('button', { name: 'path' }))
  await user.click(await screen.findByRole('option', { name: 'clips/' }))
  const editor = screen.getByRole('combobox')
  expect(editor).toHaveValue('/media/clips/')
  await screen.findByRole('option', { name: 'scene [1], take #2.mp4' })
  await user.keyboard('{Tab}')
  expect(editor).toHaveValue('/media/clips/scene [1], take #2.mp4')
  expect(view.emitted('update:modelValue')).toBeUndefined()
  await user.click(screen.getByRole('button', { name: 'Show all files' }))
  await user.click(await screen.findByRole('option', { name: 'notes.txt' }))
  expect(view.emitted('update:modelValue')).toEqual([
    ['/media/clips/notes.txt']
  ])
})

it('ignores a late provider response even when it ignores cancellation', async () => {
  const user = userEvent.setup()
  let resolveOld: (value: PathSuggestions) => void = () => {}
  const old = new Promise<PathSuggestions>((resolve) => {
    resolveOld = resolve
  })
  renderPath(async (value) =>
    value === '/media/'
      ? old
      : {
          status: 'ready',
          items: [{ label: 'current.mp4', value: '/current.mp4', kind: 'file' }]
        }
  )
  await user.click(screen.getByRole('button', { name: 'path' }))
  await user.type(screen.getByRole('combobox'), 'new')
  await screen.findByRole('option', { name: 'current.mp4' })
  resolveOld({
    status: 'ready',
    items: [{ label: 'stale.mp4', value: '/stale.mp4', kind: 'file' }]
  })
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
  expect(screen.getByRole('option', { name: 'current.mp4' })).toBeVisible()
})

it('allows retry and arbitrary free entry when lookup is unavailable', async () => {
  const user = userEvent.setup()
  let unavailable = true
  const view = renderPath(async () =>
    unavailable ? { status: 'unavailable' } : { status: 'ready', items: [] }
  )
  await user.click(screen.getByRole('button', { name: 'path' }))
  await screen.findByText(/Suggestions unavailable/)
  unavailable = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText(/No matching paths/)
  const editor = screen.getByRole('combobox')
  await user.clear(editor)
  await user.type(editor, 'https://example.org/new clip.mp4')
  await user.keyboard('{Enter}')
  expect(view.emitted('update:modelValue')).toEqual([
    ['https://example.org/new clip.mp4']
  ])
})

it('cancels without writing and discards a draft after an external value change', async () => {
  const user = userEvent.setup()
  const view = renderPath(async () => ({ status: 'ready', items: [] }))
  await user.click(screen.getByRole('button', { name: 'path' }))
  await user.type(screen.getByRole('combobox'), 'draft')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(view.emitted('update:modelValue')).toBeUndefined()
  await user.click(screen.getByRole('button', { name: 'path' }))
  await view.rerender({ modelValue: '/changed-elsewhere/' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(view.emitted('update:modelValue')).toBeUndefined()
})

it('does not commit or navigate when native insertion refuses the edit', async () => {
  const user = userEvent.setup()
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => false
  })
  const view = renderPath(async () => ({
    status: 'ready',
    items: [{ label: 'clip.mp4', value: '/clip.mp4', kind: 'file' }]
  }))
  await user.click(screen.getByRole('button', { name: 'path' }))
  await user.click(await screen.findByRole('option', { name: 'clip.mp4' }))
  expect(screen.getByRole('combobox')).toHaveValue('/media/')
  expect(screen.getByRole('alert')).toHaveTextContent('Your text is unchanged')
  expect(view.emitted('update:modelValue')).toBeUndefined()
})

it('falls back to manual editing when providers conflict', () => {
  renderPath(async () => ({ status: 'ready', items: [] }))
  useExtensionStore().registerExtension({
    name: 'test.other',
    widgetAugmentations: [
      {
        id: 'other',
        kind: 'path-completion',
        target,
        suggest: async () => ({ status: 'ready', items: [] }),
        parent: (value) => value
      }
    ]
  })
  return waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'path' })).toHaveValue('/media/')
  )
})

it.for([
  { name: 'read-only', options: { read_only: true } },
  { name: 'disabled', options: { disabled: true } }
])('discards the draft when the field becomes $name', async ({ options }) => {
  const user = userEvent.setup()
  const view = renderPath(async () => ({ status: 'ready', items: [] }))
  await user.click(screen.getByRole('button', { name: 'path' }))
  await user.type(screen.getByRole('combobox'), 'draft')
  await view.rerender({
    widget: createMockWidget({
      name: 'path',
      nodeType: 'PathTest',
      value: initialPath,
      options
    })
  })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'path' })).toBeDisabled()
  expect(view.emitted('update:modelValue')).toBeUndefined()
})

it('cancels a session when its provider is unregistered', async () => {
  const user = userEvent.setup()
  const view = renderPath(async () => ({ status: 'ready', items: [] }))
  await user.click(screen.getByRole('button', { name: 'path' }))
  await user.type(screen.getByRole('combobox'), 'draft')
  useExtensionStore().unregisterExtension('test.paths')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(screen.getByRole('textbox', { name: 'path' })).toHaveValue('/media/')
  expect(view.emitted('update:modelValue')).toBeUndefined()
})

it('keeps the draft intact when a suggested path exceeds maxlength', async () => {
  const user = userEvent.setup()
  const view = renderPath(
    async () => ({
      status: 'ready',
      items: [{ label: 'long.mp4', value: '/media/long.mp4', kind: 'file' }]
    }),
    { maxlength: 8 }
  )
  await user.click(screen.getByRole('button', { name: 'path' }))
  await user.click(await screen.findByRole('option', { name: 'long.mp4' }))
  expect(screen.getByRole('combobox')).toHaveValue('/media/')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'longer than this field allows'
  )
  expect(view.emitted('update:modelValue')).toBeUndefined()
})

const vhsPathWidgets = new Set(['video', 'image', 'directory'])

function vhsPaths(widget: WidgetAugmentationTarget) {
  return (
    widget.nodeType.startsWith('VHS_') && vhsPathWidgets.has(widget.widgetName)
  )
}

it.for([
  { nodeType: 'VHS_LoadVideoPath', widgetName: 'video', hosted: true },
  { nodeType: 'VHS_LoadImagesPath', widgetName: 'directory', hosted: true },
  { nodeType: 'VHS_LoadVideoPath', widgetName: 'format', hosted: false },
  { nodeType: 'LoadVideo', widgetName: 'video', hosted: false }
])(
  'hosts a predicate provider on $nodeType widget $widgetName: $hosted',
  ({ nodeType, widgetName, hosted }) => {
    renderPath(
      async () => ({ status: 'ready', items: [] }),
      {},
      { selector: vhsPaths, widget: { nodeType, widgetName } }
    )
    expect(screen.queryByRole('button', { name: widgetName }) !== null).toBe(
      hosted
    )
  }
)

it('tells a shared provider which widget it is completing', async () => {
  const user = userEvent.setup()
  const suggest = vi.fn<PathCompletion['suggest']>(async () => ({
    status: 'ready',
    items: []
  }))
  const widget = { nodeType: 'VHS_LoadImagesPath', widgetName: 'directory' }
  renderPath(suggest, {}, { selector: vhsPaths, widget })
  await user.click(screen.getByRole('button', { name: 'directory' }))
  await waitFor(() =>
    expect(suggest).toHaveBeenCalledWith(
      '/media/',
      expect.objectContaining({ widget })
    )
  )
})

it('keeps manual entry and reports once when a predicate throws', async () => {
  const failure = new Error('bad selector')
  renderPath(
    async () => ({ status: 'ready', items: [] }),
    {},
    {
      selector: () => {
        throw failure
      }
    }
  )
  expect(screen.getByRole('textbox', { name: 'path' })).toHaveValue('/media/')
  expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
    errorType: 'error_evaluating_widget_augmentation',
    surface: 'platform',
    context: { augmentation: 'paths' }
  })
})
