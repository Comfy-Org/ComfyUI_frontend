// Image URLs are placeholders at media.comfy.org/website/drops/<id>.png —
// asset uploads and native zh-CN review are pending follow-ups (see
// apps/website/.scratch/drops-page/PRD.md).
import { LOCALE_CODES } from '../config/locales'
import { externalLinks, localizeHref } from '../config/routes'
import type { LocalizedText } from '../i18n/translations'

/**
 * One path, resolved to every locale's URL through the route table.
 *
 * Each locale's URL used to be typed by hand beside the English one, and two of
 * the seven were wrong: `/zh-CN/enterprise` and `/zh-CN/p/supported-models` have
 * never existed, so the Chinese launches page shipped two dead links. Japanese
 * had no URL at all. Deriving them means a link can only point where the locale
 * actually serves, and a new language needs no edit here.
 */
function localizedHref(path: string): LocalizedText {
  const href: LocalizedText = { en: localizeHref(path) }
  for (const locale of LOCALE_CODES) href[locale] = localizeHref(path, locale)
  return href
}

type DropMedia =
  | { type: 'image'; src: string; alt: LocalizedText }
  | { type: 'video'; src: string; alt: LocalizedText; poster?: string }

export type Drop = {
  id: string
  badge?: LocalizedText
  category: LocalizedText
  media: DropMedia
  title: LocalizedText
  description: LocalizedText
  cta: { label: LocalizedText; href: LocalizedText }
}

const EXPLORE: LocalizedText = {
  en: 'EXPLORE',
  'zh-CN': '探索',
  ja: '探索' /* machine */
}
const PLATFORM: LocalizedText = {
  en: 'Platform',
  'zh-CN': '平台',
  ja: 'プラットフォーム' /* machine */
}
const CLOUD: LocalizedText = {
  en: 'Cloud',
  'zh-CN': '云端',
  ja: 'クラウド' /* machine */
}
const COMMUNITY: LocalizedText = {
  en: 'Community',
  'zh-CN': '社区',
  ja: 'コミュニティ' /* machine */
}
const DEVELOPER: LocalizedText = {
  en: 'Developer',
  'zh-CN': '开发者',
  ja: '開発者' /* machine */
}
const MODELS_AND_NODES: LocalizedText = {
  en: 'Models & Nodes',
  'zh-CN': '模型与节点',
  ja: 'モデルとノード' /* machine */
}
const NEW_BADGE: LocalizedText = {
  en: 'NEW',
  'zh-CN': '新',
  ja: '新着' /* machine */
}

function imageFor(fileName: string, alt: LocalizedText): DropMedia {
  return {
    type: 'image',
    src: `https://media.comfy.org/website/drops/${fileName}`,
    alt
  }
}

function videoFor(
  fileName: string,
  alt: LocalizedText,
  poster?: string
): DropMedia {
  return {
    type: 'video',
    src: `https://media.comfy.org/website/drops/${fileName}`,
    alt,
    ...(poster && {
      poster: `https://media.comfy.org/website/drops/${poster}`
    })
  }
}

