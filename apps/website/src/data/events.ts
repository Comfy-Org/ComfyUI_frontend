import type { EventItem } from '../components/common/EventsSection.vue'

export const learningEvents: readonly EventItem[] = [
  {
    label: { en: 'Live Stream:', 'zh-CN': '直播：' },
    title: {
      en: 'Zero to Node: Building Your First Workflow',
      'zh-CN': '从零到节点：构建你的第一个工作流'
    },
    cta: { en: 'Link', 'zh-CN': '链接' },
    href: '#'
  },
  {
    label: { en: 'Event 1', 'zh-CN': '活动 1' },
    title: {
      en: 'Lorem ipsum dollar sita met',
      'zh-CN': '此处为活动描述的占位文本'
    },
    cta: { en: 'London, UK', 'zh-CN': '英国伦敦' },
    href: '#'
  },
  {
    label: { en: 'Event 2', 'zh-CN': '活动 2' },
    title: {
      en: 'Lorem ipsum dollar sita met',
      'zh-CN': '此处为活动描述的占位文本'
    },
    cta: { en: 'San Francisco', 'zh-CN': '旧金山' },
    href: '#'
  }
] as const
