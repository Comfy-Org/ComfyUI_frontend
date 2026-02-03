type AuthorProfileStats = {
  runs: number
  copies: number
}

type AuthorProfile = {
  slug: string
  name: string
  avatarUrl?: string
  stats?: AuthorProfileStats
}

const KNOWN_AUTHORS: Record<string, AuthorProfile> = {
  comfyorg: {
    slug: 'comfyorg',
    name: 'Comfy Org',
    avatarUrl: '/assets/images/comfy-logo-single.svg',
    stats: { runs: 128_400, copies: 4_260 }
  }
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '')
    .trim()

export const authorNameToSlug = (name: string) =>
  KNOWN_AUTHORS[slugify(name)]?.slug ?? slugify(name)

const titleize = (value: string) =>
  value
    .replaceAll(/[-_]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replaceAll(/\b\w/g, (char) => char.toUpperCase())

export const authorSlugToProfile = (slug: string): AuthorProfile => {
  const normalized = slugify(slug)
  return (
    KNOWN_AUTHORS[normalized] ?? {
      slug: normalized,
      name: titleize(slug)
    }
  )
}
