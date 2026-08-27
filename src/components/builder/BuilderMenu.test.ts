import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fromPartial } from '@total-typescript/shoehorn'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import BuilderMenu from './BuilderMenu.vue'

const mockClose = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      id: '11111111-1111-4111-8111-111111111111',
      nodes: [{ id: 1 }],
      extra: {},
      events: new EventTarget(),
      getNodeById: vi.fn(() => null)
    }
  }
}))

vi.mock('@/components/builder/useEmptyWorkflowDialog', () => ({
  useEmptyWorkflowDialog: () => ({ show: vi.fn() })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({ saveWorkflow: vi.fn() })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({ toastErrorHandler: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      builderMenu: {
        enterAppMode: 'Enter app mode',
        exitAppBuilder: 'Exit app builder'
      },
      linearMode: { appModeToolbar: { appBuilder: 'App builder' } },
      g: { save: 'Save' }
    }
  }
})

describe('BuilderMenu', () => {
  beforeEach(() => {
    vi.mocked(app.rootGraph.getNodeById).mockReturnValue(null)
  })

  it('prunes stale selections when entering App Mode from the menu', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    const workflowStore = useWorkflowStore(pinia)
    workflowStore.activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      activeMode: 'builder:arrange'
    })
    const appModeStore = useAppModeStore(pinia)
    appModeStore.selectedInputs = [
      [widgetId(app.rootGraph.id, toNodeId(99), 'prompt'), 'prompt']
    ]
    const user = userEvent.setup()
    render(BuilderMenu, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          Popover: {
            methods: { close: mockClose },
            template: '<div><slot name="button" /><slot :close="close" /></div>'
          }
        }
      }
    })

    await user.click(screen.getByRole('button', { name: 'Enter app mode' }))

    expect(appModeStore.selectedInputs).toEqual([])
    expect(workflowStore.activeWorkflow.activeMode).toBe('app')
    expect(mockClose).toHaveBeenCalledOnce()
  })
})
