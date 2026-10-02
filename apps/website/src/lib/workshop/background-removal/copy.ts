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
  'cutout.mode': { en: 'Mode', 'zh-CN': '模式' },
  'cutout.mode.remove': { en: 'Remove', 'zh-CN': '移除' },
  'cutout.mode.replace': { en: 'Replace', 'zh-CN': '替换' },
  'cutout.mode.adjust': { en: 'Adjust', 'zh-CN': '调整' },
  'cutout.swatches': { en: 'Background colour', 'zh-CN': '背景颜色' },
  'cutout.swatch.transparent': { en: 'Transparent', 'zh-CN': '透明' },
  'cutout.swatch.white': { en: 'White', 'zh-CN': '白色' },
  'cutout.swatch.lilac': { en: 'Lilac', 'zh-CN': '淡紫色' },
  'cutout.swatch.sand': { en: 'Sand', 'zh-CN': '沙色' },
  'cutout.swatch.sage': { en: 'Sage', 'zh-CN': '鼠尾草绿' },
  'cutout.swatch.sky': { en: 'Sky', 'zh-CN': '天蓝' },
  'cutout.swatch.blush': { en: 'Blush', 'zh-CN': '浅粉' },
  'cutout.swatch.butter': { en: 'Butter', 'zh-CN': '奶油黄' },
  'cutout.swatch.clay': { en: 'Clay', 'zh-CN': '陶土色' },
  'cutout.swatch.navy': { en: 'Navy', 'zh-CN': '藏青' },
  'cutout.swatch.ink': { en: 'Ink', 'zh-CN': '墨黑' },
  'cutout.swatch.custom': { en: 'Custom colour', 'zh-CN': '自定义颜色' },
  'cutout.replace.model': { en: 'Model', 'zh-CN': '模型' },
  'cutout.replace.model.auto': { en: 'Auto', 'zh-CN': '自动' },
  'cutout.replace.prompt': {
    en: 'New background',
    'zh-CN': '新背景'
  },
  'cutout.replace.placeholder': {
    en: 'Describe the background you want to generate',
    'zh-CN': '描述你想生成的背景'
  },
  'cutout.replace.reference': {
    en: 'Add a reference image',
    'zh-CN': '添加参考图'
  },
  'cutout.replace.reference.remove': {
    en: 'Remove the reference image',
    'zh-CN': '移除参考图'
  },
  'cutout.replace.count': {
    en: 'Generates {n} image',
    'zh-CN': '生成 {n} 张图片'
  },
  'cutout.replace.count.short': { en: '×{n}', 'zh-CN': '×{n}' },
  'cutout.replace.missing': {
    en: 'Add a prompt or reference',
    'zh-CN': '请输入描述或添加参考图'
  },
  'cutout.replace.missing.full': {
    en: 'Describe a background or add a reference image.',
    'zh-CN': '请描述背景或添加参考图。'
  },
  'cutout.replace.value': {
    en: 'Replace · {model}',
    'zh-CN': '替换 · {model}'
  },
  'cutout.adjust.target': { en: 'Apply to', 'zh-CN': '应用于' },
  'cutout.adjust.target.background': { en: 'Background', 'zh-CN': '背景' },
  'cutout.adjust.target.foreground': { en: 'Foreground', 'zh-CN': '前景' },
  'cutout.adjust.blur': { en: 'Blur', 'zh-CN': '模糊' },
  'cutout.adjust.grayscale': { en: 'Grayscale', 'zh-CN': '灰度' },
  'cutout.adjust.sepia': { en: 'Sepia', 'zh-CN': '复古' },
  'cutout.adjust.brightness': { en: 'Brightness', 'zh-CN': '亮度' },
  'cutout.adjust.contrast': { en: 'Contrast', 'zh-CN': '对比度' },
  'cutout.adjust.saturation': { en: 'Saturation', 'zh-CN': '饱和度' },
  'cutout.adjust.value': {
    en: 'Adjust · {target}',
    'zh-CN': '调整 · {target}'
  },
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
  'cutout.run.remove': { en: 'Remove background', 'zh-CN': '移除背景' },
  'cutout.run.replace': { en: 'Replace background', 'zh-CN': '替换背景' },
  'cutout.run.adjust': { en: 'Apply adjustments', 'zh-CN': '应用调整' },
  'cutout.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'cutout.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'cutout.busy.remove': {
    en: 'Removing the background…',
    'zh-CN': '正在移除背景…'
  },
  'cutout.busy.replace': {
    en: 'Generating the new background…',
    'zh-CN': '正在生成新背景…'
  },
  'cutout.busy.adjust': {
    en: 'Applying the adjustments…',
    'zh-CN': '正在应用调整…'
  },
  'cutout.busy.detail': {
    en: '{time} · {background} {format}',
    'zh-CN': '{time} · {background} {format}'
  },
  'cutout.failed': {
    en: 'The run didn’t finish. No credits were used.',
    'zh-CN': '运行未完成，未扣除积分。'
  },
  'cutout.view.compare': { en: 'Compare', 'zh-CN': '对比' },
  'cutout.view.result': { en: 'Result', 'zh-CN': '结果' },
  'cutout.view.original': { en: 'Original', 'zh-CN': '原图' },
  'cutout.edit': { en: 'Edit settings', 'zh-CN': '编辑设置' },
  'cutout.again': { en: 'Try again', 'zh-CN': '再试一次' },
  'cutout.compare': {
    en: 'Drag to compare the original and the result',
    'zh-CN': '拖动以对比原图与结果'
  },
  'cutout.alt.example': {
    en: 'A pilea in a white pot on an oak side table in a living room',
    'zh-CN': '客厅橡木边桌上，一盆种在白色花盆里的镜面草'
  },
  'cutout.alt.result': {
    en: 'The finished image',
    'zh-CN': '完成的图片'
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
