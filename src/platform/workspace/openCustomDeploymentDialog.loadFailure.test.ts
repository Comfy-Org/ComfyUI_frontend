import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useDialogStore } from '@/stores/dialogStore'

import {
  openDeployCustomNodesDialog,
  openWorkflowNeedsDeploymentDialog,
  preloadWorkflowNeedsDeploymentDialog
} from './openCustomDeploymentDialog'

vi.mock(
  import('@/platform/workspace/components/CustomDeploymentCard.vue'),
  () => {
    throw new Error('Failed to fetch dynamically imported module')
  }
)

vi.mock(
  import('@/platform/workspace/components/WorkflowNeedsDeploymentCard.vue'),
  () => ({ default: undefined })
)

describe('a custom deployment dialog that fails to load', () => {
  it.for([
    {
      load: 'rejects',
      open: openDeployCustomNodesDialog,
      key: 'global-deploy-custom-nodes'
    },
    {
      load: 'resolves without a component',
      open: openWorkflowNeedsDeploymentDialog,
      key: 'global-workflow-needs-deployment'
    }
  ])(
    'reports it, and opens nothing, when its code $load',
    async ({ open, key }) => {
      await expect(open()).resolves.toBe(false)

      expect(
        useDialogStore().dialogStack.some((entry) => entry.key === key)
      ).toBe(false)
      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'error' })
      ])
    }
  )

  it('preloads nothing when the deployment dialog code resolves without a component', async () => {
    await expect(preloadWorkflowNeedsDeploymentDialog()).resolves.toBe(false)
  })
})
