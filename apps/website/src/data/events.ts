import { externalLinks, getRoutes } from '../config/routes'
import type { LocalizedText } from '../i18n/translations'

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

const launchesHref: LocalizedText = {
  en: getRoutes('en').launches,
  'zh-CN': getRoutes('zh-CN').launches
}

// zh-CN copy is a first pass and pending native review.
export const upcomingEvents: readonly UpcomingEvent[] = [
  {
    id: 'july-launches',
    name: { en: 'July Launches', 'zh-CN': '七月发布' },
    description: {
      en: 'Our monthly livestream covering the latest ComfyUI launches and updates.',
      'zh-CN': '我们的月度直播，介绍 ComfyUI 最新发布与更新。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'July 29, 2026 · 10AM PT',
      'zh-CN': '2026年7月29日 · 上午10点（PT）'
    },
    dateTime: '2026-07-29T10:00:00-07:00',
    link: { href: launchesHref }
  }
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
