import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  title: { en: 'Compare creations', 'zh-CN': '对比作品' },
  description: {
    en: 'Choose two saved creations and compare their images, motion and settings. Your originals stay unchanged.',
    'zh-CN': '选择两件已保存作品，对比图像、运动和设置。原始作品保持不变。'
  },
  first: { en: 'First creation', 'zh-CN': '第一件作品' },
  second: { en: 'Second creation', 'zh-CN': '第二件作品' },
  empty: {
    en: 'Save at least two creations to compare them here.',
    'zh-CN': '请先保存至少两件作品，再在此处进行对比。'
  },
  model: { en: 'Model', 'zh-CN': '模型' },
  aspect: { en: 'Requested aspect', 'zh-CN': '请求的宽高比' },
  resolution: { en: 'Requested resolution', 'zh-CN': '请求的分辨率' },
  duration: { en: 'Requested duration', 'zh-CN': '请求的时长' },
  seed: { en: 'Seed', 'zh-CN': '种子' },
  audio: { en: 'Audio requested', 'zh-CN': '音频请求' },
  on: { en: 'On', 'zh-CN': '开启' },
  off: { en: 'Off', 'zh-CN': '关闭' },
  operation: { en: 'Operation', 'zh-CN': '操作' },
  generate: { en: 'Generate', 'zh-CN': '生成' },
  edit: { en: 'Image edit', 'zh-CN': '图像编辑' },
  camera: { en: 'Camera view', 'zh-CN': '相机视角' },
  look: { en: 'Look change', 'zh-CN': '风格更改' },
  relight: { en: 'Relight', 'zh-CN': '重新打光' },
  source: { en: 'Source creation', 'zh-CN': '来源作品' },
  sourceMissing: {
    en: 'Source is not in this library',
    'zh-CN': '此作品库中没有来源作品'
  },
  prompt: { en: 'Full prompt', 'zh-CN': '完整提示词' },
  settings: { en: 'Saved settings', 'zh-CN': '已保存设置' },
  direction: { en: 'Camera and look', 'zh-CN': '相机与风格' },
  unavailable: {
    en: 'Media is unavailable in this browser.',
    'zh-CN': '此浏览器中无法使用该媒体。'
  },
  hidden: {
    en: 'This creation was flagged. Reveal it to load the media.',
    'zh-CN': '此作品已被标记。请先显示内容再加载媒体。'
  },
  reveal: { en: 'Reveal creation', 'zh-CN': '显示作品' },
  video: { en: 'Video preview', 'zh-CN': '视频预览' },
  noSettings: {
    en: 'No additional settings were saved.',
    'zh-CN': '未保存其他设置。'
  },
  editReuseUnavailable: {
    en: 'Edited results cannot reuse generation settings. Animate this image or edit it from Your creations.',
    'zh-CN':
      '编辑结果无法复用生成设置。可将此图像制作为动画，或在“你的作品”中编辑。'
  },
  close: { en: 'Close', 'zh-CN': '关闭' }
} as const satisfies Record<string, LocalizedText>

export type ComparisonCopyKey = keyof typeof copy
export function tcComparison(
  key: ComparisonCopyKey,
  locale: Locale = 'en'
): string {
  const entry: LocalizedText = copy[key]
  return entry[locale] ?? entry.en
}
