import type { LocalizedText } from '../i18n/translations'

interface AffiliateBenefit {
  id: string
  description: LocalizedText
}

export const affiliateBenefits: readonly AffiliateBenefit[] = [
  {
    id: 'open-source-platform',
    description: {
      en: 'ComfyUI is the most powerful open-source AI creative platform',
      'zh-CN': 'ComfyUI 是最强大的开源 AI 创作平台'
    }
  },
  {
    id: 'cloud-no-gpu',
    description: {
      en: 'Comfy Cloud lets you run ComfyUI in the browser, no GPU needed, all models pre-loaded',
      'zh-CN':
        'Comfy Cloud 让你在浏览器中运行 ComfyUI，无需 GPU，所有模型预加载'
    }
  },
  {
    id: 'node-based-control',
    description: {
      en: 'Node-based workflows give users full creative control unlike prompt-only tools',
      'zh-CN':
        '基于节点的工作流让用户拥有完整的创作控制力，区别于仅靠提示词的工具'
    }
  },
  {
    id: 'custom-nodes',
    description: {
      en: '1,000+ community custom node packages',
      'zh-CN': '1,000+ 社区自定义节点包'
    }
  }
] as const
