import type { NamedValues } from '../../../i18n/interpolate'
import { interpolate } from '../../../i18n/interpolate'
import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  'relight.title': { en: 'Relight', 'zh-CN': '重新布光' },
  'relight.tools': { en: 'Relight tools', 'zh-CN': '重新布光工具' },
  'relight.empty.title': {
    en: 'Drop a photo to relight',
    'zh-CN': '拖入一张照片来重新布光'
  },
  'relight.empty.meta': {
    en: 'PNG, JPG or WebP. Up to 4 lights per photo.',
    'zh-CN': 'PNG、JPG 或 WebP。每张照片最多 4 盏灯。'
  },
  'relight.empty.upload': { en: 'Choose a photo', 'zh-CN': '选择照片' },
  'relight.empty.example': { en: 'Try the example', 'zh-CN': '试用示例' },
  'relight.tool.preview': { en: 'Preview', 'zh-CN': '预览' },
  'relight.tool.original': { en: 'Original', 'zh-CN': '原图' },
  'relight.tool.add': { en: 'Add light', 'zh-CN': '添加灯光' },
  'relight.tool.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'relight.tool.redo': { en: 'Redo', 'zh-CN': '重做' },
  'relight.hint': {
    en: 'Drag a light to move it · Arrow keys to nudge',
    'zh-CN': '拖动灯光以移动 · 方向键微调'
  },
  'relight.mood': { en: 'Mood', 'zh-CN': '氛围' },
  'relight.mood.studio': { en: 'Studio', 'zh-CN': '影棚' },
  'relight.mood.sunset': { en: 'Sunset', 'zh-CN': '日落' },
  'relight.mood.window': { en: 'Window', 'zh-CN': '窗光' },
  'relight.mood.split': { en: 'Split', 'zh-CN': '侧光' },
  'relight.mood.neon': { en: 'Neon', 'zh-CN': '霓虹' },
  'relight.mood.moonlight': { en: 'Moonlight', 'zh-CN': '月光' },
  'relight.mood.note': {
    en: 'Picking a mood replaces your lights. Undo brings them back.',
    'zh-CN': '选择氛围会替换当前灯光，可撤销恢复。'
  },
  'relight.lights': { en: 'Lights', 'zh-CN': '灯光' },
  'relight.lights.count': { en: '{n} of {max}', 'zh-CN': '{n} / {max}' },
  'relight.lights.add': { en: 'Add', 'zh-CN': '添加' },
  'relight.lights.empty': {
    en: 'No lights yet. Choose Add to place one.',
    'zh-CN': '还没有灯光。点击“添加”放置一盏。'
  },
  'relight.light.key': { en: 'Key', 'zh-CN': '主光' },
  'relight.light.fill': { en: 'Fill', 'zh-CN': '补光' },
  'relight.light.warmKey': { en: 'Warm key', 'zh-CN': '暖色主光' },
  'relight.light.coolFill': { en: 'Cool fill', 'zh-CN': '冷色补光' },
  'relight.light.window': { en: 'Window', 'zh-CN': '窗光' },
  'relight.light.pink': { en: 'Pink neon', 'zh-CN': '粉色霓虹' },
  'relight.light.blue': { en: 'Blue neon', 'zh-CN': '蓝色霓虹' },
  'relight.light.moon': { en: 'Moon', 'zh-CN': '月光' },
  'relight.light.new': { en: 'Light {n}', 'zh-CN': '灯光 {n}' },
  'relight.light.dot': {
    en: '{name}. Arrow keys move it, Shift moves further.',
    'zh-CN': '{name}。方向键移动，按住 Shift 移动更多。'
  },
  'relight.light.hide': { en: 'Hide {name}', 'zh-CN': '隐藏{name}' },
  'relight.light.show': { en: 'Show {name}', 'zh-CN': '显示{name}' },
  'relight.light.remove': { en: 'Remove {name}', 'zh-CN': '移除{name}' },
  'relight.kind': { en: 'Kind', 'zh-CN': '类型' },
  'relight.kind.point': { en: 'Point', 'zh-CN': '点光' },
  'relight.kind.directional': { en: 'Directional', 'zh-CN': '平行光' },
  'relight.brightness': { en: 'Brightness', 'zh-CN': '亮度' },
  'relight.softness': { en: 'Softness', 'zh-CN': '柔和度' },
  'relight.color': { en: 'Color', 'zh-CN': '颜色' },
  'relight.color.warm': { en: 'Warm', 'zh-CN': '暖色' },
  'relight.color.cream': { en: 'Cream', 'zh-CN': '奶油色' },
  'relight.color.white': { en: 'White', 'zh-CN': '白色' },
  'relight.color.cool': { en: 'Cool blue', 'zh-CN': '冷蓝' },
  'relight.color.magenta': { en: 'Magenta', 'zh-CN': '洋红' },
  'relight.scene': { en: 'Scene', 'zh-CN': '场景' },
  'relight.scene.shadows': { en: 'Shadows', 'zh-CN': '有阴影' },
  'relight.scene.noShadows': { en: 'No shadows', 'zh-CN': '无阴影' },
  'relight.scene.castShadows': { en: 'Cast shadows', 'zh-CN': '投射阴影' },
  'relight.scene.ambient': { en: 'Ambient light', 'zh-CN': '环境光' },
  'relight.scene.removeOriginal': {
    en: 'Remove original lighting',
    'zh-CN': '去除原有光照'
  },
  'relight.scene.prompt': {
    en: 'Describe the light, optional',
    'zh-CN': '描述灯光（可选）'
  },
  'relight.scene.promptPlaceholder': {
    en: 'Late sun through a window',
    'zh-CN': '傍晚阳光透过窗户'
  },
  'relight.close': { en: 'Close', 'zh-CN': '关闭' },
  'relight.run': { en: 'Relight', 'zh-CN': '重新布光' },
  'relight.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'relight.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'relight.busy.title': { en: 'Relighting…', 'zh-CN': '正在重新布光…' },
  'relight.busy.detail': {
    en: '{n} light · about 1 min | {n} lights · about 1 min',
    'zh-CN': '{n} 盏灯 · 约 1 分钟'
  },
  'relight.failed': {
    en: 'The relight didn’t finish. No credits were used.',
    'zh-CN': '重新布光未完成，未扣除积分。'
  },
  'relight.view.compare': { en: 'Compare', 'zh-CN': '对比' },
  'relight.view.result': { en: 'Relit', 'zh-CN': '新光照' },
  'relight.view.original': { en: 'Original', 'zh-CN': '原图' },
  'relight.edit': { en: 'Edit lights', 'zh-CN': '编辑灯光' },
  'relight.again': { en: 'Try again', 'zh-CN': '再试一次' },
  'relight.download': { en: 'Download', 'zh-CN': '下载' },
  'relight.compare': {
    en: 'Drag to compare the original and the relit photo',
    'zh-CN': '拖动以对比原图与重新布光后的照片'
  },
  'relight.alt.example': {
    en: 'An old man with a white beard by the sea, in flat daylight',
    'zh-CN': '海边一位白胡子老人，处于平淡的日光下'
  },
  'relight.alt.result': {
    en: 'The photo with its new lighting',
    'zh-CN': '重新布光后的照片'
  }
} as const satisfies Record<string, LocalizedText>

export type RelightCopyKey = keyof typeof copy

/** Relight copy. A `one | many` entry picks by `n`. */
export function lc(
  key: RelightCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  const [one, many = one] = (entry[locale] ?? entry.en).split(' | ')
  return interpolate(named.n === 1 ? one : many, named)
}
