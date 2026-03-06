import { describe, expect, it, vi } from 'vitest'

import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { ChangeTracker } from './changeTracker'

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    activeWorkflow: null
  })),
  ComfyWorkflow: vi.fn()
}))

vi.mock('./api', () => ({
  api: {
    addEventListener: vi.fn(),
    apiURL: vi.fn((path: string) => path)
  }
}))

vi.mock('./app', () => ({
  app: {
    ui: { autoQueueEnabled: false, autoQueueMode: 'instant' },
    canvas: { ds: { scale: 1, offset: [0, 0] } },
    constructor: { maskeditor_is_opended: undefined }
  },
  ComfyApp: vi.fn()
}))

describe('ChangeTracker.init', () => {
  it('forwards multiline argument to original prompt', () => {
    const originalPrompt = vi.fn()
    LGraphCanvas.prototype.prompt = originalPrompt

    ChangeTracker.init()

    const wrappedPrompt = LGraphCanvas.prototype.prompt
    expect(wrappedPrompt).not.toBe(originalPrompt)

    const mockCallback = vi.fn()
    const mockEvent = {} as CanvasPointerEvent
    const multilineValue = true

    wrappedPrompt.call(
      {} as LGraphCanvas,
      'Title',
      'value',
      mockCallback,
      mockEvent,
      multilineValue
    )

    expect(originalPrompt).toHaveBeenCalledWith(
      'Title',
      'value',
      expect.any(Function),
      mockEvent,
      true
    )
  })
})
