import type { Locale, LocalizedText } from '../i18n/translations'
import type {
  ComfyEvent,
  EventCategory,
  EventMedia,
  FeaturedEvent,
  LocationMode
} from '../utils/events'

import { localizeHref } from '../config/routes'
import {
  deriveFeaturedEvents,
  derivePastEvents,
  deriveUpcomingEvents,
  eventStatus,
  eventVideoId
} from '../utils/events'

// The authoring shape: structurally the flat render model, but with every
// localized text still carried per locale. Flattening to a single locale
// happens at the accessors below — the render model never sees LocalizedText.
// This shape survives only until the CMS drives events; it then becomes the
// seed source.
type LocalizedMedia =
  | { type: 'image'; src: string; alt: LocalizedText }
  | { type: 'video'; src: string; alt: LocalizedText; poster?: string }

export type ComfyEventSource = {
  id: string
  category: EventCategory
  title: LocalizedText
  description: LocalizedText
  locationMode: LocationMode
  locationName?: LocalizedText
  startDateTime: string
  endDateTime?: string
  /** IANA zone the display date renders in. Defaults to Pacific. */
  timeZone?: string
  /** Absolute URL, or a site-relative path localized during flattening. */
  href?: string
  newTab?: boolean
  ctaLabel?: LocalizedText
  media?: LocalizedMedia
  liveVideoId?: string
  recordingVideoId?: string
  featured?: {
    order: number
    media: LocalizedMedia
    autoplayMs?: number
    showTitle?: boolean
  }
}

function flattenMedia(media: LocalizedMedia, locale: Locale): EventMedia {
  return { ...media, alt: media.alt[locale] }
}

export function flattenEvent(
  source: ComfyEventSource,
  locale: Locale
): ComfyEvent {
  const {
    title,
    description,
    locationName,
    ctaLabel,
    media,
    featured,
    href,
    ...rest
  } = source
  return {
    ...rest,
    title: title[locale],
    description: description[locale],
    ...(locationName && { locationName: locationName[locale] }),
    ...(ctaLabel && { ctaLabel: ctaLabel[locale] }),
    ...(media && { media: flattenMedia(media, locale) }),
    ...(featured && {
      featured: { ...featured, media: flattenMedia(featured.media, locale) }
    }),
    ...(href && {
      href: href.startsWith('/') ? localizeHref(href, locale) : href
    })
  }
}

function eventImage(fileName: string, alt: LocalizedText): LocalizedMedia {
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
): LocalizedMedia {
  return {
    type: 'video',
    src: `https://media.comfy.org/website/events/${fileName}`,
    alt,
    ...(posterFileName && {
      poster: `https://media.comfy.org/website/events/${posterFileName}`
    })
  }
}

// zh-CN copy is a first pass and pending native review.
const events: readonly ComfyEventSource[] = [
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
    locationMode: 'in-person',
    locationName: { en: 'Los Angeles, CA', 'zh-CN': '美国加州洛杉矶' },
    startDateTime: '2026-08-26T18:00:00-07:00',
    endDateTime: '2026-08-26T21:00:00-07:00',
    href: 'https://luma.com/nd0u29u8',
    newTab: true,
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
    locationMode: 'in-person',
    locationName: {
      en: 'Édifice Wilder, Montréal, QC',
      'zh-CN': 'Édifice Wilder，加拿大魁北克蒙特利尔'
    },
    startDateTime: '2026-08-27T13:30:00-04:00',
    endDateTime: '2026-08-27T15:30:00-04:00',
    timeZone: 'America/New_York',
    href: 'https://forum.mutek.org/en/shows/2026/generative-ai-for-3d-projection-mapping-from-concept-to-canvas',
    newTab: true,
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
    locationMode: 'in-person',
    locationName: {
      en: 'Plug and Play Tech Center, Sunnyvale, CA',
      'zh-CN': 'Plug and Play 科技中心，加州森尼韦尔'
    },
    startDateTime: '2026-09-13T14:00:00-07:00',
    endDateTime: '2026-09-13T18:30:00-07:00',
    href: 'https://luma.com/ucan-2026',
    newTab: true,
    ctaLabel: { en: 'Register', 'zh-CN': '报名' },
    media: eventImage('agentic-commerce.avif', {
      en: 'UCAN: Agentic Commerce — Designing the Next Business Infrastructure',
      'zh-CN': 'UCAN：智能体商务——设计下一代商业基础设施'
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
    locationMode: 'online',
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
      order: 1,
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
    locationMode: 'online',
    startDateTime: '2026-08-05T10:00:00-07:00',
    href: '/launches',
    newTab: false,
    liveVideoId: '4xS4LOn3CTE',
    featured: {
      order: 3,
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
    locationMode: 'online',
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
    locationMode: 'online',
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
    locationMode: 'online',
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
    locationMode: 'online',
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
    locationMode: 'online',
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
    locationMode: 'online',
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
    locationMode: 'online',
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
    locationMode: 'online',
    media: eventImage('krea.jpg', {
      en: 'Krea X Comfy Founders Live recording',
      'zh-CN': 'Krea X Comfy 创始人直播回放'
    }),
    startDateTime: '2026-06-23',
    recordingVideoId: '31jiUhCEjJ4',
    featured: {
      order: 2,
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

export const eventsForLocale = (locale: Locale): readonly ComfyEvent[] =>
  events.map((event) => flattenEvent(event, locale))

// The same build-time clock as the derived lists, so a detail page's body
// always agrees with the section rendered behind its dialog.
export const isPastAtBuild = (event: ComfyEvent): boolean =>
  eventStatus(event, BUILD_NOW) === 'past'

export const upcomingEvents = (locale: Locale): readonly ComfyEvent[] =>
  deriveUpcomingEvents(eventsForLocale(locale), BUILD_NOW)

export const pastEvents = (locale: Locale): readonly ComfyEvent[] =>
  derivePastEvents(eventsForLocale(locale), BUILD_NOW)

export const featuredEvents = (locale: Locale): readonly FeaturedEvent[] =>
  deriveFeaturedEvents(eventsForLocale(locale), BUILD_NOW, locale)

export const watchablePastEvents = (locale: Locale): readonly ComfyEvent[] =>
  pastEvents(locale).filter((event) => eventVideoId(event))

// Events with a stream or recording get their own /events/[slug] page; the
// slug is the event id.
export const watchableEvents = (locale: Locale): readonly ComfyEvent[] =>
  eventsForLocale(locale).filter((event) => eventVideoId(event))

export const getEventBySlug = (
  slug: string,
  locale: Locale
): ComfyEvent | undefined =>
  watchableEvents(locale).find((event) => event.id === slug)
