import type { Locale, LocalizedText } from '@/i18n/translations'

const copy = {
  'swap.title': { en: 'Hand product swap', 'zh-CN': '手持产品替换' },
  'swap.tools': { en: 'Hand product swap tools', 'zh-CN': '手持产品替换工具' },
  'swap.panel': {
    en: 'Hand product swap settings',
    'zh-CN': '手持产品替换设置'
  },
  'swap.panel.expand': { en: 'Show all settings', 'zh-CN': '显示全部设置' },
  'swap.panel.collapse': { en: 'Hide settings', 'zh-CN': '收起设置' },
  'swap.empty.title': {
    en: 'Drop a photo of a hand holding something',
    'zh-CN': '拖入一张手持物品的照片'
  },
  'swap.empty.meta': {
    en: 'Same hand & grip, new product. Drop, paste or choose a PNG, JPG or WebP.',
    'zh-CN': '同样的手和握姿，换上新产品。拖入、粘贴或选择 PNG、JPG 或 WebP。'
  },
  'swap.empty.upload': { en: 'Choose a photo', 'zh-CN': '选择照片' },
  'swap.empty.example': { en: 'Try the example', 'zh-CN': '试用示例' },
  'swap.hint': {
    en: 'Same hand & grip, new product',
    'zh-CN': '同样的手和握姿，换上新产品'
  },
  'swap.tool.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'swap.tool.redo': { en: 'Redo', 'zh-CN': '重做' },
  'swap.history': { en: 'History', 'zh-CN': '历史记录' },
  'swap.hand.change': { en: 'Change hand photo', 'zh-CN': '更换手部照片' },
  'swap.product': { en: 'Product', 'zh-CN': '产品' },
  'swap.product.can': { en: 'Can', 'zh-CN': '易拉罐' },
  'swap.product.serum': { en: 'Serum', 'zh-CN': '精华' },
  'swap.product.tube': { en: 'Cream', 'zh-CN': '护手霜' },
  'swap.product.own': { en: 'Yours', 'zh-CN': '你的产品' },
  'swap.product.upload': { en: 'Upload', 'zh-CN': '上传' },
  'swap.product.uploadLabel': {
    en: 'Upload a product image. A cut-out PNG or a shot on white works best.',
    'zh-CN': '上传产品图片。透明背景 PNG 或白底产品图效果最佳。'
  },
  'swap.product.change': { en: 'Change product', 'zh-CN': '更换产品' },
  'swap.resolution': { en: 'Resolution', 'zh-CN': '分辨率' },
  'swap.resolution.size': {
    en: '{width} × {height} px',
    'zh-CN': '{width} × {height} 像素'
  },
  'swap.seed': { en: 'Seed', 'zh-CN': '种子' },
  'swap.seed.shuffle': { en: 'New seed', 'zh-CN': '换一个种子' },
  'swap.summary': {
    en: '{product} · {resolution}',
    'zh-CN': '{product} · {resolution}'
  },
  'swap.close': { en: 'Close', 'zh-CN': '关闭' },
  'swap.run': { en: 'Swap product', 'zh-CN': '替换产品' },
  'swap.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'swap.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'swap.busy.title': { en: 'Swapping the product…', 'zh-CN': '正在替换产品…' },
  'swap.busy.detail': {
    en: '{status} · {product} · {resolution} · {time}',
    'zh-CN': '{status} · {product} · {resolution} · {time}'
  },
  'swap.progress.queued': { en: 'Queued', 'zh-CN': '排队中' },
  'swap.progress.percent': { en: '{n}%', 'zh-CN': '{n}%' },
  'swap.failed': {
    en: 'The swap didn’t finish. No credits were used.',
    'zh-CN': '替换未完成，未扣除积分。'
  },
  'swap.compare': { en: 'Compare', 'zh-CN': '对比' },
  'swap.compare.slider': {
    en: 'Drag to compare the original and the result',
    'zh-CN': '拖动以对比原图与结果'
  },
  'swap.view.original': { en: 'Original', 'zh-CN': '原图' },
  'swap.view.result': { en: 'Result', 'zh-CN': '结果' },
  'swap.edit': { en: 'Edit', 'zh-CN': '编辑' },
  'swap.again': { en: 'Try again', 'zh-CN': '再试一次' },
  'swap.alt.example': {
    en: 'A hand holding a plain white can against a beige backdrop',
    'zh-CN': '一只手在米色背景前握着一个白色罐子'
  },
  'swap.alt.result': {
    en: 'The hand photo holding your product',
    'zh-CN': '手中握着你的产品的照片'
  }
} as const satisfies Record<string, LocalizedText>

export type HandSwapCopyKey = keyof typeof copy

type NamedValues = Record<string, string | number>

/** Hand product swap copy. */
export function hc(
  key: HandSwapCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  return (entry[locale] ?? entry.en).replace(
    /\{(\w+)\}/g,
    (placeholder, name: string) =>
      Object.hasOwn(named, name) ? String(named[name]) : placeholder
  )
}
