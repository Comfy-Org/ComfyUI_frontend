import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLinearModeStore } from '@/renderer/extensions/linearMode/stores/linearModeStore'
import type { OutputImage } from '@/renderer/extensions/linearMode/linearModeTypes'

vi.mock('@/renderer/extensions/linearMode/linearModeConfig', () => ({
  getTemplateConfig: vi.fn((id: string) => {
    if (id === 'template-default-linear') {
      return {
        id: 'template-default-linear',
        name: 'Linear Mode Template',
        templatePath: '/templates/template-default-linear.json',
        promotedWidgets: [
          {
            nodeId: 6,
            widgetName: 'text',
            displayName: 'Prompt',
            type: 'text',
            config: { multiline: true },
            group: 'content'
          },
          {
            nodeId: 3,
            widgetName: 'seed',
            displayName: 'Seed',
            type: 'number',
            config: { min: 0 },
            group: 'generation'
          }
        ],
        description: 'Default template',
        tags: ['text-to-image']
      }
    }
    return null
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      activeState: {
        nodes: [
          { id: 6, widgets_values: { text: 'test prompt' } },
          { id: 3, widgets_values: { seed: 12345 } }
        ]
      }
    }
  })
}))

interface MockTaskItem {
  promptId: string
  status?: string
}

vi.mock('@/stores/queueStore', () => {
  return {
    useQueueStore: () => ({
      pendingTasks: [
        { promptId: 'prompt-1' },
        { promptId: 'prompt-2' }
      ] as MockTaskItem[],
      historyTasks: [
        { promptId: 'prompt-1', status: 'completed' },
        { promptId: 'prompt-2', status: 'completed' },
        { promptId: 'prompt-3', status: 'completed' }
      ] as MockTaskItem[]
    }),
    TaskItemImpl: class {}
  }
})

