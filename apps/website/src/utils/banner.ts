// Pure, framework-agnostic banner logic — no Vue/Astro/config imports so it stays
// trivially unit-testable. Locale/section are plain strings on purpose.

export interface BannerVisibilityContext {
  currentLocale: string
  currentSection: string
  now: Date
}

export interface EvaluableBanner {
  isActive: boolean
  startsAt?: string
  endsAt?: string
  targetLocales?: readonly string[]
  targetSections?: readonly string[]
}

/**
 * Server/build-time visibility gate. Returns false on the FIRST failing check,
 * in order: active flag → start window → end window → locale targeting →
 * section targeting. An empty/absent `targetLocales` means "all locales".
 */
export function evaluateBannerVisibility(
  banner: EvaluableBanner,
  ctx: BannerVisibilityContext
): boolean {
  if (!banner.isActive) return false
  if (
    banner.startsAt &&
    ctx.now.getTime() < new Date(banner.startsAt).getTime()
  )
    return false
  if (banner.endsAt && ctx.now.getTime() > new Date(banner.endsAt).getTime())
    return false

  const targetLocales = banner.targetLocales ?? []
  if (targetLocales.length > 0 && !targetLocales.includes(ctx.currentLocale))
    return false

  const targetSections = banner.targetSections ?? []
  if (!targetSections.includes(ctx.currentSection)) return false

  return true
}

export interface BannerLinkContent {
  href: string
  title: string
  target?: string
  rel?: string
  buttonVariant?: string
}

export interface BannerVersionContent {
  id: string
  title: string
  description?: string
  link?: BannerLinkContent
}

/**
 * Content-aware version key. Editing the copy changes the hash, so a previously
 * dismissed banner re-appears. Keyed per-locale so a zh-CN edit doesn't re-show
 * the banner for en visitors. Format: `${content.id}_${locale}_v${hash}`.
 */
export function createBannerVersion(
  content: BannerVersionContent,
  locale: string
): string {
  const contentString = JSON.stringify({
    locale,
    title: content.title,
    description: content.description,
    link: content.link
  })
  let hash = 0
  for (const char of contentString) {
    hash = Math.imul(hash, 31) + char.charCodeAt(0)
  }
  return `${content.id}_${locale}_v${hash}`
}
