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
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
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
  it('keeps validated saved notes when fresh release anchors are ambiguous', async () => {
    localStorage.setItem(
      CHANGELOG_CACHE_KEY,
      JSON.stringify({ source, checkedAt: Date.now() })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(source + source))
    )
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Showing saved')
    )
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })
  it('scrolls once to an initial hash that only fresh notes contain', async () => {
    window.history.replaceState(null, '', '#v2')
    const scroll = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    localStorage.setItem(
      CHANGELOG_CACHE_KEY,
      JSON.stringify({ source, checkedAt: Date.now() })
    )
    let finish = (_response: Response) => {}
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    const v2 = source.replace('v1', 'v2')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(pending)
        .mockResolvedValue(new Response(v2 + source.replace('v1', 'v3')))
    )
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    expect(scroll).not.toHaveBeenCalled()
    finish(new Response(v2 + source))
    await screen.findByRole('heading', { name: 'v2' })
    await waitFor(() => expect(scroll).toHaveBeenCalledOnce())
    expect(scroll.mock.instances[0]).toBe(
      screen.getByRole('article', { name: 'v2' })
    )
    await vi.advanceTimersByTimeAsync(CHANGELOG_REFRESH_MS)
    await screen.findByRole('heading', { name: 'v3' })
    expect(scroll).toHaveBeenCalledOnce()
  })
})
