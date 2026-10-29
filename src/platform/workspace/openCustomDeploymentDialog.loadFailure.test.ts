import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useDialogStore } from '@/stores/dialogStore'

import { openDeployCustomNodesDialog } from './openCustomDeploymentDialog'

vi.mock(
  import('@/platform/workspace/components/CustomDeploymentCard.vue'),
  () => {
    throw new Error('Failed to fetch dynamically imported module')
  }
)

describe('a custom deployment dialog that fails to load', () => {
  it('reports it, and opens nothing', async () => {
    await expect(openDeployCustomNodesDialog()).resolves.toBe(false)

    expect(
      useDialogStore().dialogStack.some(
        (entry) => entry.key === 'global-deploy-custom-nodes'
      )
    ).toBe(false)
    expect(useToast().toasts).toEqual([
      expect.objectContaining({ kind: 'error' })
    ])
  })
})
