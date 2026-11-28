import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockData = vi.hoisted(() => ({ isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isDesktop() {
    return mockData.isDesktop
  }
}))

vi.mock(import('@/utils/envUtil'), () => ({
  electronAPI: vi.fn()
}))

const i18n = vi.hoisted(() => ({
  global: {
    locale: {
      value: 'en'
    }
  }
}))
vi.mock<unknown>(import('@/i18n'), () => ({
  i18n
}))

import { useExternalLink } from '@/composables/useExternalLink'
import { electronAPI } from '@/utils/envUtil'

describe('useExternalLink', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    mockData.isDesktop = false
  })

  describe('staticUrls', () => {
    it('should provide common external URLs', () => {
      const { staticUrls } = useExternalLink()

      expect(staticUrls.discord).toBe('https://discord.com/invite/comfyorg')
      expect(staticUrls.github).toBe('https://github.com/Comfy-Org/ComfyUI')
      expect(staticUrls.githubIssues).toBe(
        'https://github.com/Comfy-Org/ComfyUI/issues'
      )
      expect(staticUrls.githubFrontend).toBe(
        'https://github.com/Comfy-Org/ComfyUI_frontend'
      )
      expect(staticUrls.githubElectron).toBe(
        'https://github.com/Comfy-Org/electron'
      )
      expect(staticUrls.forum).toBe('https://forum.comfy.org/')
    })
  })

  describe('buildDocsUrl', () => {
    it('tags the docs URL with the campaign', () => {
      const { buildDocsUrl } = useExternalLink()

      const { searchParams } = new URL(
        buildDocsUrl('/changelog', { campaign: 'release_notes' })
      )
      expect(Object.fromEntries(searchParams)).toEqual({
        utm_source: 'comfyui_local',
        utm_medium: 'product',
        utm_campaign: 'release_notes'
      })
    })

    it('should build basic docs URL without locale', () => {
      i18n.global.locale.value = 'en'
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('/changelog', {
        campaign: 'help_center'
      })
      expect(url.split('?')[0]).toBe('https://docs.comfy.org/changelog')
    })

    it('should build docs URL with Chinese (zh) locale when requested', () => {
      i18n.global.locale.value = 'zh'
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('/changelog', {
        campaign: 'help_center',
        includeLocale: true
      })
      expect(url.split('?')[0]).toBe('https://docs.comfy.org/zh/changelog')
    })

    it('should build docs URL with Chinese (zh-TW) locale when requested', () => {
      i18n.global.locale.value = 'zh-TW'
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('/changelog', {
        campaign: 'help_center',
        includeLocale: true
      })
      expect(url.split('?')[0]).toBe('https://docs.comfy.org/zh/changelog')
    })

    it('should not include locale for English when requested', () => {
      i18n.global.locale.value = 'en'
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('/changelog', {
        campaign: 'help_center',
        includeLocale: true
      })
      expect(url.split('?')[0]).toBe('https://docs.comfy.org/changelog')
    })

    it('should handle path without leading slash', () => {
      const { buildDocsUrl } = useExternalLink()

      const url = buildDocsUrl('changelog', {
        campaign: 'help_center'
      })
      expect(url.split('?')[0]).toBe('https://docs.comfy.org/changelog')
    })

    it('should add platform suffix when requested', () => {
      i18n.global.locale.value = 'en'
      mockData.isDesktop = true
      vi.mocked(electronAPI).mockReturnValue({
        getPlatform: () => 'darwin'
      } as ReturnType<typeof electronAPI>)

      const { buildDocsUrl } = useExternalLink()
      const url = buildDocsUrl('/installation/desktop', {
        campaign: 'help_center',
        platform: true
      })
      expect(url.split('?')[0]).toBe(
        'https://docs.comfy.org/installation/desktop/macos'
      )
    })

    it('should add platform suffix with trailing slash', () => {
      i18n.global.locale.value = 'en'
      mockData.isDesktop = true
      vi.mocked(electronAPI).mockReturnValue({
        getPlatform: () => 'win32'
      } as ReturnType<typeof electronAPI>)

      const { buildDocsUrl } = useExternalLink()
      const url = buildDocsUrl('/installation/desktop/', {
        campaign: 'help_center',
        platform: true
      })
      expect(url.split('?')[0]).toBe(
        'https://docs.comfy.org/installation/desktop/windows'
      )
    })

    it('should combine locale and platform', () => {
      i18n.global.locale.value = 'zh'
      mockData.isDesktop = true
      vi.mocked(electronAPI).mockReturnValue({
        getPlatform: () => 'darwin'
      } as ReturnType<typeof electronAPI>)

      const { buildDocsUrl } = useExternalLink()
      const url = buildDocsUrl('/installation/desktop', {
        campaign: 'help_center',
        includeLocale: true,
        platform: true
      })
      expect(url.split('?')[0]).toBe(
        'https://docs.comfy.org/zh/installation/desktop/macos'
      )
    })

    it('should not add platform when not desktop', () => {
      i18n.global.locale.value = 'en'
      mockData.isDesktop = false

      const { buildDocsUrl } = useExternalLink()
      const url = buildDocsUrl('/installation/desktop', {
        campaign: 'help_center',
        platform: true
      })
      expect(url.split('?')[0]).toBe(
        'https://docs.comfy.org/installation/desktop'
      )
    })
  })
})
