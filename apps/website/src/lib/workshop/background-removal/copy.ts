import type { NamedValues } from '../../../i18n/interpolate'
import { interpolate } from '../../../i18n/interpolate'
import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  'cutout.title': { en: 'Background Removal', 'zh-CN': '背景移除' },
  'cutout.tools': { en: 'Background Removal tools', 'zh-CN': '背景移除工具' },
  'cutout.panel': {
    en: 'Background Removal settings',
    'zh-CN': '背景移除设置'
  },
  'cutout.panel.expand': { en: 'Show all settings', 'zh-CN': '显示全部设置' },
  'cutout.panel.collapse': { en: 'Hide settings', 'zh-CN': '收起设置' },
  'cutout.empty.title': {
    en: 'Drop a photo to cut out',
    'zh-CN': '拖入一张照片来抠图'
  },
  'cutout.empty.meta': {
    en: 'PNG, JPG or WebP. The subject is kept, the background goes.',
    'zh-CN': 'PNG、JPG 或 WebP。保留主体，移除背景。'
  },
  'cutout.empty.upload': { en: 'Choose a photo', 'zh-CN': '选择照片' },
  'cutout.empty.example': { en: 'Try the example', 'zh-CN': '试用示例' },
  'cutout.hint': {
    en: 'Pick a background, then run',
    'zh-CN': '选择背景，然后运行'
  },
  'cutout.history': { en: 'History', 'zh-CN': '历史记录' },
  'cutout.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'cutout.redo': { en: 'Redo', 'zh-CN': '重做' },
  'cutout.background': { en: 'Background', 'zh-CN': '背景' },
  'cutout.background.transparent': { en: 'Transparent', 'zh-CN': '透明' },
  'cutout.background.white': { en: 'White', 'zh-CN': '白色' },
  'cutout.background.lilac': { en: 'Lilac', 'zh-CN': '淡紫色' },
  'cutout.format': { en: 'Format', 'zh-CN': '格式' },
  'cutout.format.png': { en: 'PNG', 'zh-CN': 'PNG' },
  'cutout.format.png.detail': { en: 'Lossless', 'zh-CN': '无损' },
  'cutout.format.webp': { en: 'WebP', 'zh-CN': 'WebP' },
  'cutout.format.webp.detail': { en: 'Smaller file', 'zh-CN': '文件更小' },
  'cutout.advanced': { en: 'Advanced', 'zh-CN': '高级' },
  'cutout.advanced.value': { en: 'Edge {n}%', 'zh-CN': '边缘 {n}%' },
  'cutout.edge': { en: 'Edge softness', 'zh-CN': '边缘柔和度' },
  'cutout.seed': { en: 'Seed', 'zh-CN': '种子' },
  'cutout.seed.shuffle': { en: 'New seed', 'zh-CN': '换一个种子' },
  'cutout.summary': {
    en: '{background} · {format}',
    'zh-CN': '{background} · {format}'
  },
  'cutout.close': { en: 'Close', 'zh-CN': '关闭' },
  'cutout.run': { en: 'Remove background', 'zh-CN': '移除背景' },
  'cutout.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'cutout.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'cutout.busy.title': {
    en: 'Removing the background…',
    'zh-CN': '正在移除背景…'
  },
  'cutout.busy.detail': {
    en: '{time} · {background} {format}',
    'zh-CN': '{time} · {background} {format}'
  },
  'cutout.failed': {
    en: 'The cutout didn’t finish. No credits were used.',
    'zh-CN': '抠图未完成，未扣除积分。'
  },
  'cutout.view.compare': { en: 'Compare', 'zh-CN': '对比' },
  'cutout.view.result': { en: 'Result', 'zh-CN': '结果' },
  'cutout.view.original': { en: 'Original', 'zh-CN': '原图' },
  'cutout.edit': { en: 'Edit settings', 'zh-CN': '编辑设置' },
  'cutout.again': { en: 'Try again', 'zh-CN': '再试一次' },
  'cutout.download': { en: 'Download', 'zh-CN': '下载' },
  'cutout.compare': {
    en: 'Drag to compare the original and the cutout',
    'zh-CN': '拖动以对比原图与抠图结果'
  },
  'cutout.alt.example': {
    en: 'A leafy plant in a terracotta pot on a wooden table',
    'zh-CN': '木桌上一盆种在陶土盆里的绿叶植物'
  },
  'cutout.alt.result': {
    en: 'The subject with its background removed',
    'zh-CN': '移除背景后的主体'
  }
} as const satisfies Record<string, LocalizedText>

export type CutoutCopyKey = keyof typeof copy

/** Background Removal copy. */
export function brc(
  key: CutoutCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  return interpolate(entry[locale] ?? entry.en, named)
}
