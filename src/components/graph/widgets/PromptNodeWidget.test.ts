import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick, shallowReactive } from 'vue'
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
  const promptNode = {
    id: '1',
    inputs: [] as { name?: string; link: number | null }[],
    syncVariableInputs: vi.fn()
  }
  const graph = {
    getNodeById: (id: string) => (id === '1' ? promptNode : undefined)
  }
  return { graph, promptNode }
})

// Mirror the real node manager, which exposes node.inputs as a reactive array,
// so the widget's connection watcher fires when sockets change.
g.promptNode.inputs = shallowReactive(g.promptNode.inputs)

/** Sets the node's connected variable input sockets by name (mutates in place). */
function connectSockets(names: string[]) {
  g.promptNode.inputs.splice(
    0,
    g.promptNode.inputs.length,
    ...names.map((name, i) => ({ name, link: i + 1 }))
  )
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
        noMatches: 'No matches',
        createVariable: 'Create variable: {name}'
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
  connectSockets(connected)
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
  g.promptNode.inputs.splice(0, g.promptNode.inputs.length)
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
    expect(chip).toHaveClass('bg-destructive-background')
    await waitFor(() => expect(chip).toHaveClass('bg-primary-background'))
    expect(chip).not.toHaveClass('bg-destructive-background')
  })

  it('marks a variable chip unresolved when no socket with that name is connected', () => {
    renderWidget({
      template: [{ type: 'var', name: 'setting' }],
      connected: []
    })
    expect(screen.getByText('@setting')).toHaveClass(
      'bg-destructive-background'
    )
  })

  it('resolves a variable chip when a socket with that name is connected', () => {
    renderWidget({
      template: [{ type: 'var', name: 'setting' }],
      connected: ['setting']
    })
    expect(screen.getByText('@setting')).toHaveClass('bg-primary-background')
  })

  it('turns a variable chip blue when its socket becomes connected', async () => {
    renderWidget({ template: [{ type: 'var', name: 'animal' }] })
    const chip = screen.getByText('@animal')
    expect(chip).toHaveClass('bg-destructive-background')

    g.promptNode.inputs.push({ name: 'animal', link: 1 })
    await nextTick()

    expect(chip).toHaveClass('bg-primary-background')
    expect(chip).not.toHaveClass('bg-destructive-background')
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
    await waitFor(() => expect(chip).toHaveClass('bg-primary-background'))

    await userEvent.dblClick(chip)

    expect(screen.queryByText('@style')).toBeNull()
    expect(screen.getByText('anime, vibrant colors')).toBeInTheDocument()
  })
})
