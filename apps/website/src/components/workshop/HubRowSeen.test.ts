import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureWorkshopEvent } from '@/scripts/posthog'
import {
  FakeIntersectionObserver,
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import HubRowSeen from './HubRowSeen.vue'

vi.mock(import('@/scripts/posthog'))

const view = {
  surface: 'apps',
  source: 'app_row',
  rowSlugs: ['studio', 'reshoot']
} as const

beforeEach(() => {
  stubIntersectionObserver()
})

describe('HubRowSeen', () => {
  it('watches the row it sits in, not itself', async () => {
    const { container } = render(HubRowSeen, {
      props: { view: { ...view, rowSlugs: [...view.rowSlugs] } }
    })

    await setAllIntersecting(false)

    expect(FakeIntersectionObserver.instances[0].observed).toEqual([container])
  })

  it('reports the row once it scrolls into view, and only once', async () => {
    render(HubRowSeen, {
      props: { view: { ...view, rowSlugs: [...view.rowSlugs] } }
    })

    await setAllIntersecting(false)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()

    await setAllIntersecting(true)
    await setAllIntersecting(true)
    expect(captureWorkshopEvent).toHaveBeenCalledOnce()
    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'hub_row_viewed',
      properties: {
        surface: 'apps',
        source: 'app_row',
        item_count: 2,
        row_slugs: ['studio', 'reshoot']
      }
    })
  })
})
