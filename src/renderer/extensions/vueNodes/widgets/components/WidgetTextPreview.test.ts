import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeOutputWith, ResultItem } from '@/schemas/apiSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { widgetId } from '@/types/widgetId'

import type * as VueI18n from 'vue-i18n'

import type * as LitegraphUtil from '@/utils/litegraphUtil'

import WidgetTextPreview from './WidgetTextPreview.vue'

const GRAPH_ID = 'graph-1'
const NODE_ID = toNodeId('7')
const LOCATOR = 'loc-1'

const { downloadFileMock, copyMock } = vi.hoisted(() => ({
  downloadFileMock: vi.fn(),
  copyMock: vi.fn()
}))

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof VueI18n>()),
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: downloadFileMock
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: copyMock })
}))

vi.mock('@/utils/litegraphUtil', async (importOriginal) => ({
  ...(await importOriginal<typeof LitegraphUtil>()),
  resolveNode: () => ({})
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ nodeToNodeLocatorId: () => LOCATOR })
}))

interface SavedFile {
  filename: string
  subfolder?: string
  type?: 'input' | 'output' | 'temp'
}

function renderPreview(
  text: string,
  opts: { markdown?: boolean; file?: SavedFile } = {}
) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const canvasStore = useCanvasStore()
  canvasStore.canvas = fromPartial({ graph: { rootGraph: { id: GRAPH_ID } } })

  if (opts.markdown !== undefined) {
    useWidgetValueStore().registerWidget<boolean>(
      widgetId(GRAPH_ID, NODE_ID, 'preview_mode'),
      fromPartial({ type: 'boolean', value: opts.markdown, options: {} })
    )
  }

  if (opts.file) {
    useNodeOutputStore().nodeOutputs[LOCATOR] = fromPartial<
      NodeOutputWith<{ files?: ResultItem[] }>
    >({ files: [opts.file] })
  }

  return render(WidgetTextPreview, {
    props: {
      widget: fromPartial<SimplifiedWidget<string>>({
        name: 'preview_text',
        type: 'textPreview',
        options: {}
      }),
      nodeId: NODE_ID,
      modelValue: text
    },
    global: { plugins: [pinia], mocks: { $t: (key: string) => key } }
  })
}

describe('WidgetTextPreview', () => {
  beforeEach(() => {
    downloadFileMock.mockClear()
    copyMock.mockClear()
  })

  it('renders plaintext in a textarea by default', () => {
    renderPreview('# not rendered')

    expect(screen.getByRole('textbox')).toHaveValue('# not rendered')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders rich markdown when preview_mode is on', () => {
    renderPreview('# Title', { markdown: true })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('copies the raw text when the copy button is clicked', async () => {
    renderPreview('hello world')

    await userEvent.click(
      screen.getByRole('button', { name: 'g.copyToClipboard' })
    )

    expect(copyMock).toHaveBeenCalledWith('hello world')
  })

  it('has no download button without a saved file output', () => {
    renderPreview('hello')

    expect(
      screen.queryByRole('button', { name: 'g.download' })
    ).not.toBeInTheDocument()
  })

  it('downloads the saved file via the /view url when clicked', async () => {
    renderPreview('hello', {
      file: { filename: 'result_00001.txt', subfolder: 'sub', type: 'output' }
    })

    await userEvent.click(screen.getByRole('button', { name: 'g.download' }))

    expect(downloadFileMock).toHaveBeenCalledTimes(1)
    const [url, filename] = downloadFileMock.mock.calls[0]
    expect(url).toContain('/view?')
    expect(url).toContain('filename=result_00001.txt')
    expect(url).toContain('subfolder=sub')
    expect(url).toContain('type=output')
    expect(filename).toBe('result_00001.txt')
  })
})
