import type { LocalizedText } from '../i18n/translations'

interface AudienceCriterion {
  id: string
  label: LocalizedText
}

export const affiliateAudienceCriteria: readonly AudienceCriterion[] = [
  {
    id: 'tutorial-creator',
    label: {
      en: 'A ComfyUI tutorial creator or workflow builder',
      'zh-CN': 'ComfyUI 教程作者或工作流创建者',
      ja: 'ComfyUIのチュートリアル制作者またはワークフロービルダー' /* machine */
    }
  },
  {
    id: 'ai-tool-reviewer',
    label: {
      en: 'An AI tool reviewer on YouTube, TikTok, blogs',
      'zh-CN': '在 YouTube、TikTok、博客上做 AI 工具测评',
      ja: 'YouTube、TikTok、ブログで活動するAIツールレビュアー' /* machine */
    }
  },
  {
    id: 'tech-blogger',
    label: {
      en: 'A tech blogger covering AI creative tools',
      'zh-CN': '报道 AI 创作工具的科技博主',
      ja: 'AIクリエイティブツールを扱うテックブロガー' /* machine */
    }
  },
  {
    id: 'newsletter-operator',
    label: {
      en: 'A newsletter operator in the AI/creative space',
      'zh-CN': 'AI／创意领域的简报运营者',
      ja: 'AI／クリエイティブ分野のニュースレター運営者' /* machine */
    }
  },
  {
    id: 'audience-owner',
    label: {
      en: 'Anyone with an audience interested in AI image, video, or 3D',
      'zh-CN': '拥有关注 AI 图像、视频或 3D 受众的任何人',
      ja: 'AI画像・動画・3Dに関心のあるオーディエンスを持つ方' /* machine */
    }
  }
] as const
