import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateTemplate,
  getAllWidgetValues,
  getWidgetValue,
  initializeLinearMode,
  loadTemplate,
  setWidgetValue,
  updateWidgetValue
} from '@/renderer/extensions/linearMode/linearModeService'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { PromotedWidget } from '@/renderer/extensions/linearMode/linearModeTypes'

const mockTemplate = {
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
  ]
}

let mockWorkflow: Partial<ComfyWorkflowJSON> = {
  nodes: [
    {
      id: 6,
      widgets_values: { text: 'test prompt' }
    } as unknown as ComfyWorkflowJSON['nodes'][0],
    {
      id: 3,
      widgets_values: { seed: 12345, steps: 20 }
    } as unknown as ComfyWorkflowJSON['nodes'][0],
    {
      id: 5,
      widgets_values: { width: 1024 }
    } as unknown as ComfyWorkflowJSON['nodes'][0]
  ]
}

vi.mock('@/scripts/api', () => ({
  api: {
    fileURL: vi.fn((path: string) => `http://localhost:8188${path}`)
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: vi.fn()
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    activeWorkflow: {
      get activeState() {
        return mockWorkflow
      }
    }
  }))
}))

vi.mock('@/renderer/extensions/linearMode/stores/linearModeStore', () => ({
  useLinearModeStore: vi.fn(() => ({
    template: mockTemplate,
    promotedWidgets: mockTemplate.promotedWidgets,
    open: vi.fn()
  }))
}))

