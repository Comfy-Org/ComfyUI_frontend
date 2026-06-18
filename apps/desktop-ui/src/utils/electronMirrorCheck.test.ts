import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockElectron } = vi.hoisted(() => ({
  mockElectron: {
    NetWork: {
      canAccessUrl: vi.fn<[url: string], Promise<boolean>>()
    }
  }
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: vi.fn(() => mockElectron)
}))

import { checkMirrorReachable } from '@/utils/electronMirrorCheck'

describe('checkMirrorReachable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false for an invalid URL without calling canAccessUrl', async () => {
    const result = await checkMirrorReachable('not-a-url')
    expect(result).toBe(false)
    expect(mockElectron.NetWork.canAccessUrl).not.toHaveBeenCalled()
  })

  it('returns false when canAccessUrl returns false', async () => {
    mockElectron.NetWork.canAccessUrl.mockResolvedValue(false)
    const result = await checkMirrorReachable('https://example.com')
    expect(result).toBe(false)
  })

  it('returns true when URL is valid and canAccessUrl returns true', async () => {
    mockElectron.NetWork.canAccessUrl.mockResolvedValue(true)
    const result = await checkMirrorReachable('https://example.com')
    expect(result).toBe(true)
  })

  it('passes the mirror URL to canAccessUrl', async () => {
    const url = 'https://pypi.org/simple/'
    mockElectron.NetWork.canAccessUrl.mockResolvedValue(true)
    await checkMirrorReachable(url)
    expect(mockElectron.NetWork.canAccessUrl).toHaveBeenCalledWith(url)
  })

  it('returns false for empty string', async () => {
    const result = await checkMirrorReachable('')
    expect(result).toBe(false)
    expect(mockElectron.NetWork.canAccessUrl).not.toHaveBeenCalled()
  })
})
