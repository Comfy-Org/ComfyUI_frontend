import { describe, expect, it, vi } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

const { state } = vi.hoisted(() => ({
  state: {
    extension: null as { nodeCreated: (node: unknown) => void } | null
  }
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: { nodeCreated: (node: unknown) => void }) => {
      state.extension = ext
    }
  })
}))

// Resolve keys against the real locale file so a missing key fails the test.
vi.mock('@/i18n', async () => {
  const messages = (await import('@/locales/en/main.json')).default
  return {
    t: (key: string) => {
      const value = key
        .split('.')
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          messages
        )
      if (typeof value !== 'string') {
        throw new Error(`Missing i18n key: ${key}`)
      }
      return value
    }
  }
})

await import('./publishToWorkspace')

interface MockWidget {
  type: string
  name: string
  value: unknown
  options: Record<string, unknown>
  label?: string
  serialize: boolean
}

function makeNode(comfyClass: string) {
  const widgets: MockWidget[] = []
  return {
    constructor: { comfyClass },
    widgets,
    addWidget: vi.fn(
      (
        type: string,
        name: string,
        value: unknown,
        _callback: (...args: unknown[]) => unknown,
        options: Record<string, unknown>
      ) => {
        const widget: MockWidget = {
          type,
          name,
          value,
          options,
          serialize: true
        }
        widgets.push(widget)
        return widget
      }
    )
  }
}

function createNode(comfyClass = 'SaveImage') {
  const node = makeNode(comfyClass)
  state.extension!.nodeCreated(node)
  return { node, widget: node.widgets[0] }
}

describe('Comfy.PublishToWorkspace extension', () => {
  it('adds an off-by-default toggle to media save nodes', () => {
    const { widget } = createNode()
    expect(widget.type).toBe('toggle')
    expect(widget.name).toBe('publish_to_workspace')
    expect(widget.value).toBe(false)
    expect(widget.label).toBe(enMessages.publishToWorkspace.widgetLabel)
  })

  it('keeps the flag frontend-only (out of workflow JSON and API prompt)', () => {
    const { widget } = createNode()
    expect(widget.serialize).toBe(false)
    expect(widget.options.serialize).toBe(false)
  })

  it('covers non-image media save nodes', () => {
    for (const type of ['SaveVideo', 'SaveAudio', 'SaveGLB']) {
      const { widget } = createNode(type)
      expect(widget?.name).toBe('publish_to_workspace')
    }
  })

  it('does not touch non-save nodes', () => {
    const node = makeNode('KSampler')
    state.extension!.nodeCreated(node)
    expect(node.addWidget).not.toHaveBeenCalled()
  })
})
