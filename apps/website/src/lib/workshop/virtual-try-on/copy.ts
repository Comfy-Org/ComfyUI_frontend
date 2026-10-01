import type { NamedValues } from '../../../i18n/interpolate'
import { interpolate } from '../../../i18n/interpolate'
import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  'tryOn.title': { en: 'Virtual try-on', 'zh-CN': '虚拟试穿' },
  'tryOn.tools': { en: 'Virtual try-on tools', 'zh-CN': '虚拟试穿工具' },
  'tryOn.panel': { en: 'Virtual try-on settings', 'zh-CN': '虚拟试穿设置' },
  'tryOn.panel.expand': { en: 'Show all settings', 'zh-CN': '显示全部设置' },
  'tryOn.panel.collapse': { en: 'Hide settings', 'zh-CN': '收起设置' },
  'tryOn.close': { en: 'Close', 'zh-CN': '关闭' },
  'tryOn.history': { en: 'History', 'zh-CN': '历史记录' },
  'tryOn.tool.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'tryOn.tool.redo': { en: 'Redo', 'zh-CN': '重做' },
  'tryOn.tool.guide': { en: 'Fit guide', 'zh-CN': '版型参考线' },
  'tryOn.hint': {
    en: 'Pick a garment and a fit, then try it on',
    'zh-CN': '选择一件衣服和版型，然后试穿'
  },
  'tryOn.person': { en: 'Person', 'zh-CN': '人物' },
  'tryOn.person.change': { en: 'Change', 'zh-CN': '更换' },
  'tryOn.person.changeLabel': {
    en: 'Change the photo of the person',
    'zh-CN': '更换人物照片'
  },
  'tryOn.person.size': {
    en: '{width} × {height}',
    'zh-CN': '{width} × {height}'
  },
  'tryOn.garment': { en: 'Garment', 'zh-CN': '服装' },
  'tryOn.garment.none': { en: 'None', 'zh-CN': '无' },
  'tryOn.garment.upload': { en: 'Upload a garment', 'zh-CN': '上传服装' },
  'tryOn.garment.replace': { en: 'Replace garment', 'zh-CN': '替换服装' },
  'tryOn.garment.remove': { en: 'Remove garment', 'zh-CN': '移除服装' },
  'tryOn.garment.yours': { en: 'Your garment', 'zh-CN': '你的服装' },
  'tryOn.garment.empty': {
    en: 'Drop a garment photo',
    'zh-CN': '拖入服装照片'
  },
  'tryOn.garment.emptyMeta': {
    en: 'A flat lay or product shot works best',
    'zh-CN': '平铺图或商品图效果最佳'
  },
  'tryOn.garment.choose': { en: 'Choose', 'zh-CN': '选择' },
  'tryOn.garment.breton': { en: 'Breton tee', 'zh-CN': '海魂衫' },
  'tryOn.garment.flannel': { en: 'Flannel shirt', 'zh-CN': '法兰绒衬衫' },
  'tryOn.garment.knit': { en: 'Sage knit', 'zh-CN': '鼠尾草绿针织衫' },
  'tryOn.fit': { en: 'Fit', 'zh-CN': '版型' },
  'tryOn.fit.slim': { en: 'Slim', 'zh-CN': '修身' },
  'tryOn.fit.regular': { en: 'Regular', 'zh-CN': '常规' },
  'tryOn.fit.relaxed': { en: 'Relaxed', 'zh-CN': '宽松' },
  'tryOn.advanced': { en: 'Advanced', 'zh-CN': '高级' },
  'tryOn.seed': { en: 'Seed', 'zh-CN': '种子' },
  'tryOn.advanced.summary': { en: 'Seed {n}', 'zh-CN': '种子 {n}' },
  'tryOn.summary': {
    en: '{garment} · {fit} fit',
    'zh-CN': '{garment} · {fit}版型'
  },
  'tryOn.summary.empty': {
    en: 'Add a garment to try on',
    'zh-CN': '添加一件要试穿的服装'
  },
  'tryOn.run': { en: 'Try it on', 'zh-CN': '开始试穿' },
  'tryOn.run.idle': { en: 'Add a garment first', 'zh-CN': '请先添加服装' },
  'tryOn.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'tryOn.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'tryOn.busy.title': { en: 'Dressing the photo…', 'zh-CN': '正在试穿…' },
  'tryOn.busy.detail': {
    en: '{time} · {garment}, {fit} fit',
    'zh-CN': '{time} · {garment}，{fit}版型'
  },
  'tryOn.failed': {
    en: 'The try-on didn’t finish. No credits were used.',
    'zh-CN': '试穿未完成，未扣除积分。'
  },
  'tryOn.view.compare': { en: 'Compare', 'zh-CN': '对比' },
  'tryOn.view.original': { en: 'Original', 'zh-CN': '原图' },
  'tryOn.view.result': { en: 'Result', 'zh-CN': '结果' },
  'tryOn.compare': {
    en: 'Drag to compare the original and the try-on',
    'zh-CN': '拖动以对比原图与试穿效果'
  },
  'tryOn.edit': { en: 'Edit', 'zh-CN': '编辑' },
  'tryOn.again': { en: 'Try again', 'zh-CN': '再试一次' },
  'tryOn.download': { en: 'Download', 'zh-CN': '下载' },
  'tryOn.alt.person': {
    en: 'A woman in a mustard corduroy jacket on a motel balcony',
    'zh-CN': '汽车旅馆阳台上身穿芥末黄灯芯绒夹克的女士'
  },
  'tryOn.alt.result': {
    en: 'The photo with the garment tried on',
    'zh-CN': '试穿服装后的照片'
  },
  'tryOn.alt.garment': { en: 'Garment: {name}', 'zh-CN': '服装：{name}' }
} as const satisfies Record<string, LocalizedText>

export type TryOnCopyKey = keyof typeof copy

export function vc(
  key: TryOnCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  return interpolate(entry[locale] ?? entry.en, named)
}
