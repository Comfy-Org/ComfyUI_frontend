import { render, screen, waitFor } from '@testing-library/vue'
import { shallowReactive } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PromptNodeWidget from '@/components/graph/widgets/PromptNodeWidget.vue'
import type { PromptTemplate } from '@/platform/prompts/promptTypes'

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      promptNode: {
        editorPlaceholder:
          "Write a prompt, or type {'@'} to reference a connected input",
        noMatches: 'No matches',
        createVariable: 'Create variable: {name}'
      }
    }
  }
})

interface MountOptions {
  template?: PromptTemplate
  connected?: string[]
}

function renderWidget({ template = [], connected = [] }: MountOptions = {}) {
  connectSockets(connected)
  return render(PromptNodeWidget, {
    props: { modelValue: template, nodeId: '1' },
    global: { plugins: [i18n] }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  g.promptNode.inputs.splice(0, g.promptNode.inputs.length)
})

describe('PromptNodeWidget', () => {
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

    await waitFor(() => expect(chip).toHaveClass('bg-primary-background'))
    expect(chip).not.toHaveClass('bg-destructive-background')
  })

  it('mirrors the declared variables onto the node as input sockets', () => {
    renderWidget({
      template: [
        { type: 'text', value: 'a ' },
        { type: 'var', name: 'animal' },
        { type: 'var', name: 'setting' }
      ]
    })
    expect(g.promptNode.syncVariableInputs).toHaveBeenCalledWith([
      'animal',
      'setting'
    ])
  })

  it('shows a placeholder with a literal @ when empty', () => {
    renderWidget()
    // Verifies the `@` in the message is escaped (`{'@'}`) so vue-i18n does not
    // parse it as linked-message syntax and fail to compile.
    expect(screen.getByText(/type @ to reference/)).toBeInTheDocument()
  })
})
