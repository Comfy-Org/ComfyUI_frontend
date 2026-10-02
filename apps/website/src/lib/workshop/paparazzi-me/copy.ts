import type { NamedValues } from '../../../i18n/interpolate'
import { interpolate } from '../../../i18n/interpolate'
import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  'paparazzi.title': { en: 'Paparazzi me', 'zh-CN': '狗仔偶遇' },
  'paparazzi.tools': { en: 'Paparazzi tools', 'zh-CN': '狗仔偶遇工具' },
  'paparazzi.panel': { en: 'Paparazzi settings', 'zh-CN': '狗仔偶遇设置' },
  'paparazzi.panel.expand': {
    en: 'Show all settings',
    'zh-CN': '显示全部设置'
  },
  'paparazzi.panel.collapse': { en: 'Hide settings', 'zh-CN': '收起设置' },
  'paparazzi.star': { en: 'Star', 'zh-CN': '明星' },
  'paparazzi.star.label': { en: 'Star’s name', 'zh-CN': '明星姓名' },
  'paparazzi.star.placeholder': {
    en: 'Type a name, like Nova Reyes',
    'zh-CN': '输入姓名，例如 Nova Reyes'
  },
  'paparazzi.star.suggestions': { en: 'Suggestions', 'zh-CN': '推荐' },
  'paparazzi.star.none': {
    en: 'Not in the list. The model looks them up by name.',
    'zh-CN': '不在列表中。模型会按姓名查找。'
  },
  'paparazzi.star.short': {
    en: 'Type at least 2 letters.',
    'zh-CN': '请至少输入 2 个字符。'
  },
  'paparazzi.star.film': { en: 'Film star', 'zh-CN': '电影明星' },
  'paparazzi.star.music': { en: 'Singer', 'zh-CN': '歌手' },
  'paparazzi.star.tv': { en: 'TV host', 'zh-CN': '电视主持人' },
  'paparazzi.star.sport': { en: 'Athlete', 'zh-CN': '运动员' },
  'paparazzi.scene': { en: 'Scene', 'zh-CN': '场景' },
  'paparazzi.scene.redCarpet': { en: 'Red carpet', 'zh-CN': '红毯' },
  'paparazzi.scene.streetNight': { en: 'Street at night', 'zh-CN': '夜晚街头' },
  'paparazzi.scene.cafe': { en: 'Café', 'zh-CN': '咖啡馆' },
  'paparazzi.scene.airport': { en: 'Airport', 'zh-CN': '机场' },
  'paparazzi.scene.custom': { en: 'Your own', 'zh-CN': '自定义' },
  'paparazzi.scene.override': {
    en: 'Or describe your own scene',
    'zh-CN': '或描述你自己的场景'
  },
  'paparazzi.scene.overridePlaceholder': {
    en: 'A rooftop party at dawn, confetti in the air',
    'zh-CN': '黎明时分的屋顶派对，彩纸漫天飞舞'
  },
  'paparazzi.resolution': { en: 'Resolution', 'zh-CN': '分辨率' },
  'paparazzi.resolution.size': {
    en: '{width} × {height} px',
    'zh-CN': '{width} × {height} 像素'
  },
  'paparazzi.advanced': { en: 'Advanced', 'zh-CN': '高级' },
  'paparazzi.seed': { en: 'Seed', 'zh-CN': '种子' },
  'paparazzi.seed.shuffle': { en: 'New seed', 'zh-CN': '换一个种子' },
  'paparazzi.seed.value': { en: 'Seed {n}', 'zh-CN': '种子 {n}' },
  'paparazzi.face': { en: 'Your face', 'zh-CN': '你的脸' },
  'paparazzi.face.replace': { en: 'Replace your face', 'zh-CN': '更换照片' },
  'paparazzi.face.remove': { en: 'Remove your face', 'zh-CN': '移除照片' },
  'paparazzi.face.empty': { en: 'Add your face', 'zh-CN': '添加你的脸' },
  'paparazzi.face.meta': {
    en: 'A clear, front-on photo',
    'zh-CN': '一张清晰的正脸照片'
  },
  'paparazzi.face.upload': { en: 'Upload', 'zh-CN': '上传' },
  'paparazzi.face.example': { en: 'Use example', 'zh-CN': '使用示例' },
  'paparazzi.face.alt.example': {
    en: 'The example face: a woman with short dark hair',
    'zh-CN': '示例照片：一位深色短发女子'
  },
  'paparazzi.hint': {
    en: 'Pick a star and a scene · Swap your face on the card',
    'zh-CN': '选择明星和场景 · 在卡片上换脸'
  },
  'paparazzi.history': { en: 'History', 'zh-CN': '历史记录' },
  'paparazzi.tool.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'paparazzi.tool.redo': { en: 'Redo', 'zh-CN': '重做' },
  'paparazzi.tool.shuffle': { en: 'Shuffle the crowd', 'zh-CN': '换一批人群' },
  'paparazzi.run': { en: 'Get snapped', 'zh-CN': '开拍' },
  'paparazzi.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'paparazzi.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'paparazzi.busy.title': {
    en: 'Developing the shot…',
    'zh-CN': '正在冲洗照片…'
  },
  'paparazzi.busy.detail': {
    en: '{time} · {name}, {scene}',
    'zh-CN': '{time} · {name}，{scene}'
  },
  'paparazzi.failed': {
    en: 'The shot didn’t develop. No credits were used.',
    'zh-CN': '照片没有生成。未扣除积分。'
  },
  'paparazzi.needsFace': {
    en: 'Add your face to get snapped',
    'zh-CN': '添加你的脸后才能开拍'
  },
  'paparazzi.view.compare': { en: 'Compare', 'zh-CN': '对比' },
  'paparazzi.view.original': { en: 'Original', 'zh-CN': '原图' },
  'paparazzi.view.result': { en: 'Result', 'zh-CN': '结果' },
  'paparazzi.compare': {
    en: 'Drag to compare your photo and the paparazzi shot',
    'zh-CN': '拖动以对比你的照片与狗仔照'
  },
  'paparazzi.edit': { en: 'Edit shot', 'zh-CN': '编辑画面' },
  'paparazzi.again': { en: 'Try again', 'zh-CN': '再拍一张' },
  'paparazzi.alt.result': {
    en: 'A paparazzi photo of you next to {name}',
    'zh-CN': '你与 {name} 同框的狗仔照'
  },
  'paparazzi.alt.preview': {
    en: 'A sketch of the shot: you next to {name}, {scene}',
    'zh-CN': '画面草图：你在 {name} 身旁，{scene}'
  },
  'paparazzi.summary': {
    en: '{name} · {scene} · {resolution}',
    'zh-CN': '{name} · {scene} · {resolution}'
  },
  'paparazzi.close': { en: 'Close', 'zh-CN': '关闭' }
} as const satisfies Record<string, LocalizedText>

export type PaparazziCopyKey = keyof typeof copy

/** Paparazzi me copy. A `one | many` entry picks by `n`. */
export function pc(
  key: PaparazziCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  const [one, many = one] = (entry[locale] ?? entry.en).split(' | ')
  return interpolate(named.n === 1 ? one : many, named)
}
