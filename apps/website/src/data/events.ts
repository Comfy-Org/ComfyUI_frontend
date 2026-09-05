import { localizeHref } from '../config/routes'
import type { Locale, LocalizedText } from '../i18n/translations'
import type { CalendarEvent } from '../utils/calendar'
import type { JsonLdNode } from '../utils/jsonLd'
import { absoluteUrl, eventNode, jsonLdId } from '../utils/jsonLd'

export type EventCategory =
  | 'livestream'
  | 'hackathon'
  | 'workshop'
  | 'meetup'
  | 'conference'

export type EventOrganizer = 'comfy' | 'community' | 'partner'

type EventMedia =
  | { type: 'image'; src: string; alt: LocalizedText }
  | { type: 'video'; src: string; alt: LocalizedText; poster?: string }

export type ComfyEvent = {
  id: string
  category: EventCategory
  /** Who ran the event; drives the directory's organizer filter. Mirrors the
   * community team's Notion taxonomy: `comfy` is anything we organized or
   * co-organized, `partner` is a conference/university/company, `community`
   * is everything else. */
  organizer?: EventOrganizer
  /** Drives the directory map pin; virtual events omit it and appear only in
   * the list, cards, and calendar views. */
  coords?: { lat: number; lng: number }
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
    ? localizeHref(eventPath(event), locale)
    : event.link?.href[locale] ||
      event.link?.href.en ||
      localizeHref(eventPath(event), locale)
  const href = new URL(target, SITE_ORIGIN).href
  const start = new Date(event.startDateTime)
  return {
    title: event.title[locale] || event.title.en,
    description: `${event.description[locale] || event.description.en}\n\n${href}`,
    location: event.location?.[locale] || event.location?.en || '',
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
    event.link?.href[locale] ||
    event.link?.href.en ||
    localizeHref(eventPath(event), locale)
  const online = event.location?.en === 'Online'
  return eventNode({
    siteUrl,
    id: jsonLdId(pageUrl, `event-${event.id}`),
    name: event.title[locale] || event.title.en,
    description: event.description[locale] || event.description.en,
    startDate: event.startDateTime,
    ...(online
      ? { virtualUrl: href.startsWith('/') ? absoluteUrl(site, href) : href }
      : { placeName: event.location?.[locale] || event.location?.en }),
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

export function deriveDirectoryEvents(
  events: readonly ComfyEvent[],
  now: Date
): readonly ComfyEvent[] {
  return [
    ...deriveUpcomingEvents(events, now),
    ...derivePastEvents(events, now)
  ]
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
    id: 'comfy-agent-beta',
    category: 'livestream',
    organizer: 'comfy',
    title: {
      en: 'Comfy Agent Beta: What It Does & How We Built It',
      'zh-CN': 'Comfy Agent Beta：它能做什么，我们又是如何打造它的'
    },
    description: {
      en: 'Jo Zhang, Product Manager at Comfy, joins host Allyson to unpack the Comfy Agent beta: what it does and how the team built it.',
      'zh-CN':
        'Comfy 产品经理 Jo Zhang 做客本场直播，与主持人 Allyson 一起拆解 Comfy Agent Beta 版：它能做什么，以及团队是如何打造它的。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'September 10, 2026 · 10AM PT',
      'zh-CN': '2026年9月10日 · 上午10点（PT）'
    },
    startDateTime: '2026-09-10T10:00:00-07:00',
    liveVideoId: '6ZT9y3rdvFg',
    media: eventVideo(
      '09.10-agent-beta.mp4',
      {
        en: 'Comfy Agent Beta: What It Does & How We Built It livestream',
        'zh-CN': 'Comfy Agent Beta 直播'
      },
      '09.10-agent-beta-still.png'
    ),
    featured: {
      order: 5,
      media: eventVideo(
        '09.10-agent-beta.mp4',
        {
          en: 'Comfy Agent Beta: What It Does & How We Built It livestream',
          'zh-CN': 'Comfy Agent Beta 直播'
        },
        '09.10-agent-beta-still.png'
      ),
      showTitle: false
    }
  },
  {
    id: 'comfy-agent-ga',
    category: 'livestream',
    organizer: 'comfy',
    title: {
      en: 'Comfy Agent: Live Demos, VFX, 3D & Marketing',
      'zh-CN': 'Comfy Agent 现场演示：VFX、3D 与营销'
    },
    description: {
      en: 'Purz and Allyson host live demos of Comfy Agent across VFX, 3D, and marketing use cases.',
      'zh-CN':
        'Purz 与 Allyson 主持本场直播，现场演示 Comfy Agent 在 VFX、3D 与营销场景中的应用。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'September 15, 2026 · 10AM PT',
      'zh-CN': '2026年9月15日 · 上午10点（PT）'
    },
    startDateTime: '2026-09-15T10:00:00-07:00',
    liveVideoId: '3pBDHdgVD1E',
    media: eventVideo(
      '09.15-agent-ga.mp4',
      {
        en: 'Comfy Agent: Live Demos, VFX, 3D & Marketing livestream',
        'zh-CN': 'Comfy Agent 现场演示直播'
      },
      '09.15-agent-ga-still.png'
    ),
    featured: {
      order: 6,
      media: eventVideo(
        '09.15-agent-ga.mp4',
        {
          en: 'Comfy Agent: Live Demos, VFX, 3D & Marketing livestream',
          'zh-CN': 'Comfy Agent 现场演示直播'
        },
        '09.15-agent-ga-still.png'
      ),
      showTitle: false
    }
  },
  {
    id: 'dev-platform-101',
    category: 'livestream',
    organizer: 'comfy',
    title: {
      en: 'Developer Platform 101: Building with the New Comfy API',
      'zh-CN': '开发者平台 101：使用全新 Comfy API 构建应用'
    },
    description: {
      en: 'Jacob Segal, Product Manager at Comfy, joins hosts Allyson and Purz for an introduction to building with the new Comfy developer API.',
      'zh-CN':
        'Comfy 产品经理 Jacob Segal 做客本场直播，与主持人 Allyson 和 Purz 一起介绍如何使用全新的 Comfy 开发者 API 构建应用。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'September 16, 2026 · 10AM PT',
      'zh-CN': '2026年9月16日 · 上午10点（PT）'
    },
    startDateTime: '2026-09-16T10:00:00-07:00',
    liveVideoId: '69slO15ovL8',
    media: eventVideo(
      '09.16-dev-platform.mp4',
      {
        en: 'Developer Platform 101: Building with the New Comfy API livestream',
        'zh-CN': '开发者平台 101 直播'
      },
      '09.16-dev-platform-still.png'
    ),
    featured: {
      order: 7,
      media: eventVideo(
        '09.16-dev-platform.mp4',
        {
          en: 'Developer Platform 101: Building with the New Comfy API livestream',
          'zh-CN': '开发者平台 101 直播'
        },
        '09.16-dev-platform-still.png'
      ),
      showTitle: false
    }
  },
  {
    id: 'la-august-meetup',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 34.0211, lng: -118.3965 },
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
      en: 'August 26, 2026 · 6-9 PM PT',
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
    category: 'workshop',
    organizer: 'partner',
    coords: { lat: 45.5075, lng: -73.5668 },
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
    organizer: 'comfy',
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
    category: 'meetup',
    organizer: 'partner',
    coords: { lat: 37.3688, lng: -122.0363 },
    title: {
      en: 'UCAN: Agentic Commerce, Designing the Next Business Infrastructure ft. Jo Zhang',
      'zh-CN': 'UCAN：智能体商务，设计下一代商业基础设施（特邀 Jo Zhang）'
    },
    description: {
      en: 'A UCAN by Alibaba Design gathering on agentic commerce, where AI shifts from generating outputs to taking action across real business workflows. Jo Zhang joins speakers from Alibaba, Figma, Stripe, and more to explore designing for trust and AI as operational infrastructure.',
      'zh-CN':
        'UCAN（由阿里巴巴设计主办）关于智能体商务的聚会，探讨 AI 如何从生成内容转向在真实业务流程中采取行动。Jo Zhang 将与来自 Alibaba、Figma、Stripe 等机构的讲者一同，探讨如何为信任而设计，以及将 AI 作为运营基础设施。'
    },
    location: {
      en: 'Plug and Play Tech Center, Sunnyvale, CA',
      'zh-CN': 'Plug and Play 科技中心，加州森尼韦尔'
    },
    dateLabel: {
      en: 'September 13, 2026 · 2:00-6:30 PM PT',
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
      en: 'UCAN: Agentic Commerce, Designing the Next Business Infrastructure',
      'zh-CN': 'UCAN：智能体商务，设计下一代商业基础设施'
    })
  },
  {
    id: 'local-mcp',
    category: 'livestream',
    organizer: 'comfy',
    title: {
      en: 'Local MCP: Run ComfyUI with Your Agent & Hardware',
      'zh-CN': '本地 MCP：用你的智能体与硬件运行 ComfyUI'
    },
    description: {
      en: 'Run ComfyUI locally through MCP: a live walkthrough of driving your own agent and hardware to build and run workflows from the tools you already use.',
      'zh-CN':
        '通过 MCP 在本地运行 ComfyUI：现场演示如何驱动你自己的智能体与硬件，用你已经在使用的工具来构建并运行工作流。'
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
    organizer: 'comfy',
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
    organizer: 'comfy',
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
    organizer: 'comfy',
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
    organizer: 'comfy',
    title: {
      en: 'Comfy Creatives Model Jam: MiniMax H3, Seedance 2.5, Wan Animate 2 & More',
      'zh-CN':
        'Comfy Creatives 模型大乱斗：MiniMax H3、Seedance 2.5、Wan Animate 2 等'
    },
    description: {
      en: 'The Comfy Creatives community jams on the latest models (MiniMax H3, Seedance 2.5, Wan Animate 2, and more) in a hands-on livestream.',
      'zh-CN':
        'Comfy Creatives 社区在这场实战直播中集中体验最新模型：MiniMax H3、Seedance 2.5、Wan Animate 2 等。'
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
    organizer: 'comfy',
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
    organizer: 'comfy',
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
    organizer: 'comfy',
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
    organizer: 'comfy',
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
    organizer: 'comfy',
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
    organizer: 'comfy',
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
  },
  // Past community, partner and Comfy-run events, transcribed from the
  // community team's Notion register. These carry no media, so they appear in
  // the directory and calendar but not the past-events gallery, which needs
  // card art.
  {
    id: 'nyc-creative-ai-august-forum',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'NYC Creative AI August Forum',
      'zh-CN': 'NYC Creative AI 八月论坛'
    },
    description: {
      en: 'The August forum drew 433 registrations. Demos covered the Livepeer Agent, MiniMax H3 running in ComfyUI, and an AI-generated musical performance by MetaDJ.',
      'zh-CN':
        '八月论坛共有 433 人报名。现场演示包括 Livepeer Agent、在 ComfyUI 中运行的 MiniMax H3，以及 MetaDJ 带来的 AI 生成音乐表演。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'August 13, 2026',
      'zh-CN': '2026年8月13日'
    },
    startDateTime: '2026-08-13T18:00:00-04:00',
    link: {
      href: {
        en: 'https://luma.com/nw9z51dh?tk=H7wqxP',
        'zh-CN': 'https://luma.com/nw9z51dh?tk=H7wqxP'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-creative-ai-july-forum',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'NYC Creative AI July Forum (formerly ComfyUI NYC)',
      'zh-CN': 'NYC Creative AI 七月论坛（前身为 ComfyUI NYC）'
    },
    description: {
      en: 'The July forum drew 445 registrations and marked the rebrand from ComfyUI NYC, and the series stayed rooted in ComfyUI.',
      'zh-CN':
        '七月论坛共有 445 人报名。该系列自本期起从 ComfyUI NYC 更名，但仍以 ComfyUI 为核心。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'July 10, 2026',
      'zh-CN': '2026年7月10日'
    },
    startDateTime: '2026-07-10T18:00:00-04:00',
    link: {
      href: {
        en: 'https://luma.com/nyc-creative-ai-july-2026',
        'zh-CN': 'https://luma.com/nyc-creative-ai-july-2026'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-february-meetup-2026',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Meetup (February)',
      'zh-CN': 'ComfyUI 见面会（二月）'
    },
    description: {
      en: 'The February ComfyUI meetup ran at ZeroSpace.',
      'zh-CN': '二月的 ComfyUI 见面会在 ZeroSpace 举行。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'February 25, 2026',
      'zh-CN': '2026年2月25日'
    },
    startDateTime: '2026-02-25T18:00:00-05:00',
    link: {
      href: {
        en: 'https://www.garysguide.com/events/xl7uosb/ComfyUI-Meetup',
        'zh-CN': 'https://www.garysguide.com/events/xl7uosb/ComfyUI-Meetup'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-january-meetup-2026',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC January Meetup',
      'zh-CN': 'ComfyUI 官方纽约一月见面会'
    },
    description: {
      en: 'The January meetup drew 425 attendees and included Comfy Cloud announcements.',
      'zh-CN':
        '一月的见面会共有 425 人到场，现场公布了 Comfy Cloud 的相关消息。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'January 30, 2026',
      'zh-CN': '2026年1月30日'
    },
    startDateTime: '2026-01-30T18:00:00-05:00',
    link: {
      href: {
        en: 'https://luma.com/v980qiad',
        'zh-CN': 'https://luma.com/v980qiad'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-december-meetup-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC (December) Meet-Up',
      'zh-CN': 'ComfyUI 官方纽约见面会（十二月）'
    },
    description: {
      en: 'The December meetup featured talks from Yondon Fu (Daydream) and Alex Katzfey (Comfydock).',
      'zh-CN':
        '十二月的见面会上，Yondon Fu（Daydream）与 Alex Katzfey（Comfydock）做了分享。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'December 10, 2025',
      'zh-CN': '2025年12月10日'
    },
    startDateTime: '2025-12-10T18:00:00-05:00',
    link: {
      href: {
        en: 'https://www.garysguide.com/events/b9diaqo/ComfyUI-Official',
        'zh-CN': 'https://www.garysguide.com/events/b9diaqo/ComfyUI-Official'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-secret-sauce-workshop',
    category: 'workshop',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'AI Creative / ComfyUI Event in NYC with Secret Sauce',
      'zh-CN': 'AI Creative / ComfyUI 纽约活动（与 Secret Sauce 共同举办）'
    },
    description: {
      en: 'The MFA Interaction Design program at the School of Visual Arts hosted this event with Secret Sauce.',
      'zh-CN':
        '这场活动由 School of Visual Arts 的 MFA Interaction Design 项目与 Secret Sauce 共同举办。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'December 5, 2025',
      'zh-CN': '2025年12月5日'
    },
    startDateTime: '2025-12-05T18:00:00-05:00',
    link: {
      href: {
        en: 'https://www.eventbrite.com/e/ai-creative-comfyui-event-in-nyc-with-secret-sauce-tickets-1976638614305',
        'zh-CN':
          'https://www.eventbrite.com/e/ai-creative-comfyui-event-in-nyc-with-secret-sauce-tickets-1976638614305'
      },
      newTab: true
    }
  },
  {
    id: 'low-rank-adapters-comfyui-chill',
    category: 'workshop',
    organizer: 'partner',
    title: {
      en: 'low rank adapters present: ComfyUI & Chill',
      'zh-CN': 'low rank adapters 呈现：ComfyUI & Chill'
    },
    description: {
      en: 'Gabriel and Carlo of daisy, a generative media startup, hosted a hands-on session on building node-based workflows in ComfyUI.',
      'zh-CN':
        '生成式媒体创业公司 daisy 的 Gabriel 和 Carlo 主持了这场实操活动，带参与者在 ComfyUI 中搭建节点工作流。'
    },
    location: { en: 'Location not listed', 'zh-CN': '地点未列出' },
    dateLabel: {
      en: 'October 15, 2025',
      'zh-CN': '2025年10月15日'
    },
    startDateTime: '2025-10-15',
    link: {
      href: {
        en: 'https://partiful.com/e/Hn6yX0pB4P1xQVuROTdn',
        'zh-CN': 'https://partiful.com/e/Hn6yX0pB4P1xQVuROTdn'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-october-meetup-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC October Meet-Up',
      'zh-CN': 'ComfyUI 官方纽约十月见面会'
    },
    description: {
      en: 'The October meetup drew 280 attendees and included a talk on LTX-2.',
      'zh-CN': '十月的见面会共有 280 人到场，现场有一场关于 LTX-2 的分享。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'October 2025',
      'zh-CN': '2025年10月'
    },
    startDateTime: '2025-10-01',
    link: {
      href: {
        en: 'https://luma.com/f2begllt',
        'zh-CN': 'https://luma.com/f2begllt'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-august-meetup-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC August Meet-Up',
      'zh-CN': 'ComfyUI 官方纽约八月见面会'
    },
    description: {
      en: 'The August meetup drew 399 attendees and included a talk on Wan 2.2.',
      'zh-CN': '八月的见面会共有 399 人到场，现场有一场关于 Wan 2.2 的分享。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'August 2025',
      'zh-CN': '2025年8月'
    },
    startDateTime: '2025-08-01',
    link: {
      href: {
        en: 'https://luma.com/62hfwf86',
        'zh-CN': 'https://luma.com/62hfwf86'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-july-meetup-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC July Meet-Up',
      'zh-CN': 'ComfyUI 官方纽约七月见面会'
    },
    description: {
      en: 'The July meetup drew 224 attendees to ZeroSpace.',
      'zh-CN': '七月的见面会在 ZeroSpace 举行，共有 224 人到场。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'July 2025',
      'zh-CN': '2025年7月'
    },
    startDateTime: '2025-07-01',
    link: {
      href: {
        en: 'https://luma.com/xxu75lsj',
        'zh-CN': 'https://luma.com/xxu75lsj'
      },
      newTab: true
    }
  },
  {
    id: 'nvidia-rtx-mini-hackathon',
    category: 'hackathon',
    organizer: 'comfy',
    coords: { lat: 37.7749, lng: -122.4194 },
    title: {
      en: 'ComfyUI x NVIDIA RTX Hackathon (Mini-Hackathon) @ GitHub HQ',
      'zh-CN': 'ComfyUI x NVIDIA RTX 黑客松（迷你黑客松）@ GitHub 总部'
    },
    description: {
      en: 'Comfy Org ran the first ComfyUI hackathon at GitHub HQ, co-sponsored by NVIDIA. Prizes included two RTX 5090s.',
      'zh-CN':
        'Comfy Org 在 GitHub 总部举办了首届 ComfyUI 黑客松，由 NVIDIA 联合赞助，奖品包括两块 RTX 5090。'
    },
    location: { en: 'San Francisco, CA', 'zh-CN': '美国加州旧金山' },
    dateLabel: {
      en: 'June 26, 2025',
      'zh-CN': '2025年6月26日'
    },
    startDateTime: '2025-06-26T18:00:00-07:00',
    link: {
      href: {
        en: 'https://luma.com/zndawmg9',
        'zh-CN': 'https://luma.com/zndawmg9'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-june-meetup-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC June Meet-Up',
      'zh-CN': 'ComfyUI 官方纽约六月见面会'
    },
    description: {
      en: 'The June meetup drew 179 attendees to ZeroSpace.',
      'zh-CN': '六月的见面会在 ZeroSpace 举行，共有 179 人到场。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'June 2025',
      'zh-CN': '2025年6月'
    },
    startDateTime: '2025-06-13',
    link: {
      href: {
        en: 'https://luma.com/jvagiopg',
        'zh-CN': 'https://luma.com/jvagiopg'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-may-meetup-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC May Meet-Up',
      'zh-CN': 'ComfyUI 官方纽约五月见面会'
    },
    description: {
      en: 'The May meetup drew 209 attendees to ZeroSpace.',
      'zh-CN': '五月的见面会在 ZeroSpace 举行，共有 209 人到场。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'May 2025',
      'zh-CN': '2025年5月'
    },
    startDateTime: '2025-05-01',
    link: {
      href: {
        en: 'https://luma.com/q4ibx9ia',
        'zh-CN': 'https://luma.com/q4ibx9ia'
      },
      newTab: true
    }
  },
  {
    id: 'genart-nyu-real-time-video',
    category: 'workshop',
    organizer: 'partner',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'Real-Time Video AI @GenART NYU with ComfyUI & Livepeer',
      'zh-CN': '实时视频 AI @GenART NYU：ComfyUI 与 Livepeer'
    },
    description: {
      en: 'Livepeer presented this real-time video AI workshop at NYU in Brooklyn, hosted with Daydream and GenART NYU. The workshop drew 71 registrations.',
      'zh-CN':
        'Livepeer 呈现了这场在布鲁克林的 NYU 举办的实时视频 AI 工作坊，并与 Daydream、GenART NYU 共同主办。这场工作坊共有 71 人报名。'
    },
    location: {
      en: '370 Jay St, Brooklyn, NY',
      'zh-CN': '美国纽约布鲁克林 370 Jay St'
    },
    dateLabel: {
      en: 'April 18, 2025',
      'zh-CN': '2025年4月18日'
    },
    startDateTime: '2025-04-18',
    link: {
      href: {
        en: 'https://luma.com/wyvt8b4k',
        'zh-CN': 'https://luma.com/wyvt8b4k'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-april-meetup-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC April Meet-Up',
      'zh-CN': 'ComfyUI 官方纽约四月见面会'
    },
    description: {
      en: 'The April meetup drew 131 attendees.',
      'zh-CN': '四月的见面会共有 131 人到场。'
    },
    location: {
      en: '91 E 3rd St, New York, NY',
      'zh-CN': '美国纽约 91 E 3rd St'
    },
    dateLabel: {
      en: 'April 3, 2025',
      'zh-CN': '2025年4月3日'
    },
    startDateTime: '2025-04-03',
    link: {
      href: {
        en: 'https://luma.com/7p7kppqx',
        'zh-CN': 'https://luma.com/7p7kppqx'
      },
      newTab: true
    }
  },
  {
    id: 'comfycon-shanghai',
    category: 'conference',
    organizer: 'comfy',
    coords: { lat: 31.2304, lng: 121.4737 },
    title: {
      en: "ComfyCon: ComfyUI's first official global conference",
      'zh-CN': 'ComfyCon：ComfyUI 首届官方全球大会'
    },
    description: {
      en: "Comfy Org's first official global conference ran for two days in Shanghai. The global core dev team was there, including Jo Zhang, Yoland Yan, Robin Huang, and Charlene.",
      'zh-CN':
        'Comfy Org 首届官方全球大会在上海举行，为期两天。全球核心开发团队到场，包括 Jo Zhang、Yoland Yan、Robin Huang、Charlene 等人。'
    },
    location: { en: 'Shanghai, China', 'zh-CN': '中国上海' },
    dateLabel: {
      en: 'March 29 to 30, 2025',
      'zh-CN': '2025年3月29日至30日'
    },
    startDateTime: '2025-03-29',
    endDateTime: '2025-03-30T18:00:00+08:00',
    link: {
      href: {
        en: 'https://luma.com/ComfyCon',
        'zh-CN': 'https://luma.com/ComfyCon'
      },
      newTab: true
    }
  },
  {
    id: 'austin-ai-film-fest-meetup',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 30.2672, lng: -97.7431 },
    title: {
      en: 'ComfyUI Official Meetup: Austin AI Film Fest Edition',
      'zh-CN': 'ComfyUI 官方见面会：Austin AI Film Fest 特别场'
    },
    description: {
      en: 'This community meetup coincided with SXSW and the Austin AI Film Festival. Ori Apkon of FungAI Media hosted locally, and Daydream co-presented.',
      'zh-CN':
        '这场社区见面会与 SXSW 和 Austin AI Film Festival 同期举行，由 FungAI Media 的 Ori Apkon 在当地主办，Daydream 联合呈现。'
    },
    location: { en: 'Austin, TX', 'zh-CN': '美国德克萨斯州奥斯汀' },
    dateLabel: {
      en: 'March 14 to 15, 2025',
      'zh-CN': '2025年3月14日至15日'
    },
    startDateTime: '2025-03-14T18:00:00-05:00',
    endDateTime: '2025-03-15T21:00:00-05:00',
    link: {
      href: {
        en: 'https://luma.com/nkiothz3',
        'zh-CN': 'https://luma.com/nkiothz3'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-march-meetup-women-in-ai-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC March Meet-Up: Celebrating Women in AI',
      'zh-CN': 'ComfyUI 官方纽约三月见面会：致敬 AI 领域的女性'
    },
    description: {
      en: 'The March meetup ran on a Women in AI theme.',
      'zh-CN': '三月的见面会以 AI 领域的女性为主题。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'March 12, 2025',
      'zh-CN': '2025年3月12日'
    },
    startDateTime: '2025-03-12',
    link: {
      href: {
        en: 'https://lu.ma/8uvt2vnz',
        'zh-CN': 'https://lu.ma/8uvt2vnz'
      },
      newTab: true
    }
  },
  {
    id: 'ai-la-march-meetup',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 34.0522, lng: -118.2437 },
    title: {
      en: 'ComfyUI Official AI LA March Meet-Up',
      'zh-CN': 'ComfyUI 官方 AI LA 三月见面会'
    },
    description: {
      en: 'The March AI LA meetup ran at BLANKSPACES in Venice. Speakers included ComfyAnonymous, joining remotely, along with Midjourney Man and Spencer Sterling.',
      'zh-CN':
        '三月的 AI LA 见面会在 Venice 的 BLANKSPACES 举行，演讲嘉宾包括远程连线的 ComfyAnonymous，以及 Midjourney Man 和 Spencer Sterling。'
    },
    location: { en: 'Los Angeles, CA', 'zh-CN': '美国加州洛杉矶' },
    dateLabel: {
      en: 'March 6, 2025',
      'zh-CN': '2025年3月6日'
    },
    startDateTime: '2025-03-06T18:00:00-08:00',
    link: {
      href: {
        en: 'https://curiousrefuge.com/all-events/comfyui-officalaila-meetup-march',
        'zh-CN':
          'https://curiousrefuge.com/all-events/comfyui-officalaila-meetup-march'
      },
      newTab: true
    }
  },
  {
    id: 'bentoml-api-endpoints',
    category: 'livestream',
    organizer: 'partner',
    title: {
      en: 'Turning ComfyUI workflows into API endpoints with BentoML',
      'zh-CN': '用 BentoML 把 ComfyUI 工作流变成 API 端点'
    },
    description: {
      en: 'Sean Sheng, Head of Engineering at BentoML, demoed comfy-pack, the tool that turns a ComfyUI workflow into a callable API endpoint. Eric Liu hosted the Zoom session as part of the AGI Builders Meetup.',
      'zh-CN':
        'BentoML 工程负责人 Sean Sheng 演示了 comfy-pack，用它把 ComfyUI 工作流变成可调用的 API 端点。这场 Zoom 活动由 Eric Liu 主持，是 AGI Builders Meetup 的一期。'
    },
    location: { en: 'Online', 'zh-CN': '线上' },
    dateLabel: {
      en: 'February 2025',
      'zh-CN': '2025年2月'
    },
    startDateTime: '2025-02-12',
    link: {
      href: {
        en: 'https://luma.com/ahyuo5m6',
        'zh-CN': 'https://luma.com/ahyuo5m6'
      },
      newTab: true
    }
  },
  {
    id: 'la-february-meetup',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 34.0522, lng: -118.2437 },
    title: {
      en: 'ComfyUI Official LA February Meet-Up',
      'zh-CN': 'ComfyUI 官方洛杉矶二月见面会'
    },
    description: {
      en: 'The February LA meetup ran in the former Snapchat office on Venice Beach, presented by AI LA Events and hosted by AI LA with FBRC.AI. Wan AI and Oxen.ai sponsored the event.',
      'zh-CN':
        '二月的洛杉矶见面会在 Venice Beach 的 Snapchat 旧办公室举行，由 AI LA Events 呈现，AI LA 与 FBRC.AI 共同主办，Wan AI 和 Oxen.ai 提供赞助。'
    },
    location: { en: 'Los Angeles, CA', 'zh-CN': '美国加州洛杉矶' },
    dateLabel: {
      en: 'February 2025',
      'zh-CN': '2025年2月'
    },
    startDateTime: '2025-02-01',
    link: {
      href: {
        en: 'https://luma.com/COMFYUI',
        'zh-CN': 'https://luma.com/COMFYUI'
      },
      newTab: true
    }
  },
  {
    id: 'nyc-february-meetup-2025',
    category: 'meetup',
    organizer: 'community',
    coords: { lat: 40.7128, lng: -74.006 },
    title: {
      en: 'ComfyUI Official NYC February Meet-Up',
      'zh-CN': 'ComfyUI 官方纽约二月见面会'
    },
    description: {
      en: 'The February meetup drew 64 attendees. NYC Creative AI presented it, and Daydream, Livepeer, and ZeroSpace hosted.',
      'zh-CN':
        '二月的见面会共有 64 人到场。活动由 NYC Creative AI 呈现，Daydream、Livepeer 与 ZeroSpace 共同主办。'
    },
    location: { en: 'New York, NY', 'zh-CN': '美国纽约' },
    dateLabel: {
      en: 'February 2025',
      'zh-CN': '2025年2月'
    },
    startDateTime: '2025-02-01',
    link: {
      href: {
        en: 'https://lu.ma/ettshrqa',
        'zh-CN': 'https://lu.ma/ettshrqa'
      },
      newTab: true
    }
  },
  {
    id: 'sf-meetup-github',
    category: 'meetup',
    organizer: 'comfy',
    coords: { lat: 37.7749, lng: -122.4194 },
    title: {
      en: 'ComfyUI Official SF Meet-up at GitHub',
      'zh-CN': 'ComfyUI 官方旧金山见面会 @ GitHub'
    },
    description: {
      en: "Comfy Org's first official meetup in San Francisco ran at GitHub HQ. Charlene, Yoland, Robin Huang, and Jo Zhang hosted, with Sahar Mor co-hosting.",
      'zh-CN':
        'Comfy Org 首场官方旧金山见面会在 GitHub 总部举行。活动由 Charlene、Yoland、Robin Huang 和 Jo Zhang 主持，Sahar Mor 联合主持。'
    },
    location: { en: 'San Francisco, CA', 'zh-CN': '美国加州旧金山' },
    dateLabel: {
      en: 'January 2025',
      'zh-CN': '2025年1月'
    },
    startDateTime: '2025-01-01',
    link: {
      href: {
        en: 'https://luma.com/6skuqn7c',
        'zh-CN': 'https://luma.com/6skuqn7c'
      },
      newTab: true
    }
  },
  {
    id: 'kikk-festival-comfyui-workshop',
    category: 'workshop',
    organizer: 'partner',
    coords: { lat: 50.4674, lng: 4.872 },
    title: {
      en: 'Workshop: Exploring Generative AI with ComfyUI (by Varvara & Mar)',
      'zh-CN': '工作坊：用 ComfyUI 探索生成式 AI（Varvara & Mar 主讲）'
    },
    description: {
      en: 'Varvara & Mar led a workshop on generative AI in ComfyUI at TRAKK, the Namur creative hub. It was hosted by KIKK Festival and run via RunComfy.',
      'zh-CN':
        'Varvara 与 Mar 在那慕尔创意中心 TRAKK 主讲了一场 ComfyUI 生成式 AI 工作坊。活动由 KIKK Festival 主办，通过 RunComfy 进行。'
    },
    location: { en: 'TRAKK, Namur, Belgium', 'zh-CN': '比利时那慕尔 TRAKK' },
    dateLabel: {
      en: 'October 26, 2024',
      'zh-CN': '2024年10月26日'
    },
    startDateTime: '2024-10-26',
    link: {
      href: {
        en: 'https://www.eventbrite.fr/e/workshop-exploring-generative-ai-with-comfyui-by-varvara-mar-tickets-1030013276437',
        'zh-CN':
          'https://www.eventbrite.fr/e/workshop-exploring-generative-ai-with-comfyui-by-varvara-mar-tickets-1030013276437'
      },
      newTab: true
    }
  },
  {
    id: 'tokyo-comfyui-meetup',
    category: 'meetup',
    organizer: 'comfy',
    coords: { lat: 35.6762, lng: 139.6503 },
    title: {
      en: 'Tokyo ComfyUI Meet Up (東京ComfyUI交流イベント)',
      'zh-CN': 'Tokyo ComfyUI Meet Up（東京ComfyUI交流イベント）'
    },
    description: {
      en: 'Comfy Org took its first meetup overseas to Tokyo. Core devs Charlene and Yoland attended.',
      'zh-CN':
        '这是 Comfy Org 首次在海外举办见面会，地点在东京。核心开发者 Charlene 与 Yoland 到场参与。'
    },
    location: { en: 'Tokyo, Japan', 'zh-CN': '日本东京' },
    dateLabel: {
      en: 'September 27, 2024',
      'zh-CN': '2024年9月27日'
    },
    startDateTime: '2024-09-27',
    link: {
      href: {
        en: 'https://luma.com/01dbvc75',
        'zh-CN': 'https://luma.com/01dbvc75'
      },
      newTab: true
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

export const directoryEvents = deriveDirectoryEvents(events, NOW)

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
