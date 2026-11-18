import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import CloudErrorAction from '@/platform/openOnCloud/components/CloudErrorAction.vue'
import { useDialogStore } from '@/stores/dialogStore'
import { testI18n } from '@/utils/__tests__/testI18n'

vi.mock(import('@/composables/useFeatureFlags'))

await import('@/platform/openOnCloud/components/DeploySetupCard.vue')

describe('Cloud deployment from an out-of-memory error', () => {
  it('opens the deployment dialog from the memory-error action', async () => {
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
    render(CloudErrorAction, {
      props: { catalogId: 'out_of_memory' },
      global: { plugins: [testI18n] }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Deploy your setup to Comfy Cloud' })
    )

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
  })

  it.for([
    { catalogId: 'out_of_memory', enabled: false },
    { catalogId: 'image_not_loaded', enabled: true }
  ])('does not offer deployment for $catalogId with gate $enabled', (row) => {
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = row.enabled
    render(CloudErrorAction, {
      props: { catalogId: row.catalogId },
      global: { plugins: [testI18n] }
    })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
