import type { NamedValues } from '../../../i18n/interpolate'
import { interpolate } from '../../../i18n/interpolate'
import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  'sprite.title': { en: 'Sprite Sheet Generator', 'zh-CN': '精灵图生成器' },
  'sprite.tools': { en: 'Sprite sheet tools', 'zh-CN': '精灵图工具' },
  'sprite.panel': { en: 'Sprite sheet settings', 'zh-CN': '精灵图设置' },
  'sprite.panel.expand': { en: 'Show all settings', 'zh-CN': '显示全部设置' },
  'sprite.panel.collapse': { en: 'Hide settings', 'zh-CN': '隐藏设置' },
  'sprite.empty.title': {
    en: 'Drop a character to animate',
    'zh-CN': '拖入一个角色来制作动画'
  },
  'sprite.empty.meta': {
    en: 'PNG, JPG or WebP. A transparent PNG works best.',
    'zh-CN': 'PNG、JPG 或 WebP。透明背景的 PNG 效果最好。'
  },
  'sprite.empty.upload': { en: 'Choose a character', 'zh-CN': '选择角色' },
  'sprite.empty.example': { en: 'Try the example', 'zh-CN': '试用示例' },
  'sprite.character': { en: 'Character', 'zh-CN': '角色' },
  'sprite.character.size': {
    en: '{width} × {height}',
    'zh-CN': '{width} × {height}'
  },
  'sprite.character.change': { en: 'Replace', 'zh-CN': '替换' },
  'sprite.character.changeLabel': {
    en: 'Replace the character',
    'zh-CN': '替换角色'
  },
  'sprite.style': { en: 'Style', 'zh-CN': '风格' },
  'sprite.style.pixel': { en: 'Pixel', 'zh-CN': '像素' },
  'sprite.style.toon': { en: 'Toon', 'zh-CN': '卡通' },
  'sprite.style.3d': { en: '3D', 'zh-CN': '3D' },
  'sprite.motion': { en: 'Motion', 'zh-CN': '动作' },
  'sprite.motion.idle': { en: 'Idle', 'zh-CN': '待机' },
  'sprite.motion.walk': { en: 'Walk', 'zh-CN': '行走' },
  'sprite.motion.jump': { en: 'Jump', 'zh-CN': '跳跃' },
  'sprite.advanced': { en: 'Advanced', 'zh-CN': '高级' },
  'sprite.advanced.summary': {
    en: '{n} frames · Seed {seed}',
    'zh-CN': '{n} 帧 · 种子 {seed}'
  },
  'sprite.frames': { en: 'Frames', 'zh-CN': '帧数' },
  'sprite.frames.value': { en: '{n} frames', 'zh-CN': '{n} 帧' },
  'sprite.seed': { en: 'Seed', 'zh-CN': '种子' },
  'sprite.seed.shuffle': { en: 'New seed', 'zh-CN': '换一个种子' },
  'sprite.summary': {
    en: '{style} · {motion} · {n} frames',
    'zh-CN': '{style} · {motion} · {n} 帧'
  },
  'sprite.tool.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'sprite.tool.redo': { en: 'Redo', 'zh-CN': '重做' },
  'sprite.history': { en: 'History', 'zh-CN': '历史记录' },
  'sprite.play': { en: 'Play', 'zh-CN': '播放' },
  'sprite.pause': { en: 'Pause', 'zh-CN': '暂停' },
  'sprite.fps': { en: '{n} fps', 'zh-CN': '{n} 帧/秒' },
  'sprite.fps.label': {
    en: 'Frame rate {n} fps. Click for the next rate.',
    'zh-CN': '帧率 {n} 帧/秒。点击切换。'
  },
  'sprite.onion': { en: 'Onion skin', 'zh-CN': '洋葱皮' },
  'sprite.compare': { en: 'Compare', 'zh-CN': '对比' },
  'sprite.compare.slider': {
    en: 'Drag to compare the character and the sprite sheet',
    'zh-CN': '拖动以对比角色与精灵图'
  },
  'sprite.view.original': { en: 'Original', 'zh-CN': '原图' },
  'sprite.view.result': { en: 'Result', 'zh-CN': '结果' },
  'sprite.hint': {
    en: 'Pick a style and a motion, then make the sheet',
    'zh-CN': '选择风格和动作，然后生成精灵图'
  },
  'sprite.draft': { en: 'Draft poses', 'zh-CN': '姿势草稿' },
  'sprite.frame': { en: 'Frame {n}', 'zh-CN': '第 {n} 帧' },
  'sprite.frame.show': {
    en: 'Show frame {n} in the preview',
    'zh-CN': '在预览中显示第 {n} 帧'
  },
  'sprite.preview': { en: 'Preview', 'zh-CN': '预览' },
  'sprite.preview.frame': {
    en: '{n} / {total}',
    'zh-CN': '{n} / {total}'
  },
  'sprite.run': { en: 'Make sheet', 'zh-CN': '生成精灵图' },
  'sprite.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'sprite.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'sprite.busy.title': {
    en: 'Drawing the frames',
    'zh-CN': '正在绘制帧'
  },
  'sprite.busy.detail': {
    en: '{time} · {n} frames',
    'zh-CN': '{time} · {n} 帧'
  },
  'sprite.failed': {
    en: 'The sheet didn’t finish. No credits were used.',
    'zh-CN': '精灵图未完成，未扣除积分。'
  },
  'sprite.edit': { en: 'Edit', 'zh-CN': '编辑' },
  'sprite.again': { en: 'Try again', 'zh-CN': '再试一次' },
  'sprite.close': { en: 'Close', 'zh-CN': '关闭' },
  'sprite.alt.example': {
    en: 'A cartoon fox explorer in a blue tunic and teal scarf',
    'zh-CN': '一只穿蓝色上衣、围青色围巾的卡通狐狸探险家'
  },
  'sprite.alt.sheet': {
    en: 'The sprite sheet, {n} frames of {motion} in {style}',
    'zh-CN': '精灵图，{style}风格的{motion}动作，共 {n} 帧'
  },
  'sprite.alt.source': {
    en: 'The character in every frame, before the sheet',
    'zh-CN': '生成前每一帧中的角色'
  }
} as const satisfies Record<string, LocalizedText>

export type SpriteCopyKey = keyof typeof copy

/** Sprite Sheet Generator copy. A `one | many` entry picks by `n`. */
export function spc(
  key: SpriteCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  const [one, many = one] = (entry[locale] ?? entry.en).split(' | ')
  return interpolate(named.n === 1 ? one : many, named)
}
