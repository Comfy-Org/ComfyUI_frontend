import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { toNodeId } from '@/types/nodeId'

import BuilderMenu from './BuilderMenu.vue'

vi.mock(import('@/composables/useAppMode'))
vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraph: { extra: {} } }
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
      g: { save: 'Save' },
      linearMode: { appModeToolbar: { appBuilder: 'App builder' } }
    }
  }
})

describe('BuilderMenu', () => {
  beforeEach(() => {
    useAppModeStore().selectedOutputs = [toNodeId('1')]
    useWorkflowStore().activeWorkflow = fromPartial({ isTemporary: false })
  })

  it('closes only after a successful save', async () => {
    let rejectSave!: (error: Error) => void
    const pendingSave = new Promise<boolean>((_, reject) => {
      rejectSave = reject
    })
    vi.mocked(useWorkflowService().saveWorkflow)
      .mockReturnValueOnce(pendingSave)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(BuilderMenu, { global: { plugins: [i18n] } })

    await user.click(screen.getByRole('button', { name: 'App builder' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Save' }))
    expect(screen.getByRole('menu')).toBeVisible()

    const error = new Error('save failed')
    rejectSave(error)
    await waitFor(() =>
      expect(useErrorHandling().toastErrorHandler).toHaveBeenCalledWith(error)
    )
    expect(screen.getByRole('menu')).toBeVisible()

    await user.click(screen.getByRole('menuitem', { name: 'Save' }))
    expect(screen.getByRole('menu')).toBeVisible()

    await user.click(screen.getByRole('menuitem', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
  })
})
