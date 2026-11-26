import { captureHandoffToken } from '@/handoff/captureHandoffToken'

function at(url: string, { stripWorks = true } = {}) {
  const location = new URL(url, 'https://testbilling.comfy.org')
  let hash = location.hash
  const replaceUrl = vi.fn((next: string) => {
    if (stripWorks) hash = new URL(next, location).hash
  })
  const markExchangePending = vi.fn<(marker: string) => void>()
  const capture = captureHandoffToken({
    pathname: location.pathname,
    search: location.search,
    hash: () => hash,
    replaceUrl,
    markExchangePending
  })
  return { capture, replaceUrl, markExchangePending, hash: () => hash }
}

describe('captureHandoffToken', () => {
  it.for([
    { url: '/handoff#token=tok-1', path: '/handoff' },
    { url: '/handoff/#token=tok-1', path: '/handoff/' }
  ])('takes the token out of $url', ({ url, path }) => {
    const { capture, replaceUrl, hash } = at(url)

    expect(capture).toEqual({
      kind: 'captured',
      onHandoffPath: true,
      token: 'tok-1'
    })
    expect(replaceUrl).toHaveBeenCalledWith(path)
    expect(hash()).toBe('')
  })

  it('strips a token fragment on any other route without treating it as a handoff', () => {
    const { capture, hash } = at('/v1/subscription?product=comfyui#token=tok-1')

    expect(capture).toEqual({
      kind: 'captured',
      onHandoffPath: false,
      token: undefined
    })
    expect(hash()).toBe('')
  })

  it('replaces any earlier handoff with a lost-exchange ending before anything loads', () => {
    const { markExchangePending } = at('/handoff#token=tok-1')

    expect(markExchangePending).toHaveBeenCalledOnce()
    expect(JSON.parse(markExchangePending.mock.calls[0][0])).toEqual({
      kind: 'ended',
      ending: 'exchange_lost'
    })
  })

  it('leaves an earlier handoff alone when there is no token to exchange', () => {
    const { markExchangePending } = at('/handoff')

    expect(markExchangePending).not.toHaveBeenCalled()
  })

  it('stops the page when the token cannot be removed from the URL', () => {
    const { capture } = at('/handoff#token=tok-1', { stripWorks: false })

    expect(capture).toEqual({ kind: 'halt' })
  })

  it('leaves a route without a token untouched', () => {
    const { capture, replaceUrl } = at('/v1/subscription#section')

    expect(capture).toMatchObject({ kind: 'captured', onHandoffPath: false })
    expect(replaceUrl).not.toHaveBeenCalled()
  })
})
