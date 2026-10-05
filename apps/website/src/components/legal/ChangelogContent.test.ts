import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CHANGELOG_CACHE_KEY, CHANGELOG_REFRESH_MS } from '@/lib/changelog'
import ChangelogContent from './ChangelogContent.vue'

const source =
  '<Update label="v1" description="October 5, 2026">**Feature** <script>window.bad = true</script> [Unsafe](javascript:alert) [Docs](https://docs.comfy.org)</Update>'

describe('ChangelogContent', () => {
  it('keeps addressable release sections without the removed version sidebar', async () => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(source)))
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    expect(screen.getByRole('article', { name: 'v1' }).getAttribute('id')).toBe(
      'v1'
    )
    expect(
      screen.queryByRole('navigation', { name: 'Release versions' })
    ).toBeNull()
    expect(screen.getAllByRole('link', { name: 'VIEW DOCS' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'VIEW DOCS' })).toHaveAttribute(
      'href',
      'https://docs.comfy.org/changelog/index'
    )
  })

  it('refreshes an open page when the docs source changes', async () => {
    localStorage.clear()
    vi.useFakeTimers()
    try {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(source))
        .mockResolvedValue(new Response(source.replace('v1', 'v2')))
      vi.stubGlobal('fetch', fetcher)
      render(ChangelogContent)
      await screen.findByRole('heading', { name: 'v1' })
      await vi.advanceTimersByTimeAsync(CHANGELOG_REFRESH_MS)
      expect(screen.getByRole('heading', { name: 'v2' })).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'v1' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads live notes and removes unsafe source markup', async () => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(source)))
    render(ChangelogContent)
    expect(screen.getByRole('status').textContent).toContain('Loading')
    await screen.findByRole('heading', { name: 'v1' })
    expect(screen.queryByText('window.bad = true')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Unsafe' })).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Docs' }).getAttribute('href')
    ).toBe('https://docs.comfy.org/')
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(
      JSON.parse(localStorage.getItem(CHANGELOG_CACHE_KEY) ?? '{}').source
    ).toBe(source)
  })
  it('shows an outage, then recovers when retried', async () => {
    localStorage.clear()
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(source))
    vi.stubGlobal('fetch', fetcher)
    render(ChangelogContent)
    await screen.findByRole('button', { name: 'Try again' })
    expect(screen.getByRole('status').textContent).toContain(
      'could not be loaded'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { name: 'v1' })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    )
  })
  it('labels cached notes during an outage and still revalidates them', async () => {
    localStorage.setItem(
      CHANGELOG_CACHE_KEY,
      JSON.stringify({ source, checkedAt: Date.now() })
    )
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetcher)
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Showing saved')
    )
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
