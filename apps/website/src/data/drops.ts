// Image URLs are placeholders at media.comfy.org/website/drops/<id>.png —
// asset uploads and native zh-CN review are pending follow-ups (see
// apps/website/.scratch/drops-page/PRD.md).
import { externalLinks } from '../config/routes'
import type { LocalizedText } from '../i18n/translations'

export type Drop = {
  id: string
  badge?: LocalizedText
  category: LocalizedText
  image: { src: string; alt: LocalizedText }
  title: LocalizedText
  description: LocalizedText
  cta: { label: LocalizedText; href: LocalizedText }
}

const EXPLORE: LocalizedText = { en: 'EXPLORE', 'zh-CN': '探索' }
const PLATFORM: LocalizedText = { en: 'Platform', 'zh-CN': '平台' }
const CLOUD: LocalizedText = { en: 'Cloud', 'zh-CN': '云端' }
const COMMUNITY: LocalizedText = { en: 'Community', 'zh-CN': '社区' }
const DEVELOPER: LocalizedText = { en: 'Developer', 'zh-CN': '开发者' }
const MODELS_AND_NODES: LocalizedText = {
  en: 'Models & Nodes',
  'zh-CN': '模型与节点'
}
const NEW_BADGE: LocalizedText = { en: 'NEW', 'zh-CN': '新' }
const FEATURED_BADGE: LocalizedText = { en: 'FEATURED', 'zh-CN': '精选' }

function imageFor(fileName: string, alt: LocalizedText) {
  return {
    src: `https://media.comfy.org/website/drops/${fileName}`,
    alt
  }
}

