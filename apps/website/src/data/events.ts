import type { LocalizedText } from '../i18n/translations'

type EventCategory = 'livestream' | 'hackathon' | 'community'

type EventMedia =
  | { type: 'image'; src: string; alt: LocalizedText }
  | { type: 'video'; src: string; alt: LocalizedText; poster?: string }

export type FeaturedEvent = {
  id: string
  eyebrow: LocalizedText
  title: LocalizedText
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
  description: LocalizedText
  media: EventMedia
  watch: { href: LocalizedText }
  youtubeVideoId?: string
  publishedDate: string
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

const foundersLiveStreamHref: LocalizedText = {
  en: 'https://www.youtube.com/live/dbp5Jnto7S8',
  'zh-CN': 'https://www.youtube.com/live/dbp5Jnto7S8'
}

function youtubeWatchHref(videoId: string): LocalizedText {
  const href = `https://www.youtube.com/watch?v=${videoId}`
  return { en: href, 'zh-CN': href }
}

export const pastEventPath = (event: PastEvent): string => `/events/${event.id}`

// Referenced by both the hero carousel and the past-events grid.
const blackMathHackathon: PastEvent = {
  id: 'black-math-hackathon',
  category: 'livestream',
  title: {
    en: 'Experience Design: How Black Math Built a Hackathon in 3 Weeks with ComfyUI',
    'zh-CN': '体验设计：Black Math 如何用 ComfyUI 在 3 周内打造一场黑客松'
  },
  description: {
    en: 'Design and technology studio Black Math used ComfyUI to build a full hackathon experience in just three weeks. Jeremy Sahlman (Co-Founder & Chief Creative Officer, Black Math) shares how.',
    'zh-CN':
      '设计与技术工作室 Black Math 用 ComfyUI 在短短三周内打造了一场完整的黑客松体验。Jeremy Sahlman（Black Math 联合创始人兼首席创意官）分享幕后故事。'
  },
  media: eventImage('black-math_comfy.png', {
    en: 'Black Math X Comfy livestream with Jeremy Sahlman',
    'zh-CN': 'Black Math X Comfy 直播，嘉宾 Jeremy Sahlman'
  }),
  watch: { href: youtubeWatchHref('O72yyU-jupU') },
  youtubeVideoId: 'O72yyU-jupU',
  publishedDate: '2026-07-23'
}

const foundersLiveFeatured: FeaturedEvent = {
  id: 'krea-founders-live',
  eyebrow: UPCOMING_LIVESTREAM,
  title: {
    en: 'Krea X Comfy: Founders Live',
    'zh-CN': 'Krea X Comfy：创始人直播'
  },
  // The video artwork already carries the title.
  showTitle: false,
  media: eventVideo(
    'founders-live.mp4',
    {
      en: 'Krea X Comfy Founders Live',
      'zh-CN': 'Krea X Comfy 创始人直播'
    },
    'founders-live-thumb.png'
  ),
  href: foundersLiveStreamHref
}

const blackMathFeatured: FeaturedEvent = {
  id: blackMathHackathon.id,
  eyebrow: { en: 'LIVESTREAM', 'zh-CN': '直播' },
  title: blackMathHackathon.title,
  // The artwork already carries the title, date, and speaker.
  showTitle: false,
  media: eventImage('july-launches.jpg', {
    en: 'July Launches livestream',
    'zh-CN': '七月发布直播'
  }),
  href: {
    en: 'https://www.youtube.com/live/8RGN69h_xTU',
    'zh-CN': 'https://www.youtube.com/live/8RGN69h_xTU'
  }
}

export const featuredEvents: readonly FeaturedEvent[] = [
  foundersLiveFeatured,
  blackMathFeatured
]

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
    link: {
      href: {
        en: 'https://www.youtube.com/live/8RGN69h_xTU',
        'zh-CN': 'https://www.youtube.com/live/8RGN69h_xTU'
      }
    }
  }
]

