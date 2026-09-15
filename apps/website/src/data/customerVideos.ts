import type { VideoTrack } from '../components/common/VideoPlayer.vue'

/**
 * Single source of truth for the two customer-story videos that get a
 * dedicated watch page: Black Math and Silverside AI. Everything that needs
 * a slug, title, media path, or duration for one of these stories reads it
 * from here — the /customers directory cards, the watch pages themselves,
 * their JSON-LD (VideoObject, BreadcrumbList), the video sitemap, and the
 * homepage/pricing internal links.
 */
export interface CustomerVideoStory {
  /** Path segment: /customers/videos/<slug>. */
  slug: 'black-math' | 'silverside-ai'
  company: string
  /** Directory-card eyebrow, e.g. "CASE STUDY". */
  category: string
  /** Watch-page H1 and directory-card title. */
  title: string
  /** Meta description, watch-page synopsis, and directory-card synopsis. */
  description: string
  videoSrc: string
  poster: string
  /**
   * Assumed 16:9 dimensions — media.comfy.org could not be reached from the
   * implementing environment to read the poster's real intrinsic size, so
   * these are a placeholder matching the `aspect-video` CSS every card and
   * the player already render at (that class governs on-screen layout
   * regardless of these numbers, so there's no layout-shift risk from the
   * assumption, but they should be replaced with the verified pixel size).
   */
  posterWidth: number
  posterHeight: number
  captions: readonly VideoTrack[]
  /**
   * Verified with ffprobe against the source file. BLOCKED: media.comfy.org
   * is unreachable from the implementing environment (egress denied), and
   * ffprobe isn't installed there either, so this could not be measured.
   * Left undefined rather than guessed — every consumer (VideoObject
   * JSON-LD, the video sitemap, the directory card's duration chip) treats
   * a missing value as "omit", never as a fabricated placeholder.
   */
  durationSeconds?: number
  /**
   * ISO 8601 date. Only set when backed by an authoritative source or a
   * documented proxy (e.g. the asset's first git-log commit date) — never
   * invented. Left unset for both stories: no such source was available to
   * the implementing environment.
   */
  uploadDate?: string
  /** Slug of the reciprocal written story under src/content/customers, if any. */
  relatedStorySlug?: string
}

const blackMathCaptions: readonly VideoTrack[] = [
  {
    src: 'https://media.comfy.org/website/customers/blackmath/video.vtt',
    kind: 'subtitles',
    srclang: 'en',
    label: 'English'
  }
]

const silversideCaptions: readonly VideoTrack[] = [
  {
    src: 'https://media.comfy.org/website/customers/silverside/video.vtt',
    kind: 'subtitles',
    srclang: 'en',
    label: 'English'
  }
]

export const customerVideoStories: readonly CustomerVideoStory[] = [
  {
    slug: 'black-math',
    company: 'Black Math',
    category: 'CASE STUDY',
    title: 'How Black Math builds interactive design systems with ComfyUI',
    description:
      "Black Math's artists and technical directors explain how they use ComfyUI to build extendable creative systems while keeping art direction and control with the team.",
    videoSrc: 'https://media.comfy.org/website/customers/blackmath/video.webm',
    poster: 'https://media.comfy.org/website/customers/blackmath/poster.webp',
    posterWidth: 1280,
    posterHeight: 720,
    captions: blackMathCaptions
  },
  {
    slug: 'silverside-ai',
    company: 'Silverside AI',
    category: 'CASE STUDY',
    title: 'How Silverside AI builds production workflows with ComfyUI',
    description:
      'Silverside AI explains why structured, node-based ComfyUI workflows give creative teams control beyond single-prompt tools.',
    videoSrc: 'https://media.comfy.org/website/customers/silverside/video.webm',
    poster: 'https://media.comfy.org/website/customers/silverside/poster.webp',
    posterWidth: 1280,
    posterHeight: 720,
    captions: silversideCaptions,
    relatedStorySlug: 'svedka-silverside'
  }
]

export function getCustomerVideoStory(
  slug: CustomerVideoStory['slug']
): CustomerVideoStory {
  const story = customerVideoStories.find((item) => item.slug === slug)
  if (!story) throw new Error(`getCustomerVideoStory: no story for "${slug}"`)
  return story
}

/** Canonical path for a video story's watch page (English-only, no locale twin). */
export function customerVideoPath(slug: CustomerVideoStory['slug']): string {
  return `/customers/videos/${slug}`
}

/** ISO 8601 duration (e.g. "PT4M32S") for VideoObject JSON-LD, or undefined. */
export function isoDuration(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0)
    return undefined
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  const secs = whole % 60
  return `PT${minutes}M${secs}S`
}

/** "4:32" for a duration chip, or undefined when the duration is unverified. */
export function formatDuration(
  seconds: number | undefined
): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0)
    return undefined
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  const secs = whole % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/** The watch page for a written story's video, when it has one, for the
 * reciprocal "watch the video" link on the article page. */
export function customerVideoForStory(
  storySlug: string
): CustomerVideoStory | undefined {
  return customerVideoStories.find(
    (story) => story.relatedStorySlug === storySlug
  )
}

/** Other stories to cross-link from a given video's watch page. */
export function otherCustomerVideoStories(
  slug: CustomerVideoStory['slug']
): readonly CustomerVideoStory[] {
  return customerVideoStories.filter((story) => story.slug !== slug)
}
