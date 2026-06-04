import type { getRoutes } from '../../config/routes'
import type { TranslationKey } from '../../i18n/translations'

type Routes = ReturnType<typeof getRoutes>

interface DropItemBase {
  id: string
  titleKey: TranslationKey
  taglineKey: TranslationKey
  bodyKey: TranslationKey
  ctaKey: TranslationKey
  imageUrl: string
}

interface InternalDropItem extends DropItemBase {
  external: false
  routeKey: keyof Routes
}

interface ExternalDropItem extends DropItemBase {
  external: true
  url: string
}

export type DropItem = InternalDropItem | ExternalDropItem

export const dropItems: DropItem[] = [
  {
    id: 'desktop-client',
    titleKey: 'drops-landing.item.desktop-client.title',
    taglineKey: 'drops-landing.item.desktop-client.tagline',
    bodyKey: 'drops-landing.item.desktop-client.body',
    ctaKey: 'drops-landing.item.desktop-client.cta',
    imageUrl: '/drops/desktop-client.svg',
    external: false,
    routeKey: 'download'
  },
  {
    id: 'oss-vram',
    titleKey: 'drops-landing.item.oss-vram.title',
    taglineKey: 'drops-landing.item.oss-vram.tagline',
    bodyKey: 'drops-landing.item.oss-vram.body',
    ctaKey: 'drops-landing.item.oss-vram.cta',
    imageUrl: '/drops/oss-vram.svg',
    external: true,
    url: 'https://github.com/Comfy-Org/ComfyUI/releases'
  },
  {
    id: 'comfy-mcp',
    titleKey: 'drops-landing.item.comfy-mcp.title',
    taglineKey: 'drops-landing.item.comfy-mcp.tagline',
    bodyKey: 'drops-landing.item.comfy-mcp.body',
    ctaKey: 'drops-landing.item.comfy-mcp.cta',
    imageUrl: '/drops/comfy-mcp.svg',
    external: true,
    url: 'https://docs.comfy.org/'
  },
  {
    id: 'comfy-cli',
    titleKey: 'drops-landing.item.comfy-cli.title',
    taglineKey: 'drops-landing.item.comfy-cli.tagline',
    bodyKey: 'drops-landing.item.comfy-cli.body',
    ctaKey: 'drops-landing.item.comfy-cli.cta',
    imageUrl: '/drops/comfy-cli.svg',
    external: true,
    url: 'https://docs.comfy.org/'
  },
  {
    id: 'team-plans',
    titleKey: 'drops-landing.item.team-plans.title',
    taglineKey: 'drops-landing.item.team-plans.tagline',
    bodyKey: 'drops-landing.item.team-plans.body',
    ctaKey: 'drops-landing.item.team-plans.cta',
    imageUrl: '/drops/team-plans.svg',
    external: true,
    url: 'https://cloud.comfy.org'
  }
]

export function resolveDropHref(item: DropItem, routes: Routes): string {
  return item.external ? item.url : routes[item.routeKey]
}