describe('linearModeService', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset mockWorkflow for each test
    mockWorkflow = {
      nodes: [
        {
          id: 6,
          widgets_values: { text: 'test prompt' }
        } as unknown as ComfyWorkflowJSON['nodes'][0],
        {
          id: 3,
          widgets_values: { seed: 12345, steps: 20 }
        } as unknown as ComfyWorkflowJSON['nodes'][0],
        {
          id: 5,
          widgets_values: { width: 1024 }
        } as unknown as ComfyWorkflowJSON['nodes'][0]
      ]
    }

    // Reset the mock to use the fresh mockWorkflow
    const { useWorkflowStore } = await import(
      '@/platform/workflow/management/stores/workflowStore'
    )
    vi.mocked(useWorkflowStore).mockReturnValue({
      activeWorkflow: {
        get activeState() {
          return mockWorkflow
        }
      }
    } as unknown as ReturnType<typeof useWorkflowStore>)
  })

  describe('loadTemplate()', () => {
    it('should load template from backend', async () => {
      const mockTemplateData = { nodes: [{ id: 1 }] }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTemplateData
      })

      const result = await loadTemplate('/templates/test.json')

      expect(result).toEqual(mockTemplateData)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8188/templates/test.json'
      )
    })

    it('should throw error when template load fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      })

      await expect(loadTemplate('/templates/missing.json')).rejects.toThrow(
        'Failed to load template: Not Found'
      )
    })
  })

  describe('getWidgetValue()', () => {
    it('should get widget value from workflow', () => {
      const value = getWidgetValue(
        mockWorkflow as unknown as ComfyWorkflowJSON,
        6,
        'text'
      )

      expect(value).toBe('test prompt')
    })

    it('should return undefined for non-existent node', () => {
      const value = getWidgetValue(
        mockWorkflow as unknown as ComfyWorkflowJSON,
        999,
        'text'
      )

      expect(value).toBeUndefined()
    })

    it('should return undefined for non-existent widget', () => {
      const value = getWidgetValue(
        mockWorkflow as unknown as ComfyWorkflowJSON,
        6,
        'nonexistent'
      )

      expect(value).toBeUndefined()
    })

    it('should handle numeric node IDs', () => {
      const value = getWidgetValue(
        mockWorkflow as unknown as ComfyWorkflowJSON,
        3,
        'seed'
      )

      expect(value).toBe(12345)
    })
  })

  describe('setWidgetValue()', () => {
    it('should set widget value in workflow', () => {
      const workflow = JSON.parse(
        JSON.stringify(mockWorkflow)
      ) as typeof mockWorkflow

      const result = setWidgetValue(
        workflow as unknown as ComfyWorkflowJSON,
        6,
        'text',
        'new prompt'
      )

      expect(result).toBe(true)
      const node = workflow.nodes?.[0]
      if (node?.widgets_values && !Array.isArray(node.widgets_values)) {
        expect(node.widgets_values.text).toBe('new prompt')
      }
    })

    it('should return false for non-existent node', () => {
      const workflow = JSON.parse(
        JSON.stringify(mockWorkflow)
      ) as typeof mockWorkflow

      const result = setWidgetValue(
        workflow as unknown as ComfyWorkflowJSON,
        999,
        'text',
        'value'
      )

      expect(result).toBe(false)
    })

    it('should create widgets_values object if missing', () => {
      const workflow: Partial<ComfyWorkflowJSON> = {
        nodes: [{ id: 10 } as unknown as ComfyWorkflowJSON['nodes'][0]]
      }

      const result = setWidgetValue(
        workflow as unknown as ComfyWorkflowJSON,
        10,
        'newWidget',
        'value'
      )

      expect(result).toBe(true)
      const node = workflow.nodes?.[0]
      if (node?.widgets_values && !Array.isArray(node.widgets_values)) {
        expect(node.widgets_values).toEqual({ newWidget: 'value' })
      }
    })

    it('should handle numeric values', () => {
      const workflow = JSON.parse(
        JSON.stringify(mockWorkflow)
      ) as typeof mockWorkflow

      const result = setWidgetValue(
        workflow as unknown as ComfyWorkflowJSON,
        3,
        'seed',
        99999
      )

      expect(result).toBe(true)
      const node = workflow.nodes?.[1]
      if (node?.widgets_values && !Array.isArray(node.widgets_values)) {
        expect(node.widgets_values.seed).toBe(99999)
      }
    })
  })

  describe('getAllWidgetValues()', () => {
    it('should return all promoted widget values', () => {
      const values = getAllWidgetValues()

      expect(values.size).toBe(2)
      expect(values.get('Prompt')).toBe('test prompt')
      expect(values.get('Seed')).toBe(12345)
    })

    it('should return empty map when no workflow', async () => {
      const { useWorkflowStore } = await import(
        '@/platform/workflow/management/stores/workflowStore'
      )
      vi.mocked(useWorkflowStore).mockReturnValue({
        activeWorkflow: null
      } as unknown as ReturnType<typeof useWorkflowStore>)

      const values = getAllWidgetValues()

      expect(values.size).toBe(0)
    })

    it('should handle missing widget values gracefully', async () => {
      const workflowMissingValues: Partial<ComfyWorkflowJSON> = {
        nodes: [{ id: 999 } as unknown as ComfyWorkflowJSON['nodes'][0]]
      }
      const { useWorkflowStore } = await import(
        '@/platform/workflow/management/stores/workflowStore'
      )
      vi.mocked(useWorkflowStore).mockReturnValue({
        activeWorkflow: { activeState: workflowMissingValues }
      } as unknown as ReturnType<typeof useWorkflowStore>)

      const values = getAllWidgetValues()

      expect(values.get('Prompt')).toBeUndefined()
      expect(values.get('Seed')).toBeUndefined()
    })
  })

  describe('updateWidgetValue()', () => {
    it('should update widget value in current workflow', () => {
      const widget: PromotedWidget = {
        nodeId: 6,
        widgetName: 'text',
        displayName: 'Prompt',
        type: 'text',
        config: {}
      }

      const result = updateWidgetValue(widget, 'updated prompt')

      expect(result).toBe(true)
      const node = mockWorkflow.nodes?.[0]
      if (node?.widgets_values && !Array.isArray(node.widgets_values)) {
        expect(node.widgets_values.text).toBe('updated prompt')
      }
    })

    it('should return false when no workflow loaded', async () => {
      const { useWorkflowStore } = await import(
        '@/platform/workflow/management/stores/workflowStore'
      )
      vi.mocked(useWorkflowStore).mockReturnValue({
        activeWorkflow: null
      } as unknown as ReturnType<typeof useWorkflowStore>)

      const widget: PromotedWidget = {
        nodeId: 6,
        widgetName: 'text',
        displayName: 'Prompt',
        type: 'text',
        config: {}
      }

      const result = updateWidgetValue(widget, 'new value')

      expect(result).toBe(false)
    })
  })

  describe('activateTemplate()', () => {
    it('should load and activate template', async () => {
      const mockTemplateData = { nodes: [{ id: 1 }] }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTemplateData
      })

      const { app } = await import('@/scripts/app')

      await activateTemplate('template-default-linear')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8188/templates/template-default-linear.json'
      )
      expect(app.loadGraphData).toHaveBeenCalledWith(mockTemplateData)
    })

    it('should throw error when template not found in store', async () => {
      const { useLinearModeStore } = await import(
        '@/renderer/extensions/linearMode/stores/linearModeStore'
      )
      vi.mocked(useLinearModeStore).mockReturnValue({
        template: null,
        promotedWidgets: [],
        open: vi.fn()
      } as unknown as ReturnType<typeof useLinearModeStore>)

      await expect(activateTemplate('template-default-linear')).rejects.toThrow(
        'Template not found: template-default-linear'
      )
    })

    it('should throw error when template ID mismatch', async () => {
      const { useLinearModeStore } = await import(
        '@/renderer/extensions/linearMode/stores/linearModeStore'
      )
      vi.mocked(useLinearModeStore).mockReturnValue({
        template: { ...mockTemplate, id: 'different-template' },
        promotedWidgets: [],
        open: vi.fn()
      } as unknown as ReturnType<typeof useLinearModeStore>)

      await expect(activateTemplate('template-default-linear')).rejects.toThrow(
        'Template not found: template-default-linear'
      )
    })
  })

  describe('initializeLinearMode()', () => {
    it('should open Linear Mode and activate template', async () => {
      const mockTemplateData = { nodes: [{ id: 1 }] }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTemplateData
      })

      const { useLinearModeStore } = await import(
        '@/renderer/extensions/linearMode/stores/linearModeStore'
      )
      const { app } = await import('@/scripts/app')
      const mockOpen = vi.fn()
      vi.mocked(useLinearModeStore).mockReturnValue({
        template: mockTemplate,
        promotedWidgets: mockTemplate.promotedWidgets,
        open: mockOpen
      } as unknown as ReturnType<typeof useLinearModeStore>)

      await initializeLinearMode('template-default-linear')

      expect(mockOpen).toHaveBeenCalledWith('template-default-linear')
      expect(app.loadGraphData).toHaveBeenCalledWith(mockTemplateData)
    })
  })
})
