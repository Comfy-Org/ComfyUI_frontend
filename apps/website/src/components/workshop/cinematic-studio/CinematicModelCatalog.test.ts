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
    expect((await screen.findAllByText('5s / 10s'))[0]).toBeVisible()
    expect(screen.getByText('Studio starting point: 5s')).toBeVisible()
    expect(screen.getByText(/not a provider recommendation/)).toBeVisible()
    await user.click(
      await screen.findByText('More capabilities & generation wait time')
    )
    expect(screen.getByText('Generation wait time')).toBeVisible()
    expect(
      await screen.findByText(/Typical observed time \(median\): 2 sec/)
    ).toBeVisible()
    expect(screen.getByText(/1 sec – 9 sec · 3 successful runs/)).toBeVisible()
    expect(screen.getByText('Clip length (seconds)')).toBeVisible()
    namespace.value = 'catalog-timing-workspace-two'
    expect(await screen.findByText('Not measured yet')).toBeVisible()
    expect(screen.queryByText(/Typical observed time/)).not.toBeInTheDocument()
  })
  it('keeps unspecified native clip lengths honest and provides their model controls', async () => {
    const props = {
      open: true,
      selectable: [],
      entries: [
        {
          slug: 'native-video',
          name: 'Native video',
          provider: 'Provider',
          routerId: 'provider/native',
          modality: 'video',
          href: '/models/native-video/',
          runnable: true,
          capabilities: []
        }
      ] satisfies CinematicCatalogEntry[]
    }
    render(CinematicModelCatalog, { props })
    expect(
      await screen.findByText('Not specified here — check model page controls')
    ).toBeVisible()
    expect(screen.queryByText(/Studio starting point:/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Open model page/ })
    ).toHaveAttribute('href', '/models/native-video/')
  })
})
