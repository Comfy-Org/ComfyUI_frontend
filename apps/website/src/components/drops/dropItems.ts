import type { TranslationKey } from '../../i18n/translations'

export interface DropItem {
  id: string
  titleKey: TranslationKey
  taglineKey: TranslationKey
  bodyKey: TranslationKey
  ctaKey: TranslationKey
  imageUrl: string
  href: string
  external: boolean
}

export const dropItems: DropItem[] = [
  {
    id: 'desktop-client',
    titleKey: 'drops-landing.item.desktop-client.title',
    taglineKey: 'drops-landing.item.desktop-client.tagline',
    bodyKey: 'drops-landing.item.desktop-client.body',
    ctaKey: 'drops-landing.item.desktop-client.cta',
    imageUrl: '/drops/desktop-client.svg',
    href: '/download',
    external: false
  },
  {
    id: 'oss-vram',
    titleKey: 'drops-landing.item.oss-vram.title',
    taglineKey: 'drops-landing.item.oss-vram.tagline',
    bodyKey: 'drops-landing.item.oss-vram.body',
    ctaKey: 'drops-landing.item.oss-vram.cta',
    imageUrl: '/drops/oss-vram.svg',
    href: 'https://github.com/Comfy-Org/ComfyUI/releases',
    external: true
  },
  {
    id: 'comfy-mcp',
    titleKey: 'drops-landing.item.comfy-mcp.title',
    taglineKey: 'drops-landing.item.comfy-mcp.tagline',
    bodyKey: 'drops-landing.item.comfy-mcp.body',
    ctaKey: 'drops-landing.item.comfy-mcp.cta',
    imageUrl: '/drops/comfy-mcp.svg',
    href: 'https://docs.comfy.org/',
    external: true
  },
  {
    id: 'comfy-cli',
    titleKey: 'drops-landing.item.comfy-cli.title',
    taglineKey: 'drops-landing.item.comfy-cli.tagline',
    bodyKey: 'drops-landing.item.comfy-cli.body',
    ctaKey: 'drops-landing.item.comfy-cli.cta',
    imageUrl: '/drops/comfy-cli.svg',
    href: 'https://docs.comfy.org/',
    external: true
  },
  {
    id: 'team-plans',
    titleKey: 'drops-landing.item.team-plans.title',
    taglineKey: 'drops-landing.item.team-plans.tagline',
    bodyKey: 'drops-landing.item.team-plans.body',
    ctaKey: 'drops-landing.item.team-plans.cta',
    imageUrl: '/drops/team-plans.svg',
    href: 'https://cloud.comfy.org',
    external: true
  }
]
