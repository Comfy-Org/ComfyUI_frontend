// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import {
  isWorkshopModelDisabled,
  workshopModelAvailability
} from '@/config/workshop-model-availability'

vi.mock(import('@/config/workshop-model-availability'), { spy: true })
vi.mocked(isWorkshopModelDisabled).mockImplementation(
  (slug) =>
    slug === 'workflows/change-material' ||
    workshopModelAvailability.get(slug)?.disabled === true
)
// Static pages read the switch at load: import them after the mock.
const { RUN_FOOTER, STATIC_SLUG, loadPage, workflowRecord } =
  await import('./catalog-run-form-fixture')

describe('static Run form fallback for a disabled Workshop workflow', () => {
  it('shows no Run form when the availability switch disables the slug', async () => {
    const { html } = await loadPage(workflowRecord(STATIC_SLUG))
    expect(html).toContain('Catalog workflow')
    expect(html).not.toContain(RUN_FOOTER)
  })
})