describe('useLinearModeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should have correct default state', () => {
      const store = useLinearModeStore()

      expect(store.isOpen).toBe(false)
      expect(store.templateId).toBe(null)
      expect(store.currentOutput).toBe(null)
      expect(store.generatedPromptIds).toBeInstanceOf(Set)
      expect(store.generatedPromptIds.size).toBe(0)
    })
  })

  describe('open()', () => {
    it('should open Linear Mode with valid template', () => {
      const store = useLinearModeStore()

      store.open('template-default-linear')

      expect(store.isOpen).toBe(true)
      expect(store.templateId).toBe('template-default-linear')
    })

    it('should throw error for invalid template ID', () => {
      const store = useLinearModeStore()

      expect(() => store.open('invalid-template')).toThrow(
        'Invalid template ID: invalid-template'
      )
    })

    it('should not affect other state when opening', () => {
      const store = useLinearModeStore()
      store.trackGeneratedPrompt('test-prompt-1')

      store.open('template-default-linear')

      expect(store.generatedPromptIds.has('test-prompt-1')).toBe(true)
    })
  })

  describe('close()', () => {
    it('should close Linear Mode', () => {
      const store = useLinearModeStore()
      store.open('template-default-linear')

      store.close()

      expect(store.isOpen).toBe(false)
    })

    it('should preserve state when closing', () => {
      const store = useLinearModeStore()
      store.open('template-default-linear')
      store.trackGeneratedPrompt('test-prompt')

      store.close()

      expect(store.templateId).toBe('template-default-linear')
      expect(store.generatedPromptIds.has('test-prompt')).toBe(true)
    })
  })

  describe('setOutput()', () => {
    it('should set current output', () => {
      const store = useLinearModeStore()
      const output: OutputImage = {
        filename: 'test.png',
        subfolder: 'output',
        type: 'output',
        prompt_id: 'prompt-123'
      }

      store.setOutput(output)

      expect(store.currentOutput).toEqual(output)
    })

    it('should clear current output when null', () => {
      const store = useLinearModeStore()
      const output: OutputImage = {
        filename: 'test.png',
        subfolder: 'output',
        type: 'output',
        prompt_id: 'prompt-123'
      }
      store.setOutput(output)

      store.setOutput(null)

      expect(store.currentOutput).toBe(null)
    })
  })

  describe('trackGeneratedPrompt()', () => {
    it('should add prompt ID to set', () => {
      const store = useLinearModeStore()

      store.trackGeneratedPrompt('prompt-1')

      expect(store.generatedPromptIds.has('prompt-1')).toBe(true)
      expect(store.generatedPromptIds.size).toBe(1)
    })

    it('should handle multiple prompt IDs', () => {
      const store = useLinearModeStore()

      store.trackGeneratedPrompt('prompt-1')
      store.trackGeneratedPrompt('prompt-2')
      store.trackGeneratedPrompt('prompt-3')

      expect(store.generatedPromptIds.size).toBe(3)
      expect(store.generatedPromptIds.has('prompt-1')).toBe(true)
      expect(store.generatedPromptIds.has('prompt-2')).toBe(true)
      expect(store.generatedPromptIds.has('prompt-3')).toBe(true)
    })

    it('should not duplicate prompt IDs', () => {
      const store = useLinearModeStore()

      store.trackGeneratedPrompt('prompt-1')
      store.trackGeneratedPrompt('prompt-1')

      expect(store.generatedPromptIds.size).toBe(1)
    })
  })

  describe('reset()', () => {
    it('should reset all state', () => {
      const store = useLinearModeStore()
      store.open('template-default-linear')
      store.trackGeneratedPrompt('prompt-1')
      store.setOutput({
        filename: 'test.png',
        subfolder: 'output',
        type: 'output',
        prompt_id: 'prompt-1'
      })

      store.reset()

      expect(store.isOpen).toBe(false)
      expect(store.templateId).toBe(null)
      expect(store.currentOutput).toBe(null)
      expect(store.generatedPromptIds.size).toBe(0)
    })
  })

  describe('template getter', () => {
    it('should return null when no template is selected', () => {
      const store = useLinearModeStore()

      expect(store.template).toBe(null)
    })

    it('should return template config when template is selected', () => {
      const store = useLinearModeStore()
      store.open('template-default-linear')

      expect(store.template).not.toBe(null)
      expect(store.template?.id).toBe('template-default-linear')
      expect(store.template?.name).toBe('Linear Mode Template')
    })
  })

  describe('promotedWidgets getter', () => {
    it('should return empty array when no template selected', () => {
      const store = useLinearModeStore()

      expect(store.promotedWidgets).toEqual([])
    })

    it('should return promoted widgets from template', () => {
      const store = useLinearModeStore()
      store.open('template-default-linear')

      expect(store.promotedWidgets.length).toBe(2)
      expect(store.promotedWidgets[0].displayName).toBe('Prompt')
      expect(store.promotedWidgets[1].displayName).toBe('Seed')
    })
  })

  describe('currentWorkflow getter', () => {
    it('should return workflow from workflowStore', () => {
      const store = useLinearModeStore()

      expect(store.currentWorkflow).not.toBe(null)
      expect(store.currentWorkflow?.nodes).toBeDefined()
    })
  })

  describe('filteredHistory getter', () => {
    it('should return empty array when no prompts tracked', () => {
      const store = useLinearModeStore()

      expect(store.filteredHistory).toEqual([])
    })

    it('should filter history by tracked prompt IDs', () => {
      const store = useLinearModeStore()
      store.trackGeneratedPrompt('prompt-1')
      store.trackGeneratedPrompt('prompt-3')

      const filtered = store.filteredHistory as unknown as MockTaskItem[]

      expect(filtered.length).toBe(2)
      expect(filtered.some((item) => item.promptId === 'prompt-1')).toBe(true)
      expect(filtered.some((item) => item.promptId === 'prompt-3')).toBe(true)
      expect(filtered.some((item) => item.promptId === 'prompt-2')).toBe(false)
    })
  })

  describe('isGenerating getter', () => {
    it('should return false when no prompts are tracked', () => {
      const store = useLinearModeStore()

      expect(store.isGenerating).toBe(false)
    })

    it('should return true when tracked prompt is in queue', () => {
      const store = useLinearModeStore()
      store.trackGeneratedPrompt('prompt-1')

      expect(store.isGenerating).toBe(true)
    })

    it('should return false when tracked prompt is not in queue', () => {
      const store = useLinearModeStore()
      store.trackGeneratedPrompt('prompt-999')

      expect(store.isGenerating).toBe(false)
    })
  })
})
