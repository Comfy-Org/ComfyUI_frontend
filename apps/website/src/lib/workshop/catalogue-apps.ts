import { getRoutes } from '../../config/routes'
import type { Locale, LocalizedText } from '../../i18n/translations'

/**
 * Copy for the Apps half only. It ships with that half's lazy chunk rather
 * than the site-wide translations every page loads.
 */
const copy = {
  apps: { en: 'Apps', 'zh-CN': '应用' },
  allApps: { en: 'All apps', 'zh-CN': '全部应用' },
  browseAllApps: { en: 'Browse all apps', 'zh-CN': '浏览全部应用' },
  beta: { en: 'Beta', 'zh-CN': '测试版' },
  prototype: { en: 'Prototype', 'zh-CN': '原型' },
  studioName: { en: 'Cinematic Studio', 'zh-CN': '电影工作室' },
  studioSummary: {
    en: 'Direct a shot with a real camera, light and grade, then run it on any image model.',
    'zh-CN':
      '用真实的摄影机、光线与调色导演一个镜头，然后在任意图像模型上运行。'
  },
  reshootName: { en: 'Re-shoot a video', 'zh-CN': '重拍视频' },
  reshootSummary: {
    en: 'Aim a new camera at your clip and generate the scene from that angle.',
    'zh-CN': '为你的片段重新架设机位，从新的角度生成这一场景。'
  }
} as const satisfies Record<string, LocalizedText>

export function ac(key: keyof typeof copy, locale: Locale = 'en'): string {
  return copy[key][locale === 'zh-CN' ? locale : 'en']
}

export interface CatalogueApp {
  readonly key: string
  readonly name: string
  readonly summary: string
  readonly badge: string
  readonly href: string
  readonly image?: string
}

export function catalogueApps(locale: Locale = 'en'): CatalogueApp[] {
  const studio = getRoutes(locale).cinematicStudio
  return [
    {
      key: 'cinematic-studio',
      name: ac('studioName', locale),
      summary: ac('studioSummary', locale),
      badge: ac('beta', locale),
      href: studio,
      image: '/images/cinematic-studio/neon-street.jpg'
    },
    {
      key: 'reshoot',
      name: ac('reshootName', locale),
      summary: ac('reshootSummary', locale),
      badge: ac('prototype', locale),
      href: `${studio}?app=reshoot`
    }
  ]
}
