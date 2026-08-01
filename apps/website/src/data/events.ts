import { localizeHref } from '../config/routes'
import type { Locale, LocalizedText } from '../i18n/translations'
import type { CalendarEvent } from '../utils/calendar'
import type { JsonLdNode } from '../utils/jsonLd'
import { absoluteUrl, eventNode, jsonLdId } from '../utils/jsonLd'

type EventCategory = 'livestream' | 'hackathon' | 'community'

type EventMedia =
  | { type: 'image'; src: string; alt: LocalizedText }
  | { type: 'video'; src: string; alt: LocalizedText; poster?: string }

export type ComfyEvent = {
  id: string
  category: EventCategory
  title: LocalizedText
  description: LocalizedText
  location?: LocalizedText
  /** Hand-written display date shown on upcoming rows. */
  dateLabel?: LocalizedText
  /** ISO start; drives upcoming/past classification, past-section sort order,
   * and VideoObject uploadDate. Approximate (set to the recording's publish
   * date) for events that predate this field. */
  startDateTime: string
  /** Defaults to one hour after the start. */
  endDateTime?: string
  /** External target used when the event has no /events/[slug] page. */
  link?: { href: LocalizedText; newTab?: boolean }
  /** Past-gallery card art. */
  media?: EventMedia
  liveVideoId?: string
  /** Supersedes liveVideoId once the recording is published. */
  recordingVideoId?: string
  featured?: {
    order: number
    media: EventMedia
    autoplayMs?: number
    showTitle?: boolean
  }
}

export type FeaturedEvent = {
  id: string
  eyebrow?: LocalizedText
  title: LocalizedText
  showTitle: boolean
  media: EventMedia
  href?: LocalizedText
  newTab?: boolean
  autoplayMs?: number
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

const launchesHref: LocalizedText = {
  en: localizeHref('/launches', 'en'),
  'zh-CN': localizeHref('/launches', 'zh-CN')
}

export function youtubeWatchHref(videoId: string): LocalizedText {
  const href = `https://www.youtube.com/watch?v=${videoId}`
  return { en: href, 'zh-CN': href }
}

export const eventPath = (event: { id: string }): string =>
  `/events/${event.id}`

function eventPageHref(id: string): LocalizedText {
  return {
    en: localizeHref(eventPath({ id }), 'en'),
    'zh-CN': localizeHref(eventPath({ id }), 'zh-CN')
  }
}

export const eventVideoId = (event: ComfyEvent): string | undefined =>
  event.recordingVideoId ?? event.liveVideoId

const EVENT_DURATION_MS = 60 * 60 * 1000
const SITE_ORIGIN = 'https://comfy.org'

export function toCalendarEvent(
  event: ComfyEvent,
  locale: Locale
): CalendarEvent {
  const target = eventVideoId(event)
    ? eventPageHref(event.id)[locale]
    : (event.link?.href[locale] ?? eventPageHref(event.id)[locale])
  const href = new URL(target, SITE_ORIGIN).href
  const start = new Date(event.startDateTime)
  return {
    title: event.title[locale],
    description: `${event.description[locale]}\n\n${href}`,
    location: event.location?.[locale] ?? '',
    start,
    end: eventEnd(event)
  }
}

export function eventJsonLdNode(
  event: ComfyEvent,
  input: {
    siteUrl: string
    site: URL | undefined
    pageUrl: string
    locale: Locale
  }
): JsonLdNode {
  const { siteUrl, site, pageUrl, locale } = input
  const href =
    event.link?.href[locale] ?? localizeHref(eventPath(event), locale)
  const online = event.location?.en === 'Online'
  return eventNode({
    siteUrl,
    id: jsonLdId(pageUrl, `event-${event.id}`),
    name: event.title[locale],
    description: event.description[locale],
    startDate: event.startDateTime,
    ...(online
      ? { virtualUrl: href.startsWith('/') ? absoluteUrl(site, href) : href }
      : { placeName: event.location?.[locale] }),
    locale
  })
}

function eventEnd(event: ComfyEvent): Date {
  if (event.endDateTime) return new Date(event.endDateTime)
  return new Date(new Date(event.startDateTime).getTime() + EVENT_DURATION_MS)
}

export type EventStatus = 'upcoming' | 'past'

export function eventStatus(event: ComfyEvent, now: Date): EventStatus {
  return now.getTime() >= eventEnd(event).getTime() ? 'past' : 'upcoming'
}

export function deriveUpcomingEvents(
  events: readonly ComfyEvent[],
  now: Date
): readonly ComfyEvent[] {
  return events
    .filter((event) => eventStatus(event, now) === 'upcoming')
    .sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime))
}

export function derivePastEvents(
  events: readonly ComfyEvent[],
  now: Date
): readonly ComfyEvent[] {
  return events
    .filter((event) => eventStatus(event, now) === 'past')
    .sort((a, b) => Date.parse(b.startDateTime) - Date.parse(a.startDateTime))
}

export function deriveFeaturedEvents(
  events: readonly ComfyEvent[],
  now: Date
): readonly FeaturedEvent[] {
  return events
    .flatMap((event) =>
      event.featured ? [{ event, featured: event.featured }] : []
    )
    .sort((a, b) => a.featured.order - b.featured.order)
    .map(({ event, featured }) => ({
      id: event.id,
      eyebrow:
        eventStatus(event, now) === 'upcoming'
          ? UPCOMING_LIVESTREAM
          : undefined,
      title: event.title,
      showTitle: featured.showTitle ?? false,
      media: featured.media,
      href: eventVideoId(event) ? eventPageHref(event.id) : event.link?.href,
      newTab: eventVideoId(event) ? false : event.link?.newTab,
      autoplayMs: featured.autoplayMs
    }))
}

