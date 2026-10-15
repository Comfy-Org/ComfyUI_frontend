import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CatalogQueueItem } from '@/lib/cms/queue'
import QueueRow from './QueueRow.vue'

const item = (overrides: Partial<CatalogQueueItem>): CatalogQueueItem => ({
  source: 'catalog',
  id: '00000000-0000-4000-8000-000000000010',
  kind: 'WORKFLOW',
  title: 'Review fixture',
  change: 'updated',
  slug: 'review-fixture',
  hidden: false,
  fields: [],
  gaps: [],
  ...overrides
})

const fromCell = () => screen.getByTestId('queue-row-from')

describe('Draft table "From" column', () => {
  it('shows the credited author as their public profile, not their account ID', async () => {
    const uid = 'fPc7irbKt2VLqueueRowAuthor'
    respondToFetch(`/admin/content-api/profiles?q=${uid}`, () =>
      Response.json({
        items: [
          {
            id: uid,
            label: 'Ada Lovelace',
            username: 'ada-lovelace',
            avatar_url: 'https://media.comfy.org/ada.png'
          }
        ]
      })
    )
    render(QueueRow, {
      props: { item: item({ authorUID: uid }), active: false }
    })
    expect(await within(fromCell()).findByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByTestId('author-avatar')).toHaveAttribute(
      'src',
      'https://media.comfy.org/ada.png'
    )
    expect(screen.getByTestId('author-avatar')).toHaveAttribute('alt', '')
    expect(fromCell()).not.toHaveTextContent(uid)
  })

  it('says the author is unavailable rather than showing the raw ID', async () => {
    const uid = 'fPc7irbKt2VLnoProfileRow'
    respondToFetch(`/admin/content-api/profiles?q=${uid}`, () =>
      Response.json({ items: [] })
    )
    render(QueueRow, {
      props: { item: item({ authorUID: uid }), active: false }
    })
    expect(
      await within(fromCell()).findByText('Author unavailable')
    ).toBeTruthy()
    expect(fromCell()).not.toHaveTextContent(uid)
    expect(screen.queryByTestId('author-avatar')).toBeNull()
  })

  it('keeps naming a model by its provider', () => {
    render(QueueRow, {
      props: {
        item: item({
          kind: 'MODEL',
          provider: 'Black Forest Labs',
          authorUID: 'fPc7irbKt2VLmodelAuthor'
        }),
        active: false
      }
    })
    expect(fromCell()).toHaveTextContent('Black Forest Labs')
    expect(screen.queryByTestId('author-name')).toBeNull()
  })
})
