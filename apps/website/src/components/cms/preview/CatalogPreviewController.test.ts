import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CatalogPreviewController from './CatalogPreviewController.vue'

const props = {
  csrf: 'fixture-csrf',
  view: 'DRAFT' as const,
  now: '2026-10-15T09:00:00Z',
  locale: 'en' as const,
  currentPath: '/hub/workflows/example/?q=keep#inputs',
  changes: []
}

describe('verified staff Preview controller', () => {
  it('renders session controls without a data request or fake change count, and opens the review page explicitly', async () => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPreviewController, {
      props: { ...props, changes: undefined }
    })
    await nextTick()
    expect(screen.queryByText('0 Draft changes')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Changes' }))
    expect(assign).toHaveBeenCalledExactlyOnceWith('/admin/catalog')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('hides redundant normal-LIVE entry controls in the admin shell', () => {
    render(CatalogPreviewController, {
      props: { ...props, view: 'LIVE', now: undefined, showEntry: false }
    })
    expect(screen.queryByRole('button', { name: 'ADMIN' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Preview Draft' })).toBeNull()
  })
  it('retains the active Preview controls when entry shortcuts are hidden', () => {
    render(CatalogPreviewController, { props: { ...props, showEntry: false } })
    expect(screen.getByRole('button', { name: 'EXIT' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ADMIN' })).toBeInTheDocument()
  })
  it('keeps controls disabled until the mounted DOM is ready for commands', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPreviewController, { props })
    expect(screen.getByRole('button', { name: 'EXIT' })).toBeDisabled()
    expect(fetch).not.toHaveBeenCalled()
    await nextTick()
    expect(screen.getByRole('button', { name: 'EXIT' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'EXIT' }))
    expect(fetch).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(assign).toHaveBeenCalledWith(props.currentPath))
  })
  it.for([
    { view: 'DRAFT' as const, now: props.now },
    { view: 'LIVE' as const, now: undefined }
  ])(
    'opens ADMIN directly without changing Preview state from $view',
    async (state) => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      vi.mocked(globalThis.fetch).mockImplementation(fetch)
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      render(CatalogPreviewController, { props: { ...props, ...state } })
      await nextTick()
      await userEvent.click(screen.getByRole('button', { name: 'ADMIN' }))
      expect(assign).toHaveBeenCalledExactlyOnceWith('/admin/catalog')
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it.for([
    { button: 'EXIT', expected: { view: 'LIVE', now: 'now' } },
    { button: 'NOW', expected: { view: 'DRAFT', now: 'now' } }
  ])(
    'commits $button then reloads the same validated page',
    async ({ button, expected }) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(null, { status: 204 }))
      vi.mocked(globalThis.fetch).mockImplementation(fetch)
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      render(CatalogPreviewController, { props })
      await nextTick()
      await userEvent.click(screen.getByRole('button', { name: button }))
      await waitFor(() =>
        expect(assign).toHaveBeenCalledWith(props.currentPath)
      )
      expect(fetch).toHaveBeenCalledWith(
        '/admin/catalog-preview',
        expect.objectContaining({ body: JSON.stringify(expected) })
      )
      expect(screen.getByRole('button', { name: 'EXIT' })).toBeDisabled()
    }
  )
  it('changes locale only after server commit and preserves detail/query/hash identity', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(null, { status: 204 }))
    )
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPreviewController, { props })
    await nextTick()
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview language' })
    )
    await userEvent.click(screen.getByRole('button', { name: '中文' }))
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        '/zh-CN/hub/workflows/example/?q=keep#inputs'
      )
    )
    expect(
      screen.getByRole('button', { name: 'Preview language' })
    ).toHaveTextContent('EN')
    expect(fetch).toHaveBeenCalledWith(
      '/admin/catalog-preview',
      expect.objectContaining({ body: '{"view":"DRAFT","locale":"zh-CN"}' })
    )
  })
  it('switches to Live without discarding the time override', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPreviewController, { props })
    await nextTick()
    await userEvent.click(screen.getByRole('button', { name: 'LIVE' }))
    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(
      '/admin/catalog-preview',
      expect.objectContaining({ body: '{"view":"LIVE"}' })
    )
    expect(screen.getByRole('button', { name: 'DRAFT' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
  it('posts a UTC timewarp chosen in the date picker', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPreviewController, { props })
    await nextTick()
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview date and time' })
    )
    await fireEvent.update(
      screen.getByLabelText('Preview date and time (UTC)'),
      '2026-10-20T15:30'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Show this date' })
    )
    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(
      '/admin/catalog-preview',
      expect.objectContaining({
        body: '{"view":"DRAFT","now":"2026-10-20T15:30:00.000Z"}'
      })
    )
  })
  it.for([400, 403, 503])(
    'keeps confirmed view and language on rejected status %s',
    async (status) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          new Response('<script>untrusted</script>', { status })
        )
      vi.mocked(globalThis.fetch).mockImplementation(fetch)
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      render(CatalogPreviewController, { props })
      await nextTick()
      await userEvent.click(
        screen.getByRole('button', { name: 'Preview language' })
      )
      await userEvent.click(screen.getByRole('button', { name: '中文' }))
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Your view is unchanged'
        )
      )
      expect(
        screen.getByRole('button', { name: 'Preview language' })
      ).toHaveTextContent('EN')
      expect(screen.getByRole('button', { name: 'EXIT' })).toBeEnabled()
      expect(assign).not.toHaveBeenCalled()
    }
  )
  it('freezes other commands while a commit is pending', async () => {
    let commit: ((response: Response) => void) | undefined
    const pending = new Promise<Response>((resolve) => {
      commit = resolve
    })
    const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValue(pending)
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPreviewController, { props })
    await nextTick()
    await userEvent.click(screen.getByRole('button', { name: 'NOW' }))
    expect(screen.getByRole('button', { name: 'EXIT' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ADMIN' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'EXIT' }))
    expect(fetch).toHaveBeenCalledOnce()
    expect(assign).not.toHaveBeenCalled()
    assert.exists(commit)
    commit(new Response(null, { status: 204 }))
    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
  })
  it('offers an admin entry without showing a banner on normal Live', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPreviewController, {
      props: { ...props, view: 'LIVE', now: undefined }
    })
    await nextTick()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Preview Draft' }))
    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(
      '/admin/catalog-preview',
      expect.objectContaining({ body: '{"view":"DRAFT"}' })
    )
  })
  it('refuses an external return path before sending any command', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPreviewController, {
      props: { ...props, currentPath: '//evil.test' }
    })
    await nextTick()
    await userEvent.click(screen.getByRole('button', { name: 'EXIT' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your view is unchanged'
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })
})