export const drops: readonly Drop[] = [
  {
    id: 'comfy-cloud-nodes',
    badge: NEW_BADGE,
    category: MODELS_AND_NODES,
    media: imageFor('Drops_2x2card_CloudNodes.jpg', {
      en: 'Comfy Cloud Nodes',
      'zh-CN': 'Comfy Cloud 节点',
      ja: 'Comfy Cloud ノード' /* machine */
    }),
    title: {
      en: 'Comfy Cloud Nodes',
      'zh-CN': 'Comfy Cloud 节点',
      ja: 'Comfy Cloud ノード' /* machine */
    },
    description: {
      en: 'Run the newest open models on our GPUs from inside your own ComfyUI. No subscription, no downloads.',
      'zh-CN':
        '在你自己的 ComfyUI 中，用我们的 GPU 运行最新的开源模型。无需订阅，无需下载。',
      ja: 'ご自身のComfyUI内から、当社のGPUで最新のオープンモデルを実行できます。サブスクリプションもダウンロードも不要です。' /* machine */
    },
    cta: {
      label: EXPLORE,
      href: {
        en: '/cloud-nodes',
        'zh-CN': '/zh-CN/cloud-nodes',
        // Japanese publishes tier 1 only, and /cloud-nodes is not in it, so the
        // link stays on the English page rather than pointing at a URL that is
        // built but held back.
        ja: '/cloud-nodes'
      }
    }
  },
  {
    id: 'desktop-client',
    badge: NEW_BADGE,
    category: PLATFORM,
    media: imageFor('Drops_2x2card_Desktop.jpg', {
      en: 'New Desktop Client',
      'zh-CN': '新桌面客户端',
      ja: '新しいデスクトップクライアント' /* machine */
    }),
    title: {
      en: 'New Desktop Client',
      'zh-CN': '新桌面客户端',
      ja: '新しいデスクトップクライアント' /* machine */
    },
    description: {
      en: 'A faster, redesigned desktop app for ComfyUI — one-click install and managed updates.',
      'zh-CN': '更快、重新设计的 ComfyUI 桌面应用程序 — 一键安装与受管更新。',
      ja: 'ComfyUI向けに再設計された高速デスクトップアプリ。ワンクリックでインストールでき、アップデートも管理されます。' /* machine */
    },
    cta: {
      label: EXPLORE,
      href: localizedHref('/download')
    }
  },
  {
    id: 'comfy-mcp',
    badge: NEW_BADGE,
    category: CLOUD,
    media: imageFor('Drops_2x2card_MCP.jpg', {
      en: 'Comfy MCP',
      'zh-CN': 'Comfy MCP',
      ja: 'Comfy MCP' /* machine */
    }),
    title: {
      en: 'Comfy MCP',
      'zh-CN': 'Comfy MCP',
      ja: 'Comfy MCP' /* machine */
    },
    description: {
      en: 'The full power of ComfyUI from anywhere — no setup, no GPU required.',
      'zh-CN': '随时随地体验 ComfyUI 的全部能力 — 无需配置，无需 GPU。',
      ja: 'どこからでもComfyUIの全機能を利用。セットアップ不要、GPU不要。' /* machine */
    },
    cta: {
      label: EXPLORE,
      href: localizedHref('/mcp')
    }
  },
  {
    id: 'app-mode',
    badge: NEW_BADGE,
    category: PLATFORM,
    media: videoFor('Drops_2x2card_APP.mp4', {
      en: 'App Mode',
      'zh-CN': 'App 模式',
      ja: 'アプリモード' /* machine */
    }),
    title: {
      en: 'App Mode',
      'zh-CN': 'App 模式',
      ja: 'アプリモード' /* machine */
    },
    description: {
      en: 'A simplified view of your workflows. Flip back to the node graph anytime to go deeper.',
      'zh-CN': '工作流的简化视图。随时切换回节点图视图以深入了解。',
      ja: 'ワークフローをシンプルに表示。いつでもノードグラフに戻って、さらに詳しく作業できます。' /* machine */
    },
    // TODO: no destination page yet — link out when App Mode lands.
    cta: {
      label: EXPLORE,
      // Not `localizedHref`: the docs site carries its own locale segment, so
      // each language points at a different external page rather than at a
      // prefixed version of this site's. Japanese has no docs translation yet
      // and falls back to English, matching how `t()` resolves.
      href: {
        en: 'https://docs.comfy.org/interface/app-mode',
        'zh-CN': 'https://docs.comfy.org/zh/interface/app-mode',
        ja: 'https://docs.comfy.org/interface/app-mode'
      }
    }
  },
  {
    id: 'comfy-api',
    badge: NEW_BADGE,
    category: DEVELOPER,
    media: imageFor('Drops_2x2card_API.jpg', {
      en: 'Comfy API',
      'zh-CN': 'Comfy API',
      ja: 'Comfy API' /* machine */
    }),
    title: {
      en: 'Developer Platform',
      'zh-CN': '开发者平台',
      ja: '開発者向けプラットフォーム' /* machine */
    },
    description: {
      en: 'Turn any workflow into a production endpoint. Automate generation and scale to thousands of outputs.',
      'zh-CN': '将任意工作流变成生产端点。自动化生成并扩展到数千个输出。',
      ja: 'あらゆるワークフローを本番環境のエンドポイントに。生成を自動化し、数千件の出力まで拡張できます。' /* machine */
    },
    cta: {
      label: EXPLORE,
      href: localizedHref('/platform')
    }
  },
  {
    id: 'community-workflows',
    category: COMMUNITY,
    media: imageFor('Drops_3x3card_Comm Workflows.jpg', {
      en: 'Community Workflows',
      'zh-CN': '社区工作流',
      ja: 'コミュニティワークフロー' /* machine */
    }),
    title: {
      en: 'Community Workflows',
      'zh-CN': '社区工作流',
      ja: 'コミュニティワークフロー' /* machine */
    },
    description: {
      en: 'Browse and remix thousands of community-shared workflows. Start from a proven template.',
      'zh-CN': '浏览和混搭数千个社区共享的工作流。从经过验证的模板开始。',
      ja: 'コミュニティ共有の数千のワークフローを閲覧・リミックス。実証済みのテンプレートから始められます。' /* machine */
    },
    cta: {
      label: EXPLORE,
      href: localizedHref(externalLinks.workflows)
    }
  },
  {
    id: 'supported-models',
    category: MODELS_AND_NODES,
    media: imageFor('Drops_Supported models.jpg', {
      en: 'Supported Models',
      'zh-CN': '支持的模型',
      ja: '対応モデル' /* machine */
    }),
    title: {
      en: 'Supported Models',
      'zh-CN': '支持的模型',
      ja: '対応モデル' /* machine */
    },
    description: {
      en: 'Run the latest open and partner models — every checkpoint, LoRA, and ControlNet, ready to use in your graph.',
      'zh-CN':
        '运行最新的开源和合作伙伴模型 — 每个 checkpoint、LoRA 和 ControlNet 都可直接在工作流中使用。',
      ja: '最新のオープンモデルとパートナーモデルを実行。すべてのチェックポイント、LoRA、ControlNetをグラフですぐに使用できます。' /* machine */
    },
    cta: {
      label: EXPLORE,
      href: localizedHref('/p/supported-models')
    }
  },
  {
    id: 'supported-nodes',
    category: MODELS_AND_NODES,
    media: videoFor('Drops_3x3card_supported nodes.mp4', {
      en: 'Supported Nodes',
      'zh-CN': '支持的节点',
      ja: '対応ノード' /* machine */
    }),
    title: {
      en: 'Supported Nodes',
      'zh-CN': '支持的节点',
      ja: '対応ノード' /* machine */
    },
    description: {
      en: 'Thousands of community and partner nodes, curated and verified to run on Comfy Cloud.',
      'zh-CN':
        '数千个社区与合作伙伴节点，经过精选与验证，可在 Comfy Cloud 上运行。',
      ja: 'Comfy Cloudで動作することを確認済みの、厳選された数千のコミュニティ・パートナーノード。' /* machine */
    },
    cta: {
      label: EXPLORE,
      href: localizedHref('/cloud/supported-nodes')
    }
  },
  {
    id: 'comfy-enterprise',
    category: CLOUD,
    media: imageFor('Drops_3x3card_enterprise.png', {
      en: 'Comfy Enterprise',
      'zh-CN': 'Comfy 企业版',
      ja: 'Comfy エンタープライズ' /* machine */
    }),
    title: {
      en: 'Comfy Enterprise',
      'zh-CN': 'Comfy 企业版',
      ja: 'Comfy エンタープライズ' /* machine */
    },
    description: {
      en: 'Enterprise-grade infrastructure for the creative engine inside your organization.',
      'zh-CN': '为您组织内创意引擎提供的企业级基础设施。',
      ja: '組織内のクリエイティブエンジンを支えるエンタープライズ向けインフラストラクチャ。' /* machine */
    },
    cta: {
      label: EXPLORE,
      href: localizedHref('/enterprise')
    }
  },
  {
    id: 'learning-hub',
    category: COMMUNITY,
    media: imageFor('Drops_3x3_Learninghub.jpg', {
      en: 'Learning Hub',
      'zh-CN': '学习中心',
      ja: 'ラーニングハブ' /* machine */
    }),
    title: {
      en: 'Learning Hub',
      'zh-CN': '学习中心',
      ja: 'ラーニングハブ' /* machine */
    },
    description: {
      en: 'Walkthroughs and ready-to-run workflows to take you from first render to production pipeline.',
      'zh-CN': '配套教程与开箱即用的工作流，带您从第一次渲染走向生产管线。',
      ja: '初回レンダリングから本番パイプラインまで導く、解説とすぐに実行できるワークフロー。' /* machine */
    },
    cta: {
      label: {
        en: 'START LEARNING',
        'zh-CN': '开始学习',
        ja: '学習を始める' /* machine */
      },
      href: localizedHref('/learning')
    }
  },
  {
    id: 'share-comfy',
    badge: NEW_BADGE,
    category: COMMUNITY,
    media: videoFor('Drops_3x3card_Affilliate.mp4', {
      en: 'Comfy Affiliate',
      'zh-CN': 'Comfy Affiliate',
      ja: 'Comfy アフィリエイト' /* machine */
    }),
    title: {
      en: 'Comfy Affiliate',
      'zh-CN': 'Comfy Affiliate',
      ja: 'Comfy アフィリエイト' /* machine */
    },
    description: {
      en: 'Share Comfy with your audience and earn for every creator you bring on board.',
      'zh-CN': '与您的受众分享 Comfy，为您带来的每一位创作者获得回报。',
      ja: 'Comfyをオーディエンスに紹介し、参加したクリエイターごとに報酬を獲得。' /* machine */
    },
    // /affiliates is locale-invariant: same URL in both locales.
    cta: {
      label: {
        en: 'LEARN MORE',
        'zh-CN': '了解更多',
        ja: '詳細を見る' /* machine */
      },
      href: localizedHref('/affiliates')
    }
  }
]
