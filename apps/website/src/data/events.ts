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
  /** Overrides the default "Livestream" label on the upcoming-list CTA (e.g.
   * "Register" for in-person events that link out to a registration page). */
  ctaLabel?: LocalizedText
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
        eventStatus(event, now) === 'upcoming' &&
        event.category === 'livestream'
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

// zh-CN copy is a first pass and pending native review.
const events: readonly ComfyEvent[] = [
  {
    id: 'la-august-meetup',
    category: 'community',
    title: {
      en: 'ComfyUI Official LA August Meet-Up',
      'zh-CN': 'ComfyUI 官方洛杉矶八月见面会'
    },
    description: {
      en: 'Join us for the official ComfyUI meetup in LA, hosted at the new AI on the Lot office in Culver City.',
      'zh-CN':
        '欢迎参加在洛杉矶举办的官方 ComfyUI 见面会，地点位于卡尔弗城全新的 AI on the Lot 办公室。'
    },
    location: { en: 'Los Angeles, CA', 'zh-CN': '美国加州洛杉矶' },
    dateLabel: {
      en: 'August 26, 2026 · 6–9 PM PT',
      'zh-CN': '2026年8月26日 · 下午6点至9点（PT）'
    },
    startDateTime: '2026-08-26T18:00:00-07:00',
    endDateTime: '2026-08-26T21:00:00-07:00',
    link: {
      href: {
        en: 'https://luma.com/nd0u29u8',
        'zh-CN': 'https://luma.com/nd0u29u8'
      },
      newTab: true
    },
    ctaLabel: { en: 'Register', 'zh-CN': '报名' },
    media: eventImage('08.26_la-meetup.avif', {
      en: 'ComfyUI Official LA August Meet-Up',
      'zh-CN': 'ComfyUI 官方洛杉矶八月见面会'
    })
  },
  {
    id: 'mutek-3d-projection-mapping',
    category: 'community',
    title: {
      en: 'MUTEK: Generative AI for 3D Projection Mapping ft. Purz & Moment Factory',
      'zh-CN': 'MUTEK：面向 3D 投影映射的生成式 AI，特邀 Purz 与 Moment Factory'
    },
    description: {
      en: 'A hands-on workshop with Moment Factory on bringing generative AI into large-scale spatial design with ComfyUI, ending by projecting AI-generated visuals onto a physical maquette.',
      'zh-CN':
        '与 Moment Factory 合作的实操工作坊，探讨如何用 ComfyUI 将生成式 AI 融入大型空间设计，并在最后将 AI 生成的视觉投影到实体模型上。'
    },
    location: {
      en: 'Édifice Wilder, Montréal, QC',
      'zh-CN': 'Édifice Wilder，加拿大魁北克蒙特利尔'
    },
    dateLabel: {
      en: 'August 27, 2026 · 1:30PM ET',
      'zh-CN': '2026年8月27日 · 下午1:30（ET）'
    },
    startDateTime: '2026-08-27T13:30:00-04:00',
    endDateTime: '2026-08-27T15:30:00-04:00',
    link: {
      href: {
        en: 'https://forum.mutek.org/en/shows/2026/generative-ai-for-3d-projection-mapping-from-concept-to-canvas',
        'zh-CN':
          'https://forum.mutek.org/en/shows/2026/generative-ai-for-3d-projection-mapping-from-concept-to-canvas'
      },
      newTab: true
    },
    ctaLabel: { en: 'Register', 'zh-CN': '报名' },
    featured: {
      order: 0,
      media: eventVideo(
        '08.27-MUTEK.mp4',
        {
          en: 'MUTEK: Generative AI for 3D Projection Mapping',
          'zh-CN': 'MUTEK：面向 3D 投影映射的生成式 AI'
        },
        '08.27-MUTEK_thumb.jpeg'
      )
    }
  },
  {
    id: 'h3-sync-sound-challenge',
    category: 'livestream',
    title: {
      en: 'Comfy H3 Sync Sound Challenge: Guest Judge Livestream',
      'zh-CN': 'Comfy H3 同步声音挑战赛：特邀评委直播'
    },
    description: {
      en: 'Guest judges join us live to review the best MiniMax H3 sync sound entries from the community and break down what makes generated audio and picture land together.',
      'zh-CN':
        '特邀评委做客直播间，点评社区在 MiniMax H3 同步声音挑战赛中的优秀作品，并拆解让生成音频与画面同频的关键所在。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'September 2, 2026 · 10AM PT',
      'zh-CN': '2026年9月2日 · 上午10点（PT）'
    },
    startDateTime: '2026-09-02T10:00:00-07:00',
    liveVideoId: '2_vEJJU_MUU',
    media: eventImage('09.02-comfy-h3-sync.jpg', {
      en: 'Comfy H3 Sync Sound Challenge guest judge livestream',
      'zh-CN': 'Comfy H3 同步声音挑战赛特邀评委直播'
    }),
    featured: {
      order: 1,
      media: eventImage('09.02-comfy-h3-sync.jpg', {
        en: 'Comfy H3 Sync Sound Challenge guest judge livestream',
        'zh-CN': 'Comfy H3 同步声音挑战赛特邀评委直播'
      }),
      showTitle: false
    }
  },
  {
    id: 'ucan-agentic-commerce',
    category: 'community',
    title: {
      en: 'UCAN: Agentic Commerce — Designing the Next Business Infrastructure ft. Jo Zhang',
      'zh-CN': 'UCAN：智能体商务——设计下一代商业基础设施（特邀 Jo Zhang）'
    },
    description: {
      en: 'A UCAN by Alibaba Design gathering on agentic commerce — where AI shifts from generating outputs to taking action across real business workflows. Jo Zhang joins speakers from Alibaba, Figma, Stripe, and more to explore designing for trust and AI as operational infrastructure.',
      'zh-CN':
        'UCAN（由阿里巴巴设计主办）关于智能体商务的聚会——探讨 AI 如何从生成内容转向在真实业务流程中采取行动。Jo Zhang 将与来自 Alibaba、Figma、Stripe 等机构的讲者一同，探讨如何为信任而设计，以及将 AI 作为运营基础设施。'
    },
    location: {
      en: 'Plug and Play Tech Center, Sunnyvale, CA',
      'zh-CN': 'Plug and Play 科技中心，加州森尼韦尔'
    },
    dateLabel: {
      en: 'September 13, 2026 · 2:00–6:30 PM PT',
      'zh-CN': '2026年9月13日 · 下午2:00至6:30（PT）'
    },
    startDateTime: '2026-09-13T14:00:00-07:00',
    endDateTime: '2026-09-13T18:30:00-07:00',
    link: {
      href: {
        en: 'https://luma.com/ucan-2026',
        'zh-CN': 'https://luma.com/ucan-2026'
      },
      newTab: true
    },
    ctaLabel: { en: 'Register', 'zh-CN': '报名' },
    media: eventImage('agentic-commerce.avif', {
      en: 'UCAN: Agentic Commerce — Designing the Next Business Infrastructure',
      'zh-CN': 'UCAN：智能体商务——设计下一代商业基础设施'
    })
  },
  {
    id: 'local-mcp',
    category: 'livestream',
    title: {
      en: 'Local MCP: Run ComfyUI with Your Agent & Hardware',
      'zh-CN': '本地 MCP：用你的智能体与硬件运行 ComfyUI'
    },
    description: {
      en: 'Run ComfyUI locally through MCP — a live walkthrough of driving your own agent and hardware to build and run workflows from the tools you already use.',
      'zh-CN':
        '通过 MCP 在本地运行 ComfyUI——现场演示如何驱动你自己的智能体与硬件，用你已经在使用的工具来构建并运行工作流。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'August 26, 2026 · 10AM PT',
      'zh-CN': '2026年8月26日 · 上午10点（PT）'
    },
    startDateTime: '2026-08-26T10:00:00-07:00',
    liveVideoId: '6yH_15XSd0w',
    media: eventImage('august-26-2026-local-mcp.jpg', {
      en: 'Local MCP: Run ComfyUI with Your Agent & Hardware livestream',
      'zh-CN': '本地 MCP：用你的智能体与硬件运行 ComfyUI 直播'
    })
  },
  {
    id: 'beyond-the-models',
    category: 'livestream',
    title: {
      en: 'Using Comfy to Go Beyond the Models: Custom Workflows for Commercial and Film Production',
      'zh-CN': '善用 Comfy，超越模型本身：面向商业与影视制作的自定义工作流'
    },
    description: {
      en: 'Go beyond off-the-shelf models: a live walkthrough of building custom ComfyUI workflows for commercial and film production.',
      'zh-CN':
        '超越开箱即用的模型：现场演示如何为商业与影视制作构建自定义 ComfyUI 工作流。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'August 19, 2026 · 10AM PT',
      'zh-CN': '2026年8月19日 · 上午10点（PT）'
    },
    startDateTime: '2026-08-19T10:00:00-07:00',
    liveVideoId: 'IzTI8oK_Wg4',
    media: eventVideo(
      '08.19-Tool_landscape.mp4',
      {
        en: 'Using Comfy to Go Beyond the Models livestream',
        'zh-CN': '善用 Comfy，超越模型本身直播'
      },
      'livestream-aug-19.jpg'
    ),
    featured: {
      order: 2,
      media: eventVideo(
        '08.19-Tool_landscape.mp4',
        {
          en: 'Using Comfy to Go Beyond the Models livestream',
          'zh-CN': '善用 Comfy，超越模型本身直播'
        },
        'livestream-aug-19.jpg'
      ),
      showTitle: false
    }
  },
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
      order: 4,
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
    media: eventImage('august-12-livestream_v2.png', {
      en: 'Video Model Showdown livestream recording',
      'zh-CN': '视频模型对决直播回放'
    }),
    startDateTime: '2026-08-12T10:00:00-07:00',
    recordingVideoId: 'VeG1bveKZco'
  },
  {
    id: 'comfy-creatives-model-jam',
    category: 'livestream',
    title: {
      en: 'Comfy Creatives Model Jam: MiniMax H3, Seedance 2.5, Wan Animate 2 & More',
      'zh-CN':
        'Comfy Creatives 模型大乱斗：MiniMax H3、Seedance 2.5、Wan Animate 2 等'
    },
    description: {
      en: 'The Comfy Creatives community jams on the latest models — MiniMax H3, Seedance 2.5, Wan Animate 2, and more — in a hands-on livestream.',
      'zh-CN':
        'Comfy Creatives 社区在这场实战直播中集中体验最新模型——MiniMax H3、Seedance 2.5、Wan Animate 2 等。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    media: eventImage('livestream_aug-10.jpg', {
      en: 'Comfy Creatives Model Jam livestream recording',
      'zh-CN': 'Comfy Creatives 模型大乱斗直播回放'
    }),
    startDateTime: '2026-08-10T10:00:00-07:00',
    recordingVideoId: 'BCqp2xnUeKk'
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
      order: 3,
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

// Sampled once per module load: at build time for the pre-rendered HTML, and
// again in the browser when the events islands hydrate. An event therefore
// leaves the upcoming section on the first page load after it ends, rather than
// on the next deploy; a page left open keeps the list it hydrated with.
const NOW = new Date()

export const upcomingEvents = deriveUpcomingEvents(events, NOW)

export const pastEvents = derivePastEvents(events, NOW)

export const featuredEvents = deriveFeaturedEvents(events, NOW)

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
