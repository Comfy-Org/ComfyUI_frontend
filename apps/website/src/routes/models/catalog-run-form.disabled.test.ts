// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import {
  isWorkshopModelDisabled,
  workshopModelAvailability
} from '@/config/workshop-model-availability'

vi.mock(import('@/config/workshop-model-availability'), { spy: true })

describe('static Run form fallback for a disabled Workshop workflow', () => {
  it('shows no Run form when the availability switch disables the slug', async () => {
    vi.mocked(isWorkshopModelDisabled).mockImplementation(
      (slug) =>
        slug === 'workflows/change-material' ||
        workshopModelAvailability.get(slug)?.disabled === true
    )
    const { RUN_FOOTER, STATIC_SLUG, loadPage, workflowRecord } =
      await import('./catalog-run-form-fixture')
    const { html } = await loadPage(workflowRecord(STATIC_SLUG))
    expect(html).not.toContain(RUN_FOOTER)
  })
})
