import { computed } from 'vue'

import { isDesktop } from '@/platform/distribution/types'
import { productLink } from '@/platform/links/productLink'
import { electronAPI } from '@/utils/envUtil'
import { i18n } from '@/i18n'

/**
 * Builds docs.comfy.org URLs with locale, platform and the product's UTM parameters.
 *
 * @example
 * ```ts
 * const { buildDocsUrl } = useExternalLink()
 * buildDocsUrl('/changelog', { campaign: 'help_center', includeLocale: true })
 * ```
 */
export function useExternalLink() {
  const locale = computed(() => i18n.global.locale.value)

  const isChinese = computed(() => {
    return locale.value === 'zh' || locale.value === 'zh-TW'
  })

  const platform = computed(() => {
    if (!isDesktop) {
      return null
    }

    const electronPlatform = electronAPI().getPlatform()
    return electronPlatform === 'darwin' ? 'macos' : 'windows'
  })

  const buildDocsUrl = (
    path: string,
    options: {
      campaign: string
      includeLocale?: boolean
      platform?: boolean
    }
  ): string => {
    const {
      campaign,
      includeLocale = false,
      platform: includePlatform = false
    } = options

    let docsPath = includeLocale && isChinese.value ? '/zh' : ''
    docsPath += path.startsWith('/') ? path : `/${path}`

    if (includePlatform && platform.value) {
      docsPath = docsPath.endsWith('/') ? docsPath : `${docsPath}/`
      docsPath += platform.value
    }

    return productLink(`https://docs.comfy.org${docsPath}`, campaign)
  }

  const staticUrls = {
    discord: 'https://discord.com/invite/comfyorg',
    github: 'https://github.com/Comfy-Org/ComfyUI',
    githubIssues: 'https://github.com/Comfy-Org/ComfyUI/issues',
    githubFrontend: 'https://github.com/Comfy-Org/ComfyUI_frontend',
    githubElectron: 'https://github.com/Comfy-Org/electron',
    forum: 'https://forum.comfy.org/',
    status: 'https://status.comfy.org/'
  }

  const docsPaths = {
    partnerNodesPricing: '/tutorials/partner-nodes/pricing'
  }

  return {
    buildDocsUrl,
    staticUrls,
    docsPaths
  }
}