const pastEventEntries: readonly PastEvent[] = [
  blackMathHackathon,
  {
    id: 'comfy-mcp-claude-cursor',
    category: 'livestream',
    title: {
      en: 'Run ComfyUI From Claude/Cursor with Comfy MCP',
      'zh-CN': '通过 Comfy MCP 在 Claude/Cursor 中运行 ComfyUI'
    },
    description: {
      en: 'Comfy MCP lets Claude, Cursor, and almost any AI agent you already use build, run, and iterate real Comfy Cloud workflows for you. Join Jo Zhang for a live walkthrough.',
      'zh-CN':
        'Comfy MCP 让 Claude、Cursor 以及几乎所有你正在使用的 AI 智能体为你构建、运行并迭代真实的 Comfy Cloud 工作流。欢迎观看 Jo Zhang 的现场演示。'
    },
    media: eventImage('mcp.jpg', {
      en: 'Run ComfyUI From Claude/Cursor with Comfy MCP livestream recording',
      'zh-CN': '通过 Comfy MCP 在 Claude/Cursor 中运行 ComfyUI 的直播回放'
    }),
    watch: { href: youtubeWatchHref('sX2sJ5-4MS4') },
    youtubeVideoId: 'sX2sJ5-4MS4',
    publishedDate: '2026-07-15'
  },
  {
    id: 'production-pipeline',
    category: 'livestream',
    title: {
      en: 'Reinventing the Production Pipeline',
      'zh-CN': '重塑生产流水线'
    },
    description: {
      en: 'Erin Sarofsky (COO/Owner, Sarofsky) and Ryan Summers (Head of Creative Innovation, Sarofsky) share how their team used ComfyUI to reinvent the studio production pipeline.',
      'zh-CN':
        'Erin Sarofsky（Sarofsky COO/创始人）与 Ryan Summers（Sarofsky 创意创新负责人）分享他们的团队如何用 ComfyUI 重塑工作室的生产流水线。'
    },
    media: eventImage('reinventing-the.jpg', {
      en: 'Reinventing the Production Pipeline livestream recording',
      'zh-CN': '重塑生产流水线直播回放'
    }),
    watch: { href: youtubeWatchHref('dsYggO4lsSo') },
    youtubeVideoId: 'dsYggO4lsSo',
    publishedDate: '2026-07-08'
  },
  {
    id: 'june-launches',
    category: 'livestream',
    title: {
      en: 'June Launches | Desktop, MCP & Core Engine Improvements',
      'zh-CN': '六月发布 | 桌面版、MCP 与核心引擎改进'
    },
    description: {
      en: 'Your front-row seat to everything we shipped in June: product leaders Jedrzej Kosinski, Alexis Rolland, Jo Zhang, and Matt Miller walk through desktop, MCP, and core engine improvements.',
      'zh-CN':
        '第一时间了解我们六月发布的所有内容：产品负责人 Jedrzej Kosinski、Alexis Rolland、Jo Zhang 和 Matt Miller 介绍桌面版、MCP 与核心引擎改进。'
    },
    media: eventImage('june-launch.jpg', {
      en: 'June Launches livestream recording',
      'zh-CN': '六月发布直播回放'
    }),
    watch: { href: youtubeWatchHref('yo7b_zHd20g') },
    youtubeVideoId: 'yo7b_zHd20g',
    publishedDate: '2026-06-29'
  },
  {
    id: 'krea-founders-live',
    category: 'livestream',
    title: {
      en: 'Krea X Comfy: Founders Live',
      'zh-CN': 'Krea X Comfy：创始人直播'
    },
    description: {
      en: 'A special live conversation with Victor Perez (CEO, Krea), Miguel Lara (Krea team), and ComfyAnonymous (Co-Founder, Comfy Org) on building creative AI tools.',
      'zh-CN':
        '与 Victor Perez（Krea CEO）、Miguel Lara（Krea 团队）以及 ComfyAnonymous（Comfy Org 联合创始人）的特别直播对谈，聊聊创意 AI 工具的打造。'
    },
    media: eventImage('krea.jpg', {
      en: 'Krea X Comfy Founders Live recording',
      'zh-CN': 'Krea X Comfy 创始人直播回放'
    }),
    watch: { href: youtubeWatchHref('31jiUhCEjJ4') },
    youtubeVideoId: '31jiUhCEjJ4',
    publishedDate: '2026-06-24'
  }
]

// Newest recording first, regardless of entry order above.
export const pastEvents: readonly PastEvent[] = [...pastEventEntries].sort(
  (a, b) => b.publishedDate.localeCompare(a.publishedDate)
)

// Past events that have a recording and therefore their own /events/[slug]
// page; the slug is the event id.
export const watchablePastEvents: readonly PastEvent[] = pastEvents.filter(
  (event) => event.youtubeVideoId
)

export const getPastEventBySlug = (slug: string): PastEvent | undefined =>
  watchablePastEvents.find((event) => event.id === slug)
