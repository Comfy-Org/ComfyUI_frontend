import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useExternalLink } from '@/composables/useExternalLink'

// Mock the environment utilities
vi.mock('@/utils/envUtil', () => ({
  isElectron: vi.fn(),
  electronAPI: vi.fn()
}))

// Mock vue-i18n
const mockLocale = ref('en')
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    locale: mockLocale
  }))
}))

// Import after mocking to get the mocked versions
import { electronAPI, isElectron } from '@/utils/envUtil'

describe('useExternalLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default state
    mockLocale.value = 'en'
    vi.mocked(isElectron).mockReturnValue(false)
  })

  describe('staticUrls', () => {
    it('should provide common external URLs', () => {
      const { staticUrls } = useExternalLink()

      // Static URLs
      expect(staticUrls.discord).toBe('https://www.comfy.org/discord')
      expect(staticUrls.github).toBe(
        'https://github.com/comfyanonymous/ComfyUI'
      )
      expect(staticUrls.githubIssues).toBe(
        'https://github.com/comfyanonymous/ComfyUI/issues'
      )
      expect(staticUrls.githubFrontend).toBe(
        'https://github.com/Comfy-Org/ComfyUI_frontend'
      )
      expect(staticUrls.githubElectron).toBe(
        'https://github.com/Comfy-Org/electron'
      )
      expect(staticUrls.forum).toBe('https://forum.comfy.org/')
      expect(staticUrls.comfyOrg).toBe('https://www.comfy.org/')
    })
  })

  describe('buildDocsUrl', () => {
    it('should build basic docs URL without locale', () => {
      mockLocale.value = 'en'
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('/changelog')
      expect(url).toBe('https://docs.comfy.org/changelog')
    })

    it('should build docs URL with Chinese (zh) locale when requested', () => {
      mockLocale.value = 'zh'
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('/changelog', { includeLocale: true })
      expect(url).toBe('https://docs.comfy.org/zh-CN/changelog')
    })

    it('should build docs URL with Chinese (zh-TW) locale when requested', () => {
      mockLocale.value = 'zh-TW'
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('/changelog', { includeLocale: true })
      expect(url).toBe('https://docs.comfy.org/zh-CN/changelog')
    })

    it('should not include locale for English when requested', () => {
      mockLocale.value = 'en'
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('/changelog', { includeLocale: true })
      expect(url).toBe('https://docs.comfy.org/changelog')
    })

    it('should handle path without leading slash', () => {
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('changelog')
      expect(url).toBe('https://docs.comfy.org/changelog')
    })

    it('should add platform suffix when requested', () => {
      mockLocale.value = 'en'
      vi.mocked(isElectron).mockReturnValue(true)
      vi.mocked(electronAPI).mockReturnValue({
        getPlatform: () => 'darwin'
      } as ReturnType<typeof electronAPI>)

      const { buildDocsUrl } = useExternalLink()
      const url = buildDocsUrl('/installation/desktop', { platform: true })
      expect(url).toBe('https://docs.comfy.org/installation/desktop/macos')
    })

    it('should add platform suffix with trailing slash', () => {
      mockLocale.value = 'en'
      vi.mocked(isElectron).mockReturnValue(true)
      vi.mocked(electronAPI).mockReturnValue({
        getPlatform: () => 'win32'
      } as ReturnType<typeof electronAPI>)

      const { buildDocsUrl } = useExternalLink()
      const url = buildDocsUrl('/installation/desktop/', { platform: true })
      expect(url).toBe('https://docs.comfy.org/installation/desktop/windows')
    })

    it('should combine locale and platform', () => {
      mockLocale.value = 'zh'
      vi.mocked(isElectron).mockReturnValue(true)
      vi.mocked(electronAPI).mockReturnValue({
        getPlatform: () => 'darwin'
      } as ReturnType<typeof electronAPI>)

      const { buildDocsUrl } = useExternalLink()
      const url = buildDocsUrl('/installation/desktop', {
        includeLocale: true,
        platform: true
      })
      expect(url).toBe(
        'https://docs.comfy.org/zh-CN/installation/desktop/macos'
      )
    })

    it('should not add platform when not desktop', () => {
      mockLocale.value = 'en'
      vi.mocked(isElectron).mockReturnValue(false)

      const { buildDocsUrl } = useExternalLink()
      const url = buildDocsUrl('/installation/desktop', { platform: true })
      expect(url).toBe('https://docs.comfy.org/installation/desktop')
    })
  })
})
