import { describe, expect, it } from 'vitest'

import { COMFY_BASE_DOMAIN, COMFY_WEBSITE_URLS } from '@/config/comfyDomain'
import { PYPI_MIRROR, PYTHON_MIRROR } from '@/constants/mirrors'
import {
  COMFY_URLS,
  DEVELOPER_TOOLS,
  GITHUB_REPOS,
  MODEL_SOURCES,
  getDesktopGuideUrl
} from '@/constants/urls'

describe('URL Constants', () => {
  describe('URL Format Validation', () => {
    it('should have valid HTTPS URLs throughout', () => {
      const httpsPattern =
        /^https:\/\/[a-z0-9]+([-.][a-z0-9]+)*\.[a-z]{2,}(:[0-9]{1,5})?(\/.*)?$/i

      // Test COMFY_URLS
      expect(COMFY_URLS.website.base).toMatch(httpsPattern)
      expect(COMFY_URLS.docs.base).toMatch(httpsPattern)
      expect(COMFY_URLS.community.discord).toMatch(httpsPattern)

      // Test GITHUB_REPOS
      Object.values(GITHUB_REPOS).forEach((url) => {
        expect(url).toMatch(httpsPattern)
      })

      // Test MODEL_SOURCES
      Object.values(MODEL_SOURCES.repos).forEach((url) => {
        expect(url).toMatch(httpsPattern)
      })

      // Test DEVELOPER_TOOLS
      Object.values(DEVELOPER_TOOLS).forEach((url) => {
        expect(url).toMatch(httpsPattern)
      })
    })

    it('should have proper GitHub URL format', () => {
      const githubPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+(\/[\w-]+)?$/

      expect(GITHUB_REPOS.comfyui).toMatch(githubPattern)
      expect(GITHUB_REPOS.comfyuiIssues).toMatch(githubPattern)
      expect(GITHUB_REPOS.frontend).toMatch(githubPattern)
    })
  })

  describe('Mirror Configuration', () => {
    it('should have valid mirror URLs', () => {
      const urlPattern =
        /^https?:\/\/[a-z0-9]+([-\.]{1}[a-z0-9]+)*\.[a-z]{2,}(:[0-9]{1,5})?(\/.*)?$/i

      expect(PYTHON_MIRROR.mirror).toMatch(urlPattern)
      expect(PYTHON_MIRROR.fallbackMirror).toMatch(urlPattern)
      expect(PYPI_MIRROR.mirror).toMatch(urlPattern)
      expect(PYPI_MIRROR.fallbackMirror).toMatch(urlPattern)
    })
  })

  describe('Domain Configuration', () => {
    it('should have valid domain format', () => {
      const domainPattern = /^[a-z0-9]+([-.][a-z0-9]+)*\.[a-z]{2,}$/i
      expect(COMFY_BASE_DOMAIN).toMatch(domainPattern)
    })

    it('should construct proper website URLs from base domain', () => {
      const expectedBase = `https://www.${COMFY_BASE_DOMAIN}`
      expect(COMFY_WEBSITE_URLS.base).toBe(expectedBase)
      expect(COMFY_WEBSITE_URLS.termsOfService).toBe(
        `${expectedBase}/terms-of-service`
      )
      expect(COMFY_WEBSITE_URLS.privacy).toBe(`${expectedBase}/privacy`)
    })
  })

  describe('Localization', () => {
    it('should handle valid language codes in getLocalized', () => {
      const validLanguageCodes = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de']

      validLanguageCodes.forEach((lang) => {
        const result = COMFY_URLS.docs.getLocalized('test-path', lang)
        expect(result).toMatch(/^\/docs\/(([a-z]{2}-[A-Z]{2}\/)?test-path)$/)
      })
    })

    it('should properly format localized paths', () => {
      expect(COMFY_URLS.docs.getLocalized('test-path', 'en')).toBe(
        '/docs/test-path'
      )
      expect(COMFY_URLS.docs.getLocalized('test-path', 'zh')).toBe(
        '/docs/zh-CN/test-path'
      )
      expect(COMFY_URLS.docs.getLocalized('/', 'en')).toBe('/docs/')
      expect(COMFY_URLS.docs.getLocalized('/', 'zh')).toBe('/docs/zh-CN/')
    })

    it('should generate platform and locale-aware desktop guide URLs', () => {
      // Test English locale
      const enUrl = getDesktopGuideUrl('en')
      expect(enUrl).toMatch(
        /^https:\/\/docs\.comfy\.org\/installation\/desktop\/(windows|macos)$/
      )

      // Test Chinese locale
      const zhUrl = getDesktopGuideUrl('zh')
      expect(zhUrl).toMatch(
        /^https:\/\/docs\.comfy\.org\/zh-CN\/installation\/desktop\/(windows|macos)$/
      )

      // Test other locales default to English
      const frUrl = getDesktopGuideUrl('fr')
      expect(frUrl).toMatch(
        /^https:\/\/docs\.comfy\.org\/installation\/desktop\/(windows|macos)$/
      )
    })
  })

  describe('Security', () => {
    it('should only use secure HTTPS for external URLs', () => {
      const allUrls = [
        ...Object.values(GITHUB_REPOS),
        ...Object.values(MODEL_SOURCES.repos),
        ...Object.values(DEVELOPER_TOOLS),
        COMFY_URLS.website.base,
        COMFY_URLS.docs.base,
        COMFY_URLS.community.discord
      ]

      allUrls.forEach((url) => {
        expect(url.startsWith('https://')).toBe(true)
        expect(url.startsWith('http://')).toBe(false)
      })
    })

    it('should have valid domain allowlist for model sources', () => {
      const domainPattern = /^[a-z0-9]+([-.][a-z0-9]+)*\.[a-z]{2,}$/i

      MODEL_SOURCES.allowedDomains.forEach((domain) => {
        expect(domain).toMatch(domainPattern)
      })
    })
  })
})
