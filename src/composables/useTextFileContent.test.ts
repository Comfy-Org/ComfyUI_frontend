import { describe, expect, it, vi } from 'vitest'

import { useTextFileContent } from '@/composables/useTextFileContent'

describe(useTextFileContent, () => {
  it('returns inline content without fetching', async () => {
    const { textContent } = useTextFileContent(() => ({
      content: 'inline text',
      url: 'http://example.com/file.txt'
    }))

    await vi.waitFor(() => expect(textContent.value).toBe('inline text'))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches text from the url when no inline content is present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('fetched text'))
    const { textContent, hasError } = useTextFileContent(() => ({
      url: 'http://example.com/file.txt'
    }))

    await vi.waitFor(() => expect(textContent.value).toBe('fetched text'))
    expect(fetch).toHaveBeenCalledWith('http://example.com/file.txt')
    expect(hasError.value).toBe(false)
  })

  it('flags an error for a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }))
    const { textContent, hasError } = useTextFileContent(() => ({
      url: 'http://example.com/missing.txt'
    }))

    await vi.waitFor(() => expect(hasError.value).toBe(true))
    expect(textContent.value).toBe('')
  })

  it('flags an error when the fetch rejects', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'))
    const { hasError } = useTextFileContent(() => ({
      url: 'http://example.com/file.txt'
    }))

    await vi.waitFor(() => expect(hasError.value).toBe(true))
  })

  it('resolves empty content when there is no source', async () => {
    const { textContent, isLoading } = useTextFileContent(() => undefined)

    await vi.waitFor(() => expect(isLoading.value).toBe(false))
    expect(textContent.value).toBe('')
    expect(fetch).not.toHaveBeenCalled()
  })
})
