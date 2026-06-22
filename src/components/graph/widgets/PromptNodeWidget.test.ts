import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PromptNodeWidget from '@/components/graph/widgets/PromptNodeWidget.vue'
import { fetchPrompts } from '@/platform/prompts/services/promptService'
import type {
  Prompt,
  PromptTemplate
} from '@/platform/prompts/schemas/promptTypes'

vi.mock('@/platform/prompts/services/promptService', () => ({
  fetchPrompts: vi.fn().mockResolvedValue([]),
  createPrompt: vi.fn()
}))

const g = vi.hoisted(() => {
  const graph = {
    links: {} as Record<number, { origin_id: string }>,
    nodes: {} as Record<string, { id: string; title?: string }>,
    getNodeById(id: string) {
      return graph.nodes[id]
    }
  }
  const promptNode = { id: '1', inputs: [] as { link: number | null }[], graph }
  graph.nodes['1'] = promptNode as { id: string; title?: string }
  return { graph, promptNode }
})

function connectSources(titles: string[]) {
  g.promptNode.inputs = titles.map((_, i) => ({ link: i + 1 }))
  titles.forEach((title, i) => {
    g.graph.links[i + 1] = { origin_id: `src${i}` }
    g.graph.nodes[`src${i}`] = { id: `src${i}`, title }
  })
}

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: { graph: g.graph } })
}))

const mockedFetch = vi.mocked(fetchPrompts)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { save: 'Save' },
      promptNode: {
        searchPlaceholder: 'Search prompts',
        saveAsPrompt: 'Save as prompt',
        namePlaceholder: 'Prompt name',
        editorPlaceholder:
          "Write a prompt, or type {'@'} to reference a saved prompt or connected input",
        noMatches: 'No matches'
      }
    }
  }
})

const SearchAutocompleteStub = defineComponent({
  name: 'SearchAutocomplete',
  props: { modelValue: { type: String, default: '' } },
  emits: ['select', 'update:modelValue'],
  template: '<div />'
})

const ButtonStub = defineComponent({
  name: 'Button',
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
})

interface MountOptions {
  template?: PromptTemplate
  connected?: string[]
}

function renderWidget({ template = [], connected = [] }: MountOptions = {}) {
  connectSources(connected)
  return render(PromptNodeWidget, {
    props: { modelValue: template, nodeId: '1' },
    global: {
      plugins: [i18n],
      stubs: {
        SearchAutocomplete: SearchAutocompleteStub,
        Button: ButtonStub
      }
    }
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockedFetch.mockResolvedValue([])
  g.promptNode.inputs = []
  for (const key of Object.keys(g.graph.links))
    delete g.graph.links[Number(key)]
  for (const key of Object.keys(g.graph.nodes)) {
    if (key !== '1') delete g.graph.nodes[key]
  }
})

describe('PromptNodeWidget', () => {
  it('renders a stored prompt reference as a chip', async () => {
    renderWidget({
      template: [
        { type: 'text', value: 'a portrait in ' },
        { type: 'asset', id: 'p1', name: 'style' }
      ]
    })
    expect(await screen.findByText('@style')).toBeInTheDocument()
  })

  it('clears a chip error once its referenced prompt loads', async () => {
    const prompt: Prompt = {
      id: 'p1',
      name: 'style',
      template: [{ type: 'text', value: 'anime' }]
    }
    mockedFetch.mockResolvedValue([prompt])

    renderWidget({ template: [{ type: 'asset', id: 'p1', name: 'style' }] })

    const chip = screen.getByText('@style')
    expect(chip).toHaveClass('text-danger')
    await waitFor(() => expect(chip).not.toHaveClass('text-danger'))
  })

  it('marks a variable chip unresolved when no matching node is connected', () => {
    renderWidget({
      template: [{ type: 'var', name: 'setting' }],
      connected: []
    })
    expect(screen.getByText('@setting')).toHaveClass('text-danger')
  })

  it('offers a connected node title as a variable and resolves it', () => {
    renderWidget({
      template: [{ type: 'var', name: 'setting' }],
      connected: ['setting']
    })
    expect(screen.getByText('@setting')).not.toHaveClass('text-danger')
  })

  it('shows a placeholder with a literal @ when empty', () => {
    renderWidget()
    // Verifies the `@` in the message is escaped (`{'@'}`) so vue-i18n does not
    // parse it as linked-message syntax and fail to compile.
    expect(screen.getByText(/type @ to reference/)).toBeInTheDocument()
  })

  it('expands a saved-prompt chip into its text on double click', async () => {
    const prompt: Prompt = {
      id: 'p1',
      name: 'style',
      template: [{ type: 'text', value: 'anime, vibrant colors' }]
    }
    mockedFetch.mockResolvedValue([prompt])
    renderWidget({ template: [{ type: 'asset', id: 'p1', name: 'style' }] })

    const chip = screen.getByText('@style')
    await waitFor(() => expect(chip).not.toHaveClass('text-danger'))

    await userEvent.dblClick(chip)

    expect(screen.queryByText('@style')).toBeNull()
    expect(screen.getByText('anime, vibrant colors')).toBeInTheDocument()
  })
})
