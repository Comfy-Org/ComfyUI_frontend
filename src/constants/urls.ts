/**
 * URL constants for ComfyUI frontend
 * Centralized location for all URL references
 */
import { COMFY_BASE_DOMAIN } from '@/config/comfyDomain'

const DOCS_BASE_URL = `https://docs.${COMFY_BASE_DOMAIN}`
const FORUM_BASE_URL = `https://forum.${COMFY_BASE_DOMAIN}`
const WEBSITE_BASE_URL = `https://www.${COMFY_BASE_DOMAIN}`

export const COMFY_URLS = {
  website: {
    base: WEBSITE_BASE_URL,
    termsOfService: `${WEBSITE_BASE_URL}/terms-of-service`,
    privacy: `${WEBSITE_BASE_URL}/privacy`
  },
  docs: {
    base: DOCS_BASE_URL,
    changelog: {
      en: `${DOCS_BASE_URL}/changelog`,
      zh: `${DOCS_BASE_URL}/zh-CN/changelog`
    },
    installation: {
      update: `${DOCS_BASE_URL}/installation/update_comfyui`
    },
    tutorials: {
      apiNodes: {
        overview: `${DOCS_BASE_URL}/tutorials/api-nodes/overview`,
        faq: `${DOCS_BASE_URL}/tutorials/api-nodes/faq`,
        pricing: `${DOCS_BASE_URL}/tutorials/api-nodes/pricing`,
        apiKeyLogin: `${DOCS_BASE_URL}/interface/user#logging-in-with-an-api-key`,
        nonWhitelistedLogin: `${DOCS_BASE_URL}/tutorials/api-nodes/overview#log-in-with-api-key-on-non-whitelisted-websites`
      }
    },
    getLocalized: (path: string, locale: string) => {
      return locale === 'zh' || locale === 'zh-CN'
        ? `${DOCS_BASE_URL}/zh-CN/${path}`
        : `${DOCS_BASE_URL}/${path}`
    }
  },
  community: {
    discord: `${WEBSITE_BASE_URL}/discord`,
    forum: {
      base: `${FORUM_BASE_URL}/`,
      v1Feedback: `${FORUM_BASE_URL}/c/v1-feedback/`
    }
  }
}

export const GITHUB_REPOS = {
  comfyui: 'https://github.com/comfyanonymous/ComfyUI',
  comfyuiIssues: 'https://github.com/comfyanonymous/ComfyUI/issues',
  frontend: 'https://github.com/Comfy-Org/ComfyUI_frontend',
  electron: 'https://github.com/Comfy-Org/electron',
  desktopPlatforms:
    'https://github.com/Comfy-Org/desktop#currently-supported-platforms'
}

export const MODEL_SOURCES = {
  repos: {
    civitai: 'https://civitai.com/',
    huggingface: 'https://huggingface.co/'
  },
  whitelistedUrls: [
    'https://huggingface.co/stabilityai/stable-zero123/resolve/main/stable_zero123.ckpt',
    'https://huggingface.co/TencentARC/T2I-Adapter/resolve/main/models/t2iadapter_depth_sd14v1.pth?download=true',
    'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
  ],
  allowedDomains: [
    'https://civitai.com/',
    'https://huggingface.co/',
    'http://localhost:' // TODO: Remove in production
  ]
}

export const DEVELOPER_TOOLS = {
  git: 'https://git-scm.com/downloads/',
  vcRedist: 'https://aka.ms/vs/17/release/vc_redist.x64.exe',
  uv: 'https://docs.astral.sh/uv/getting-started/installation/'
}

// Platform and locale-aware desktop guide URL generator
export const getDesktopGuideUrl = (
  locale: string,
  systemStatsOs?: string
): string => {
  const isChineseLocale = locale === 'zh'

  let platform = 'windows' // default

  if (systemStatsOs) {
    const os = systemStatsOs.toLowerCase()
    if (os.includes('darwin') || os.includes('mac')) {
      platform = 'macos'
    } else if (os.includes('windows')) {
      platform = 'windows'
    }
  }

  const baseUrl = isChineseLocale
    ? `https://docs.${COMFY_BASE_DOMAIN}/zh-CN/installation/desktop`
    : `https://docs.${COMFY_BASE_DOMAIN}/installation/desktop`

  return `${baseUrl}/${platform}`
}
