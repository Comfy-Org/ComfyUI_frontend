import { respondToFetch } from '@comfyorg/test-utils/fetch'
import userEvent from '@testing-library/user-event'
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

describe('Draft change ID chip', () => {
  it.for(['new', 'updated', 'removed'] as const)(
    'shows the batch on %s changes without changing selection',
    async (change) => {
      const user = userEvent.setup()
      const view = render(QueueRow, {
        props: {
          item: item({ changeID: 'workfl_1016', change }),
          active: false,
          selectable: true,
          selected: true
        }
      })
      const chip = screen.getByLabelText('Change ID: workfl_1016')
      expect(chip).toHaveTextContent('workfl_1016')
      expect(chip).toHaveAttribute('title', 'Change ID: workfl_1016')
      expect(chip.tagName).toBe('SPAN')
      await user.click(chip)
      expect(screen.getByRole('checkbox')).toBeChecked()
      expect(view.emitted('select')).toBeUndefined()
      expect(view.emitted('discard')).toBeUndefined()
    }
  )

  it.for([undefined, '', '   '])('hides an empty batch (%s)', (changeID) => {
    render(QueueRow, {
      props: { item: item({ changeID }), active: false }
    })
    expect(screen.queryByLabelText(/^Change ID:/)).toBeNull()
  })

  it('updates the chip when the same row receives a new exact save', async () => {
    const view = render(QueueRow, {
      props: { item: item({ changeID: 'workfl_1016' }), active: false }
    })
    await view.rerender({ item: item({ changeID: 'workfl_1017' }) })
    expect(screen.queryByLabelText('Change ID: workfl_1016')).toBeNull()
    expect(screen.getByLabelText('Change ID: workfl_1017')).toBeVisible()
  })

  it('localizes the label and keeps a long batch bounded', () => {
    const changeID = 'w'.repeat(128)
    render(QueueRow, {
      props: { item: item({ changeID }), active: false, locale: 'zh-CN' }
    })
    const chip = screen.getByLabelText(`更改 ID：${changeID}`)
    expect(chip).toHaveTextContent(changeID)
    expect(chip).toHaveClass('max-w-full', 'truncate')
  })

  it('renders a label as text rather than interpreting markup', () => {
    const changeID = '<img src=x onerror=alert(1)>'
    render(QueueRow, {
      props: { item: item({ changeID }), active: false }
    })
    expect(screen.getByLabelText(`Change ID: ${changeID}`)).toHaveTextContent(
      changeID
    )
    expect(screen.queryByRole('img')).toBeNull()
  })
})

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
