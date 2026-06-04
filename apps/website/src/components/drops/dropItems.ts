import type { getRoutes } from '../../config/routes'
import type { TranslationKey } from '../../i18n/translations'

type Routes = ReturnType<typeof getRoutes>

interface InternalCta {
  labelKey: TranslationKey
  external: false
  routeKey: keyof Routes
}

interface ExternalCta {
  labelKey: TranslationKey
  external: true
  url: string
}

export type DropCta = InternalCta | ExternalCta

export interface DropItem {
  id: string
  titleKey: TranslationKey
  taglineKey: TranslationKey
  bodyKey: TranslationKey
  imageUrl: string
  cta?: DropCta
}

const REGISTER_FOR_LIVE_DEMO_CTA: ExternalCta = {
  labelKey: 'drops-landing.item.register-for-live-demo.cta',
  external: true,
  url: 'https://luma.com/l7c5z4gp?tk=nm3dWZ'
}

export const dropItems: DropItem[] = [
  {
    id: 'desktop-client',
    titleKey: 'drops-landing.item.desktop-client.title',
    taglineKey: 'drops-landing.item.desktop-client.tagline',
    bodyKey: 'drops-landing.item.desktop-client.body',
    imageUrl: '/drops/desktop-client.svg',
    cta: {
      labelKey: 'drops-landing.item.desktop-client.cta',
      external: false,
      routeKey: 'download'
    }
  },
  {
    id: 'oss-vram',
    titleKey: 'drops-landing.item.oss-vram.title',
    taglineKey: 'drops-landing.item.oss-vram.tagline',
    bodyKey: 'drops-landing.item.oss-vram.body',
    imageUrl: '/drops/oss-vram.svg'
  },
  {
    id: 'comfy-mcp',
    titleKey: 'drops-landing.item.comfy-mcp.title',
    taglineKey: 'drops-landing.item.comfy-mcp.tagline',
    bodyKey: 'drops-landing.item.comfy-mcp.body',
    imageUrl: '/drops/comfy-mcp.svg',
    cta: REGISTER_FOR_LIVE_DEMO_CTA
  },
  {
    id: 'comfy-cli',
    titleKey: 'drops-landing.item.comfy-cli.title',
    taglineKey: 'drops-landing.item.comfy-cli.tagline',
    bodyKey: 'drops-landing.item.comfy-cli.body',
    imageUrl: '/drops/comfy-cli.svg',
    cta: REGISTER_FOR_LIVE_DEMO_CTA
  },
  {
    id: 'team-plans',
    titleKey: 'drops-landing.item.team-plans.title',
    taglineKey: 'drops-landing.item.team-plans.tagline',
    bodyKey: 'drops-landing.item.team-plans.body',
    imageUrl: '/drops/team-plans.svg',
    cta: REGISTER_FOR_LIVE_DEMO_CTA
  }
]

export function resolveCtaHref(cta: DropCta, routes: Routes): string {
  return cta.external ? cta.url : routes[cta.routeKey]
}
