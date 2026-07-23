import type { EventItem } from '../components/common/EventsSection.vue'
import { externalLinks } from '../config/routes'
import type { LocalizedText } from '../i18n/translations'

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

// Events page (/events) data.
// Past-event thumbnails are live at media.comfy.org/website/events/<file>.
// Featured/upcoming media, real event links, and native zh-CN review are
// pending follow-ups.

type EventCategory = 'livestream' | 'hackathon' | 'community'

type EventMedia =
  | { type: 'image'; src: string; alt: LocalizedText }
  | { type: 'video'; src: string; alt: LocalizedText; poster?: string }

export type FeaturedEvent = {
  id: string
  eyebrow: LocalizedText
  title: LocalizedText
  // Designer-requested toggle: hide the text overlay when the artwork
  // already carries the event title.
  showTitle: boolean
  media: EventMedia
  href?: LocalizedText
}

export type UpcomingEvent = {
  id: string
  name: LocalizedText
  description: LocalizedText
  location: LocalizedText
  dateLabel: LocalizedText
  dateTime?: string
  link: { href: LocalizedText }
}

export type PastEvent = {
  id: string
  category: EventCategory
  title: LocalizedText
  media: EventMedia
  watch: { href: LocalizedText }
}

const UPCOMING_LIVESTREAM: LocalizedText = {
  en: 'UPCOMING LIVESTREAM',
  'zh-CN': '即将直播'
}

function eventImage(fileName: string, alt: LocalizedText): EventMedia {
  return {
    type: 'image',
    src: `https://media.comfy.org/website/events/${fileName}`,
    alt
  }
}

function eventVideo(
  fileName: string,
  alt: LocalizedText,
  posterFileName?: string
): EventMedia {
  return {
    type: 'video',
    src: `https://media.comfy.org/website/events/${fileName}`,
    alt,
    ...(posterFileName && {
      poster: `https://media.comfy.org/website/events/${posterFileName}`
    })
  }
}

const youtubeHref: LocalizedText = {
  en: externalLinks.youtube,
  'zh-CN': externalLinks.youtube
}

const foundersLiveFeatured: FeaturedEvent = {
  id: 'krea-founders-live',
  eyebrow: UPCOMING_LIVESTREAM,
  title: {
    en: 'Krea X Comfy: Founders Live',
    'zh-CN': 'Krea X Comfy：创始人直播'
  },
  showTitle: true,
  media: eventVideo(
    'founders-live.mp4',
    {
      en: 'Krea X Comfy Founders Live',
      'zh-CN': 'Krea X Comfy 创始人直播'
    },
    'founders-live-thumb.png'
  ),
  href: youtubeHref
}

export const featuredEvents: readonly FeaturedEvent[] = [
  foundersLiveFeatured,
  // TODO: placeholder duplicate so the carousel keeps its controls — replace
  // with the real second featured event once its assets are ready.
  { ...foundersLiveFeatured, id: 'krea-founders-live-placeholder' }
]

// TODO: placeholder rows — replace with real upcoming events. Copy, location,
// dates, and links are all intentionally generic so it's obvious they need
// filling in.
const upcomingEventPlaceholder: Omit<UpcomingEvent, 'id'> = {
  name: { en: 'Event name', 'zh-CN': '活动名称' },
  description: {
    en: 'Description here fpo orem ipsum dolar sit amcription here fpolorem…',
    'zh-CN': '活动描述占位文本，此处填写活动的简要说明……'
  },
  location: {
    en: 'Location, State, Country',
    'zh-CN': '地点、州/省、国家'
  },
  dateLabel: { en: 'Month, Date, Year', 'zh-CN': '年月日' },
  link: { href: { en: '#', 'zh-CN': '#' } }
}

export const upcomingEvents: readonly UpcomingEvent[] = [
  { ...upcomingEventPlaceholder, id: 'upcoming-placeholder-1' },
  { ...upcomingEventPlaceholder, id: 'upcoming-placeholder-2' },
  { ...upcomingEventPlaceholder, id: 'upcoming-placeholder-3' },
  { ...upcomingEventPlaceholder, id: 'upcoming-placeholder-4' }
]

export const pastEvents: readonly PastEvent[] = [
  {
    id: 'comfy-mcp-claude-cursor',
    category: 'livestream',
    title: {
      en: 'Run ComfyUI From Claude/Cursor with Comfy MCP',
      'zh-CN': '通过 Comfy MCP 在 Claude/Cursor 中运行 ComfyUI'
    },
    media: eventImage('mcp.jpg', {
      en: 'Run ComfyUI From Claude/Cursor with Comfy MCP livestream recording',
      'zh-CN': '通过 Comfy MCP 在 Claude/Cursor 中运行 ComfyUI 的直播回放'
    }),
    watch: { href: youtubeHref }
  },
  {
    id: 'production-pipeline',
    category: 'livestream',
    title: {
      en: 'Reinventing the Production Pipeline',
      'zh-CN': '重塑生产流水线'
    },
    media: eventImage('reinventing-the.jpg', {
      en: 'Reinventing the Production Pipeline livestream recording',
      'zh-CN': '重塑生产流水线直播回放'
    }),
    watch: { href: youtubeHref }
  },
  {
    id: 'june-launches',
    category: 'livestream',
    title: {
      en: 'June Launches | Desktop, MCP & Core Engine Improvements',
      'zh-CN': '六月发布 | 桌面版、MCP 与核心引擎改进'
    },
    media: eventImage('june-launch.jpg', {
      en: 'June Launches livestream recording',
      'zh-CN': '六月发布直播回放'
    }),
    watch: { href: youtubeHref }
  },
  {
    id: 'krea-founders-live',
    category: 'livestream',
    title: {
      en: 'Krea X Comfy: Founders Live',
      'zh-CN': 'Krea X Comfy：创始人直播'
    },
    media: eventImage('krea.jpg', {
      en: 'Krea X Comfy Founders Live recording',
      'zh-CN': 'Krea X Comfy 创始人直播回放'
    }),
    watch: { href: youtubeHref }
  }
]
