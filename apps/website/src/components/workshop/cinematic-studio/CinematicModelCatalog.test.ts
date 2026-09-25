import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  generationTimingNamespaceKey,
  recordGenerationTiming
} from '../../../lib/workshop/cinematic-studio/generation-timings'
import CinematicModelCatalog from './CinematicModelCatalog.vue'
import type { CinematicCatalogEntry } from '../../../lib/workshop/cinematic-studio/model-catalog'

describe('model capability timing evidence', () => {
  it('shows median and sample range, then clears another workspace’s observations', async () => {
    const namespace = ref('catalog-timing-workspace-one')
    for (const [index, elapsedMs] of [1000, 2000, 9000].entries()) {
      recordGenerationTiming(namespace.value, 'sample-model', {
        id: `catalog-${index}`,
        elapsedMs
      })
    }
    const user = userEvent.setup()
    const props = {
      open: true,
      selectable: [],
      entries: [
        {
          slug: 'sample-model',
          name: 'Sample model',
          provider: 'Provider',
          routerId: 'provider/model',
          modality: 'video',
          href: '/models/sample-model/',
          runnable: true,
          capabilities: [{ kind: 'duration', values: ['5', '10'] }]
        }
      ] satisfies CinematicCatalogEntry[]
    }
    render(CinematicModelCatalog, {
      props,
      global: {
        provide: { [generationTimingNamespaceKey as symbol]: namespace }
      }
    })
    await user.click(await screen.findByText('Capabilities & generation time'))
    expect(
      await screen.findByText(/Typical observed time \(median\): 2 sec/)
    ).toBeVisible()
    expect(screen.getByText(/1 sec – 9 sec · 3 successful runs/)).toBeVisible()
    expect(screen.getByText('Clip length (seconds)')).toBeVisible()
    namespace.value = 'catalog-timing-workspace-two'
    expect(await screen.findByText('Not measured yet')).toBeVisible()
    expect(screen.queryByText(/Typical observed time/)).not.toBeInTheDocument()
  })
})