export const drops: readonly Drop[] = [
  {
    id: 'desktop-client',
    badge: NEW_BADGE,
    category: PLATFORM,
    image: imageFor('desktop-client', {
      en: 'New Desktop Client',
      'zh-CN': '新桌面客户端'
    }),
    title: { en: 'New Desktop Client', 'zh-CN': '新桌面客户端' },
    description: {
      en: 'A faster, redesigned desktop app for ComfyUI — one-click install and managed updates.',
      'zh-CN': '更快、重新设计的 ComfyUI 桌面应用程序 — 一键安装与受管更新。'
    },
    cta: {
      label: EXPLORE,
      href: { en: '/download', 'zh-CN': '/zh-CN/download' }
    }
  },
  {
    id: 'app-mode',
    badge: NEW_BADGE,
    category: PLATFORM,
    image: imageFor('app-mode', { en: 'App Mode', 'zh-CN': 'App 模式' }),
    title: { en: 'App Mode', 'zh-CN': 'App 模式' },
    description: {
      en: 'A simplified view of your workflows. Flip back to the node graph anytime to go deeper.',
      'zh-CN': '工作流的简化视图。随时切换回节点图视图以深入了解。'
    },
    // TODO: no destination page yet — link out when App Mode lands.
    cta: {
      label: EXPLORE,
      href: { en: '#', 'zh-CN': '#' }
    }
  },
  {
    id: 'comfy-api',
    badge: NEW_BADGE,
    category: DEVELOPER,
    image: imageFor('comfy-api', { en: 'Comfy API', 'zh-CN': 'Comfy API' }),
    title: { en: 'Comfy API', 'zh-CN': 'Comfy API' },
    description: {
      en: 'Turn any workflow into a production endpoint. Automate generation and scale to thousands of outputs.',
      'zh-CN': '将任意工作流变成生产端点。自动化生成并扩展到数千个输出。'
    },
    cta: {
      label: EXPLORE,
      href: { en: '/api', 'zh-CN': '/zh-CN/api' }
    }
  },
  {
    id: 'comfy-cloud',
    badge: FEATURED_BADGE,
    category: CLOUD,
    image: imageFor('comfy-cloud', {
      en: 'Comfy Cloud',
      'zh-CN': 'Comfy Cloud'
    }),
    title: { en: 'Comfy Cloud', 'zh-CN': 'Comfy Cloud' },
    description: {
      en: 'The full power of ComfyUI from anywhere — no setup, no GPU required.',
      'zh-CN': '随时随地体验 ComfyUI 的全部能力 — 无需配置，无需 GPU。'
    },
    cta: {
      label: EXPLORE,
      href: { en: '/cloud', 'zh-CN': '/zh-CN/cloud' }
    }
  },
  {
    id: 'community-workflows',
    category: COMMUNITY,
    image: imageFor('community-workflows', {
      en: 'Community Workflows on Comfy Hub',
      'zh-CN': 'Comfy Hub 上的社区工作流'
    }),
    title: {
      en: 'Community Workflows on Comfy Hub',
      'zh-CN': 'Comfy Hub 上的社区工作流'
    },
    description: {
      en: 'Browse and remix thousands of community-shared workflows. Start from a proven template.',
      'zh-CN': '浏览和混搭数千个社区共享的工作流。从经过验证的模板开始。'
    },
    cta: {
      label: EXPLORE,
      href: { en: externalLinks.workflows, 'zh-CN': externalLinks.workflows }
    }
  },
  {
    id: 'supported-models',
    category: MODELS_AND_NODES,
    image: imageFor('supported-models', {
      en: 'Supported Models',
      'zh-CN': '支持的模型'
    }),
    title: { en: 'Supported Models', 'zh-CN': '支持的模型' },
    description: {
      en: 'Run the latest open and partner models — every checkpoint, LoRA, and ControlNet, ready to use in your graph.',
      'zh-CN':
        '运行最新的开源和合作伙伴模型 — 每个 checkpoint、LoRA 和 ControlNet 都可直接在工作流中使用。'
    },
    cta: {
      label: EXPLORE,
      href: { en: '/p/supported-models', 'zh-CN': '/zh-CN/p/supported-models' }
    }
  },
  {
    id: 'supported-nodes',
    category: MODELS_AND_NODES,
    image: imageFor('supported-nodes', {
      en: 'Supported Nodes',
      'zh-CN': '支持的节点'
    }),
    title: { en: 'Supported Nodes', 'zh-CN': '支持的节点' },
    description: {
      en: 'Thousands of community and partner nodes, curated and verified to run on Comfy Cloud.',
      'zh-CN':
        '数千个社区与合作伙伴节点，经过精选与验证，可在 Comfy Cloud 上运行。'
    },
    cta: {
      label: EXPLORE,
      href: {
        en: '/cloud/supported-nodes',
        'zh-CN': '/zh-CN/cloud/supported-nodes'
      }
    }
  },
  {
    id: 'comfy-enterprise',
    category: CLOUD,
    image: imageFor('comfy-enterprise', {
      en: 'Comfy Enterprise',
      'zh-CN': 'Comfy 企业版'
    }),
    title: { en: 'Comfy Enterprise', 'zh-CN': 'Comfy 企业版' },
    description: {
      en: 'Enterprise-grade infrastructure for the creative engine inside your organization.',
      'zh-CN': '为您组织内创意引擎提供的企业级基础设施。'
    },
    cta: {
      label: EXPLORE,
      href: { en: '/cloud/enterprise', 'zh-CN': '/zh-CN/cloud/enterprise' }
    }
  },
  {
    id: 'learning-hub',
    category: COMMUNITY,
    image: imageFor('learning-hub', {
      en: 'Learning Hub',
      'zh-CN': '学习中心'
    }),
    title: { en: 'Learning Hub', 'zh-CN': '学习中心' },
    description: {
      en: 'Walkthroughs and ready-to-run workflows to take you from first render to production pipeline.',
      'zh-CN': '配套教程与开箱即用的工作流，带您从第一次渲染走向生产管线。'
    },
    cta: {
      label: EXPLORE,
      href: { en: '/learning', 'zh-CN': '/zh-CN/learning' }
    }
  },
  {
    id: 'share-comfy',
    badge: NEW_BADGE,
    category: COMMUNITY,
    image: imageFor('share-comfy', {
      en: 'Share Comfy with your audience',
      'zh-CN': '与您的受众分享 Comfy'
    }),
    title: {
      en: 'Share Comfy with your audience',
      'zh-CN': '与您的受众分享 Comfy'
    },
    description: {
      en: 'Share Comfy with your audience and earn for every creator you bring on board.',
      'zh-CN': '与您的受众分享 Comfy，为您带来的每一位创作者获得回报。'
    },
    // /affiliates is locale-invariant: same URL in both locales.
    cta: {
      label: EXPLORE,
      href: { en: '/affiliates', 'zh-CN': '/affiliates' }
    }
  }
]
