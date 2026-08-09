import { afterEach, describe, expect, it, vi } from 'vitest'

import { useTextFileContent } from '@/composables/useTextFileContent'

function stubFetch(response: Partial<Response> | Error) {
  const mock =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', mock)
  return mock
}

describe(useTextFileContent, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns inline content without fetching', async () => {
    const fetchMock = stubFetch(new Error('should not be called'))
    const { textContent } = useTextFileContent(() => ({
      content: 'inline text',
      url: 'http://example.com/file.txt'
    }))

    await vi.waitFor(() => expect(textContent.value).toBe('inline text'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches text from the url when no inline content is present', async () => {
    const fetchMock = stubFetch({
      ok: true,
      text: () => Promise.resolve('fetched text')
    })
    const { textContent, hasError } = useTextFileContent(() => ({
      url: 'http://example.com/file.txt'
    }))

    await vi.waitFor(() => expect(textContent.value).toBe('fetched text'))
    expect(fetchMock).toHaveBeenCalledWith('http://example.com/file.txt')
    expect(hasError.value).toBe(false)
  })

  it('flags an error for a non-ok response', async () => {
    stubFetch({ ok: false })
    const { textContent, hasError } = useTextFileContent(() => ({
      url: 'http://example.com/missing.txt'
    }))

    await vi.waitFor(() => expect(hasError.value).toBe(true))
    expect(textContent.value).toBe('')
  })

  it('flags an error when the fetch rejects', async () => {
    stubFetch(new Error('network down'))
    const { hasError } = useTextFileContent(() => ({
      url: 'http://example.com/file.txt'
    }))

    await vi.waitFor(() => expect(hasError.value).toBe(true))
  })

  it('resolves empty content when there is no source', async () => {
    const fetchMock = stubFetch(new Error('should not be called'))
    const { textContent, isLoading } = useTextFileContent(() => undefined)

    await vi.waitFor(() => expect(isLoading.value).toBe(false))
    expect(textContent.value).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