const showdownStreamHref: LocalizedText = {
  en: 'https://www.youtube.com/live/VeG1bveKZco',
  'zh-CN': 'https://www.youtube.com/live/VeG1bveKZco'
}

// zh-CN copy is a first pass and pending native review.
const events: readonly ComfyEvent[] = [
  {
    id: 'future-ai-post-production',
    category: 'livestream',
    title: {
      en: 'The Future of AI Post Production',
      'zh-CN': 'AI 后期制作的未来'
    },
    description: {
      en: 'Ingi Erlingsson explores the future of AI post production with custom LoRAs and motion graphics nodes.',
      'zh-CN':
        'Ingi Erlingsson 探讨 AI 后期制作的未来，聚焦自定义 LoRA 与动态图形节点。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'August 5, 2026 · 10AM PT',
      'zh-CN': '2026年8月5日 · 上午10点（PT）'
    },
    startDateTime: '2026-08-05T10:00:00-07:00',
    link: { href: launchesHref, newTab: false },
    liveVideoId: '4xS4LOn3CTE',
    featured: {
      order: 2,
      media: eventVideo(
        'future-of-ai-post-production.mp4',
        {
          en: 'The Future of AI Post Production livestream',
          'zh-CN': 'AI 后期制作的未来直播'
        },
        'livestream-aug05-v2.jpg'
      ),
      autoplayMs: 12000
    }
  },
  {
    id: 'video-model-showdown',
    category: 'livestream',
    title: {
      en: 'Video Model Showdown: Open-Source vs. Paid AI Video Models',
      'zh-CN': '视频模型对决：开源与付费 AI 视频模型'
    },
    description: {
      en: 'Purz and Allyson put open-source and paid AI video models head to head in a live comparison.',
      'zh-CN': 'Purz 与 Allyson 现场对决开源与付费 AI 视频模型，实测效果对比。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'August 12, 2026 · 10AM PT',
      'zh-CN': '2026年8月12日 · 上午10点（PT）'
    },
    startDateTime: '2026-08-12T10:00:00-07:00',
    link: { href: showdownStreamHref, newTab: true },
    liveVideoId: 'VeG1bveKZco',
    featured: {
      order: 3,
      media: eventVideo(
        'august-12-livestream.mp4',
        {
          en: 'Video Model Showdown livestream',
          'zh-CN': '视频模型对决直播'
        },
        'august-12-livestream.jpg'
      ),
      autoplayMs: 5000
    }
  },
  {
    id: 'july-launches',
    category: 'livestream',
    title: {
      en: 'Using ComfyUI MCP with Claude Code',
      'zh-CN': '在 Claude Code 中使用 ComfyUI MCP'
    },
    description: {
      en: 'Our monthly livestream covering the latest ComfyUI launches and updates.',
      'zh-CN': '我们的月度直播，介绍 ComfyUI 最新发布与更新。'
    },
    media: eventImage('july-launches-v2.png', {
      en: 'July Launches livestream recording',
      'zh-CN': '七月发布直播回放'
    }),
    startDateTime: '2026-07-29',
    recordingVideoId: '8RGN69h_xTU'
  },
  {
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
    startDateTime: '2026-07-21',
    recordingVideoId: 'O72yyU-jupU'
  },
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
    startDateTime: '2026-07-08',
    recordingVideoId: 'sX2sJ5-4MS4'
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
    media: eventImage('reinventing-the.png', {
      en: 'Reinventing the Production Pipeline livestream recording',
      'zh-CN': '重塑生产流水线直播回放'
    }),
    startDateTime: '2026-07-08',
    recordingVideoId: 'dsYggO4lsSo'
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
    startDateTime: '2026-06-29',
    recordingVideoId: 'yo7b_zHd20g'
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
    startDateTime: '2026-06-23',
    recordingVideoId: '31jiUhCEjJ4',
    featured: {
      order: 1,
      media: eventVideo(
        'founders-live.mp4',
        {
          en: 'Krea X Comfy Founders Live',
          'zh-CN': 'Krea X Comfy 创始人直播'
        },
        'founders-live-thumb.png'
      )
    }
  }
]

// The site is statically built, so classification is fixed at build time: an
// event moves between the upcoming and past sections on the next deploy.
const BUILD_NOW = new Date()

export const upcomingEvents = deriveUpcomingEvents(events, BUILD_NOW)

export const pastEvents = derivePastEvents(events, BUILD_NOW)

export const featuredEvents = deriveFeaturedEvents(events, BUILD_NOW)

export const watchablePastEvents: readonly ComfyEvent[] = pastEvents.filter(
  (event) => eventVideoId(event)
)

// Events with a stream or recording get their own /events/[slug] page; the
// slug is the event id.
export const watchableEvents: readonly ComfyEvent[] = events.filter((event) =>
  eventVideoId(event)
)

export const getEventBySlug = (slug: string): ComfyEvent | undefined =>
  watchableEvents.find((event) => event.id === slug)
