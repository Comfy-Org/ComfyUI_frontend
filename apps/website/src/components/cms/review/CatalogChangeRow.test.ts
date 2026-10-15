import userEvent from '@testing-library/user-event'
import { render, screen, fireEvent, within } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import CatalogChangeRow from './CatalogChangeRow.vue'

const mediaUID = '00000000-0000-4000-8000-000000000020'
const version = '00000000-0000-4000-8000-000000000021'
const src = `/preview-media/7/${mediaUID}/${version}`
describe('change row previews and record navigation', () => {
  it('shows a small protected thumbnail and a frozen-version record link without editing', () => {
    const item = fixtureReview().items[0]
    assert.exists(item)
    item.presentation = { preview: { kind: 'image', src } }
    render(CatalogChangeRow, { props: { item, draftRev: 7 } })
    expect(
      screen.getByRole('img', { name: 'Preview of Review fixture' })
    ).toHaveAttribute('src', src)
    expect(
      screen.getByRole('link', { name: 'Open Review fixture' })
    ).toHaveAttribute(
      'href',
      `/admin/content/${item.content.uid}/view?rev=7&version=${item.content.revision_uid}`
    )
    expect(
      screen.queryByRole('button', { name: /Edit/ })
    ).not.toBeInTheDocument()
  })
  it('shows real shared-parent names and links in the larger media detail panel', async () => {
    const item = fixtureReview().items[0]
    assert.exists(item)
    item.content.type = 'media'
    item.content.document = {
      name: 'unrelated-name/photo.png',
      mime_type: 'image/png'
    }
    item.presentation = {
      media_name: 'unrelated-name/photo.png',
      preview: { kind: 'image', src },
      uses: [
        {
          uid: mediaUID,
          type: 'workflow',
          title: 'Actual upload page',
          origin: true,
          is_deleted: true
        },
        {
          uid: version,
          type: 'model',
          title: 'Another shared use',
          origin: false
        }
      ]
    }
    render(CatalogChangeRow, { props: { item, draftRev: 7 } })
    expect(
      screen.getByText('Content: Actual upload page, Another shared use')
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: /unrelated-name\/photo.png/ })
    )
    expect(await screen.findByRole('dialog')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Actual upload page' })
    ).toHaveAttribute('href', `/admin/content/${mediaUID}/view`)
    expect(
      screen.getByRole('link', { name: 'Another shared use' })
    ).toHaveAttribute('href', `/admin/content/${version}/view`)
    expect(screen.getByText('Upload source')).toBeVisible()
    expect(screen.getByText('This record is marked deleted.')).toBeVisible()
    expect(
      within(screen.getByRole('dialog')).getByRole('img', {
        name: 'Preview of unrelated-name/photo.png'
      })
    ).toHaveAttribute('src', src)
  })
  it('shows a graceful placeholder rather than an origin URL when bytes are unavailable', async () => {
    const item = fixtureReview().items[0]
    assert.exists(item)
    item.presentation = { preview: { kind: 'image', src } }
    render(CatalogChangeRow, { props: { item } })
    await fireEvent.error(
      screen.getByRole('img', { name: 'Preview of Review fixture' })
    )
    expect(
      screen.getByRole('img', { name: 'No visual preview available' })
    ).toBeVisible()
    expect(
      screen.queryByRole('img', { name: 'Preview of Review fixture' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open Review fixture' })
    ).toHaveAttribute('href', `/admin/content/${item.content.uid}/view`)
  })
})
