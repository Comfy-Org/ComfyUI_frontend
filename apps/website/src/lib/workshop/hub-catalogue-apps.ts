import type { Locale, LocalizedText, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import type { CatalogueApp } from './catalogue-apps'

/**
 * Copy for the Apps half only. It ships with that half's lazy chunk rather
 * than the site-wide translations every page loads.
 */
const copy = {
  apps: { en: 'Apps', 'zh-CN': '应用' },
  studioTask: {
    en: 'Direct every shot. Pick the camera, lens, light and grade.',
    'zh-CN': '执导每一个镜头。选择摄影机、镜头、光线和调色。'
  },
  reshootTask: {
    en: 'Upload a shot and re-frame it from a new camera angle.',
    'zh-CN': '上传一个镜头，从新的机位角度重新取景。'
  },
  moveAnythingName: { en: 'Move anything', 'zh-CN': '随意移动' },
  moveAnythingTask: {
    en: 'Drag an object in a still and get a clip where it moves.',
    'zh-CN': '在静态图中拖动物体，生成它移动起来的片段。'
  },
  relightName: { en: 'Relight', 'zh-CN': '重新布光' },
  relightTask: {
    en: 'Point the light where you want it.',
    'zh-CN': '把光打到你想要的地方。'
  },
  handProductSwapName: { en: 'Hand product swap', 'zh-CN': '手持产品替换' },
  handProductSwapTask: {
    en: 'Put a product in a hand',
    'zh-CN': '把产品放到手中'
  },
  backgroundRemovalName: { en: 'Background Removal', 'zh-CN': '背景移除' },
  backgroundRemovalTask: {
    en: 'Clean cut-outs for products and people in one click.',
    'zh-CN': '一键为产品和人物干净抠图。'
  },
  virtualTryOnName: { en: 'Virtual try-on', 'zh-CN': '虚拟试穿' },
  virtualTryOnTask: {
    en: 'Put any garment on any model photo.',
    'zh-CN': '把任意服装穿到任意模特照片上。'
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
  }
} as const satisfies Record<string, LocalizedText>

export function ac(key: keyof typeof copy, locale: Locale = 'en'): string {
  return copy[key][locale === 'zh-CN' ? locale : 'en']
}

/** A card on the Hub's app grid. An app still being built has no `href`. */
export interface HubCatalogueApp extends Omit<CatalogueApp, 'href'> {
  readonly href?: string
}

const OPEN_APPS = new Map<
  string,
  { task: 'studioTask' | 'reshootTask'; meta: TranslationKey }
>([
  [
    'apps/cinematic-studio',
    { task: 'studioTask', meta: 'cinematic.hub.studioMeta' }
  ],
  ['apps/reshoot', { task: 'reshootTask', meta: 'cinematic.hub.reshootMeta' }]
])

/** An open app in the Hub's words: its summary and what it makes and runs on. */
export function hubOpenApp(
  app: CatalogueApp,
  locale: Locale = 'en'
): { app: HubCatalogueApp; meta?: string } {
  const words = OPEN_APPS.get(app.key)
  if (!words) return { app }
  return {
    app: { ...app, task: ac(words.task, locale) },
    meta: translationsFor(locale).t(words.meta)
  }
}
