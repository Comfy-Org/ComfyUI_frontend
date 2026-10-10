import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale, LocalizedText } from '@/i18n/translations'

/**
 * Copy for the Apps half only. It ships with that half's lazy chunk rather
 * than the site-wide translations every page loads.
 */
const copy = {
  apps: { en: 'Apps', 'zh-CN': '应用' },
  allApps: { en: 'All apps', 'zh-CN': '全部应用' },
  browseAllApps: { en: 'Browse all apps', 'zh-CN': '浏览全部应用' },
  studioName: { en: 'Cinematic Studio', 'zh-CN': '电影工作室' },
  studioTask: {
    en: 'Direct your shot like a film set',
    'zh-CN': '像在片场一样执导镜头'
  },
  reshootName: { en: 'Re-shoot a video', 'zh-CN': '重拍视频' },
  reshootTask: { en: 'Re-shoot from any angle', 'zh-CN': '从任意角度重拍' },
  moveAnythingName: { en: 'Move anything', 'zh-CN': '随意移动' },
  moveAnythingTask: {
    en: 'Rearrange the things in a photo',
    'zh-CN': '重新摆放照片中的物体'
  },
  relightName: { en: 'Relight', 'zh-CN': '重新布光' },
  relightTask: { en: 'Light a photo again', 'zh-CN': '为照片重新打光' },
  handProductSwapName: { en: 'Hand product swap', 'zh-CN': '手持产品替换' },
  handProductSwapTask: {
    en: 'Put a product in a hand',
    'zh-CN': '把产品放到手中'
  },
  spriteSheetName: { en: 'Sprite Sheet Generator', 'zh-CN': '精灵图生成器' },
  spriteSheetTask: {
    en: 'Animate a character for a game',
    'zh-CN': '为游戏制作角色动画'
  },
  paparazziMeName: { en: 'Paparazzi me', 'zh-CN': '狗仔偶遇' },
  paparazziMeTask: {
    en: 'Get snapped next to a star',
    'zh-CN': '和明星同框被拍'
  },
  backgroundRemovalName: { en: 'Background Removal', 'zh-CN': '背景移除' },
  backgroundRemovalTask: {
    en: 'Cut the subject out of a photo',
    'zh-CN': '将主体从照片中抠出'
  }
} as const satisfies Record<string, LocalizedText>

export function ac(key: keyof typeof copy, locale: Locale = 'en'): string {
  return copy[key][locale === 'zh-CN' ? locale : 'en']
}

export interface CatalogueApp {
  readonly key: string
  readonly name: string
  readonly task: string
  readonly href: string
  readonly thumbnail?: WorkshopModel['thumbnail']
}
