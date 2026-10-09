import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  CHANGELOG_CACHE_KEY,
  CHANGELOG_REFRESH_MS,
  CHANGELOG_SOURCE
} from '@/lib/changelog'
import ChangelogContent from './ChangelogContent.vue'

const source =
  '<Update label="v1" description="October 5, 2026">**Feature** <script>window.bad = true</script> [Unsafe](javascript:alert) [Docs](https://docs.comfy.org)</Update>'

describe('ChangelogContent', () => {
  it('keeps addressable release sections and links the docs changelog', async () => {
    respondToFetch(CHANGELOG_SOURCE, () => new Response(source))
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    expect(screen.getByRole('article', { name: 'v1' })).toHaveAttribute(
      'id',
      'v1'
    )
    expect(screen.getByRole('link', { name: 'VIEW DOCS' })).toHaveAttribute(
      'href',
      'https://docs.comfy.org/changelog'
    )
  })

  it('shows a release without a description and omits its date', async () => {
    respondToFetch(
      CHANGELOG_SOURCE,
      () => new Response(source.replace(' description="October 5, 2026"', ''))
    )
    render(ChangelogContent)
    const release = await screen.findByRole('article', { name: 'v1' })
    expect(release).toHaveTextContent('Feature')
    expect(release).not.toHaveTextContent('October 5, 2026')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('refreshes an open page when the docs source changes', async () => {
    respondToFetch(
      CHANGELOG_SOURCE,
      () => new Response(source.replace('v1', 'v2'))
    )
    respondToFetch(CHANGELOG_SOURCE, () => new Response(source), { times: 1 })
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    await vi.advanceTimersByTimeAsync(290_000)
    expect(screen.getByRole('heading', { name: 'v1' })).toBeVisible()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await screen.findByRole('heading', { name: 'v2' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'v1' })).toBeNull()
  })

  it('pauses refreshing in a hidden tab and refreshes when it is shown again', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    respondToFetch(CHANGELOG_SOURCE, () => new Response(source))
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(600_000)
    expect(fetch).toHaveBeenCalledOnce()
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  })

  it('aborts an in-flight request when the page unmounts', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}))
    const { unmount } = render(ChangelogContent)
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const signal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('loads live notes and removes unsafe source markup', async () => {
    respondToFetch(CHANGELOG_SOURCE, () => new Response(source))
    render(ChangelogContent)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
    await screen.findByRole('heading', { name: 'v1' })
    expect(screen.queryByText('window.bad = true')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Unsafe' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      'https://docs.comfy.org/'
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/^$/)
    )
    expect(
      JSON.parse(localStorage.getItem(CHANGELOG_CACHE_KEY) ?? '{}').source
    ).toBe(source)
  })

  it('keeps fresh notes unlabeled when the browser cannot save them', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    respondToFetch(CHANGELOG_SOURCE, () => new Response(source))
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/^$/)
    )
  })

  it('shows an outage, then recovers when retried', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(source))
    render(ChangelogContent)
    await screen.findByRole('button', { name: 'Try again' })
    expect(screen.getByRole('status')).toHaveTextContent('could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { name: 'v1' })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    )
  })

  it('labels cached notes during an outage in the live region it started with', async () => {
    localStorage.setItem(
      CHANGELOG_CACHE_KEY,
      JSON.stringify({ source, checkedAt: Date.now() })
    )
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    const status = screen.getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Showing saved'))
    expect(screen.getByRole('status')).toBe(status)
  })

  it('keeps validated saved notes when fresh release anchors are ambiguous', async () => {
    localStorage.setItem(
      CHANGELOG_CACHE_KEY,
      JSON.stringify({ source, checkedAt: Date.now() })
    )
    respondToFetch(CHANGELOG_SOURCE, () => new Response(source + source))
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
    respondToFetch(
      CHANGELOG_SOURCE,
      () => new Response(v2 + source.replace('v1', 'v3'))
    )
    respondToFetch(CHANGELOG_SOURCE, () => pending, { times: 1 })
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

  it('stops waiting for an initial hash after the first fresh notes', async () => {
    window.history.replaceState(null, '', '#v2')
    const scroll = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    respondToFetch(
      CHANGELOG_SOURCE,
      () => new Response(source.replace('v1', 'v2') + source)
    )
    respondToFetch(CHANGELOG_SOURCE, () => new Response(source), { times: 1 })
    render(ChangelogContent)
    await screen.findByRole('heading', { name: 'v1' })
    await vi.advanceTimersByTimeAsync(CHANGELOG_REFRESH_MS)
    await screen.findByRole('heading', { name: 'v2' })
    expect(scroll).not.toHaveBeenCalled()
  })
})
