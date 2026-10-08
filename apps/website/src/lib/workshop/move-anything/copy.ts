import type { Locale, LocalizedText } from '@/i18n/translations'

const copy = {
  'move.title': { en: 'Move anything', 'zh-CN': '随意移动' },
  'move.tools': { en: 'Move anything tools', 'zh-CN': '随意移动工具' },
  'move.empty.title': {
    en: 'Drop a photo to rearrange',
    'zh-CN': '拖入一张照片来重新摆放'
  },
  'move.empty.meta': {
    en: 'PNG, JPG or WebP. Up to 4 things per photo.',
    'zh-CN': 'PNG、JPG 或 WebP。每张照片最多 4 个物体。'
  },
  'move.empty.upload': { en: 'Choose a photo', 'zh-CN': '选择照片' },
  'move.empty.example': { en: 'Try the example', 'zh-CN': '试用示例' },
  'move.tool.move': { en: 'Move', 'zh-CN': '移动' },
  'move.tool.add': { en: 'Add object', 'zh-CN': '添加物体' },
  'move.history': { en: 'History', 'zh-CN': '历史记录' },
  'move.tool.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'move.tool.redo': { en: 'Redo', 'zh-CN': '重做' },
  'move.hint.move': {
    en: 'Drag to move · Corners to resize · Arrow keys to nudge',
    'zh-CN': '拖动以移动 · 拖动角落调整大小 · 方向键微调'
  },
  'move.hint.add': {
    en: 'Draw a box around the thing you want to move',
    'zh-CN': '框选你想移动的物体'
  },
  'move.image': { en: 'Image', 'zh-CN': '图像' },
  'move.change': { en: 'Change photo', 'zh-CN': '更换照片' },
  'move.objects': { en: 'Objects', 'zh-CN': '物体' },
  'move.objects.count': { en: '{n} of {max}', 'zh-CN': '{n} / {max}' },
  'move.objects.add': {
    en: 'Draw a box on the image to add one',
    'zh-CN': '在图像上框选以添加'
  },
  'move.objects.full': {
    en: 'Up to {max} things per photo',
    'zh-CN': '每张照片最多 {max} 个物体'
  },
  'move.objects.empty': {
    en: 'Nothing selected yet. Choose Add object and draw a box.',
    'zh-CN': '尚未选择。点击“添加物体”并框选。'
  },
  'move.object.moved': { en: 'Moved', 'zh-CN': '已移动' },
  'move.object.inPlace': { en: 'In place', 'zh-CN': '原位' },
  'move.object.remove': { en: 'Remove {label}', 'zh-CN': '移除{label}' },
  'move.object.label': { en: 'Object {n}', 'zh-CN': '物体 {n}' },
  'move.object.box': {
    en: '{label}. Arrow keys move it, Shift moves further.',
    'zh-CN': '{label}。方向键移动，按住 Shift 移动更多。'
  },
  'move.quality': { en: 'Quality', 'zh-CN': '质量' },
  'move.quality.fast': { en: 'Fast', 'zh-CN': '快速' },
  'move.quality.best': { en: 'Best', 'zh-CN': '最佳' },
  'move.quality.fastHint': {
    en: 'About 20 seconds',
    'zh-CN': '约 20 秒'
  },
  'move.quality.bestHint': {
    en: 'About a minute, keeps finer detail',
    'zh-CN': '约 1 分钟，保留更多细节'
  },
  'move.close': { en: 'Close', 'zh-CN': '关闭' },
  'move.generate': {
    en: 'Move {n} object | Move {n} objects',
    'zh-CN': '移动 {n} 个物体'
  },
  'move.generate.idle': {
    en: 'Move something first',
    'zh-CN': '请先移动物体'
  },
  'move.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'move.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'move.busy.title': { en: 'Making the move…', 'zh-CN': '正在移动…' },
  'move.busy.detail': {
    en: 'Moving {n} object · {wait} | Moving {n} objects · {wait}',
    'zh-CN': '正在移动 {n} 个物体 · {wait}'
  },
  'move.failed': {
    en: 'The edit didn’t finish. No credits were used.',
    'zh-CN': '编辑未完成，未扣除积分。'
  },
  'move.view.compare': { en: 'Compare', 'zh-CN': '对比' },
  'move.view.result': { en: 'New', 'zh-CN': '新图' },
  'move.view.original': { en: 'Original', 'zh-CN': '原图' },
  'move.edit': { en: 'Edit arrangement', 'zh-CN': '编辑摆放' },
  'move.again': { en: 'Try again', 'zh-CN': '再试一次' },
  'move.download': { en: 'Download', 'zh-CN': '下载' },
  'move.compare': {
    en: 'Drag to compare the original and the new image',
    'zh-CN': '拖动以对比原图与新图'
  },
  'move.alt.example': {
    en: 'A kitten on a windowsill next to two succulents',
    'zh-CN': '窗台上的小猫和两盆多肉'
  },
  'move.alt.result': {
    en: 'The photo with your objects in their new places',
    'zh-CN': '物体移动到新位置后的照片'
  },
  'move.example.kitten': { en: 'Orange kitten', 'zh-CN': '橘色小猫' },
  'move.example.succulent': { en: 'Succulent', 'zh-CN': '多肉' }
} as const satisfies Record<string, LocalizedText>

export type MoveCopyKey = keyof typeof copy

type NamedValues = Record<string, string | number>

/** Move anything copy. A `one | many` entry picks by `n`. */
export function mc(
  key: MoveCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  const text = entry[locale] ?? entry.en
  const forms = text.split(' | ')
  const form = forms.length === 2 && named.n !== 1 ? forms[1] : forms[0]
  return form.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(named, name) ? String(named[name]) : placeholder
  )
}
