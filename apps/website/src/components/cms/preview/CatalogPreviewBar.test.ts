import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import CatalogPreviewBar from './CatalogPreviewBar.vue'
import CatalogPreviewTimePicker from './CatalogPreviewTimePicker.vue'

describe('catalog Preview controls', () => {
  it.for([
    { count: 0, label: '0 Draft changes' },
    { count: 1, label: '1 Draft change' },
    { count: 2, label: '2 Draft changes' }
  ])('pluralizes the Draft summary as $label', ({ count, label }) => {
    const changes = Array.from({ length: count }, (_, index) => ({
      uid: `change-${index}`,
      title: `Change ${index}`,
      kind: 'modified' as const,
      summary: 'Updated'
    }))
    render(CatalogPreviewBar, { props: { active: true, changes } })
    expect(screen.getByText(label)).toBeInTheDocument()
  })
  it.for([
    { active: false, view: 'DRAFT' as const },
    { active: true, view: 'LIVE' as const }
  ])(
    'never shows the warning banner without Draft or timewarp (%o)',
    (state) => {
      render(CatalogPreviewBar, { props: { ...state, changes: [] } })
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'EXIT' })
      ).not.toBeInTheDocument()
    }
  )
  it('shows the warning for Live timewarp and hides it when NOW clears the override', async () => {
    const result = render(CatalogPreviewBar, {
      props: {
        active: true,
        view: 'LIVE',
        now: '2026-10-15T09:00:00Z',
        changes: []
      }
    })
    expect(screen.getByRole('region')).toBeVisible()
    expect(screen.getByRole('button', { name: 'LIVE' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.queryByText('0 Draft changes')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(result.emitted().view).toEqual([['DRAFT']])
    expect(screen.getByRole('button', { name: 'LIVE' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await result.rerender({ now: undefined })
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
  it('uses Mar’s graphite chrome and blue Draft state while preserving NOW/EXIT/locale intents', async () => {
    const result = render(CatalogPreviewBar, {
      props: { active: true, changes: [], now: '2026-10-15T09:00:00Z' }
    })
    expect(
      screen.getByRole('region', { name: 'Catalog preview controls' })
    ).toHaveClass('w-full', 'bg-admin-chrome', 'border-t-admin-info')
    await userEvent.click(screen.getByRole('button', { name: 'NOW' }))
    expect(result.emitted().timewarp).toEqual([[undefined]])
    await userEvent.click(screen.getByRole('button', { name: 'EXIT' }))
    expect(result.emitted().exit).toEqual([[]])
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview language' })
    )
    await userEvent.click(screen.getByRole('button', { name: '中文' }))
    expect(result.emitted().locale).toEqual([['zh-CN']])
    expect(screen.getByRole('region')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Preview language' })
    ).toHaveTextContent('EN')
    await result.rerender({ locale: 'zh-CN' })
    expect(
      screen.getByRole('region', { name: '内容目录预览控件' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: '预览语言' })).toHaveTextContent(
      '中'
    )
  })
  it('disables mutation intents during an outstanding request and displays caller failure as text', async () => {
    const result = render(CatalogPreviewBar, {
      props: {
        active: true,
        changes: [],
        busy: true,
        error: '<script>fail</script>'
      }
    })
    expect(screen.getByRole('button', { name: 'NOW' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'EXIT' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Preview language' })
    ).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('<script>fail</script>')
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview language' })
    )
    expect(
      screen.queryByRole('button', { name: '中文' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'LIVE' }))
    expect(result.emitted().view).toBeUndefined()
    expect(result.emitted().locale).toBeUndefined()
  })
  it('renders compact change summaries, field paths and safe navigation without injected HTML', async () => {
    const result = render(CatalogPreviewBar, {
      props: {
        active: true,
        changes: [
          {
            uid: 'a',
            title: 'Example',
            kind: 'modified',
            summary: '<img src=x onerror=alert(1)>',
            fields: ['$.examples[0].values.prompt'],
            route: '/hub/workflows/example/'
          },
          {
            uid: 'b',
            title: 'Unsafe link',
            kind: 'added',
            summary: 'New item',
            route: '//evil.test'
          }
        ]
      }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Changes' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeVisible())
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Unsafe link' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Changed fields'))
    expect(screen.getByText('$.examples[0].values.prompt')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Example' }))
    expect(result.emitted().navigate).toEqual([['/hub/workflows/example/']])
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })
  it('removes its sticky-header offset when switching to LIVE', async () => {
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(
          private readonly callback: (
            entries: { borderBoxSize: { blockSize: number }[] }[]
          ) => void
        ) {}
        observe() {
          this.callback([{ borderBoxSize: [{ blockSize: 48 }] }])
        }
        disconnect = disconnect
      }
    )
    const result = render(CatalogPreviewBar, {
      props: { active: true, changes: [] }
    })
    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue('--cms-preview-offset')
      ).toBe('48px')
    )
    await result.rerender({ view: 'LIVE' })
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(
      document.documentElement.style.getPropertyValue('--cms-preview-offset')
    ).toBe('')
    expect(disconnect).toHaveBeenCalled()
  })
  it('handles date selection as UTC and rejects empty dates', async () => {
    const result = render(CatalogPreviewTimePicker, { props: {} })
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview date and time' })
    )
    await waitFor(() =>
      expect(screen.getByText('Preview date and time (UTC)')).toBeVisible()
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Show this date' })
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose a valid date and time.'
    )
    expect(result.emitted().timewarp).toBeUndefined()
    await fireEvent.update(
      screen.getByLabelText('Preview date and time (UTC)'),
      '2026-10-15T09:00'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Show this date' })
    )
    expect(result.emitted().timewarp).toEqual([['2026-10-15T09:00:00.000Z']])
  })
  it('offers verified caller-provided scheduled pages and emits only a timewarp request', async () => {
    const result = render(CatalogPreviewTimePicker, {
      props: {
        launches: [
          { uid: 'a', title: 'Scheduled fixture', at: '2026-10-15T09:00:00Z' }
        ]
      }
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview date and time' })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Scheduled fixture/ })
      ).toBeVisible()
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Scheduled fixture/ })
    )
    expect(result.emitted().timewarp).toEqual([['2026-10-15T09:00:00.000Z']])
  })
})
