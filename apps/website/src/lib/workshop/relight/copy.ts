import type { NamedValues } from '../../../i18n/interpolate'
import { interpolate } from '../../../i18n/interpolate'
import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  'relight.title': { en: 'Relight', 'zh-CN': '重新布光' },
  'relight.tools': { en: 'Relight tools', 'zh-CN': '重新布光工具' },
  'relight.panel': { en: 'Relight settings', 'zh-CN': '重新布光设置' },
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
  'relight.tool.add': { en: 'Add light', 'zh-CN': '添加灯光' },
  'relight.tool.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'relight.tool.redo': { en: 'Redo', 'zh-CN': '重做' },
  'relight.history': { en: 'History', 'zh-CN': '历史记录' },
  'relight.view': { en: 'View', 'zh-CN': '视图' },
  'relight.view.live': { en: 'Live lighting', 'zh-CN': '实时光照' },
  'relight.view.lightmap': { en: 'Light map', 'zh-CN': '光照图' },
  'relight.handles': { en: 'Light handles', 'zh-CN': '灯光控制点' },
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
  'relight.lights': { en: 'Lights', 'zh-CN': '灯光' },
  'relight.lights.count': { en: '{n} of {max}', 'zh-CN': '{n} / {max}' },
  'relight.lights.empty': { en: 'No lights yet.', 'zh-CN': '还没有灯光。' },
  'relight.light.key': { en: 'Key', 'zh-CN': '主光' },
  'relight.light.fill': { en: 'Fill', 'zh-CN': '补光' },
  'relight.light.warmKey': { en: 'Warm key', 'zh-CN': '暖色主光' },
  'relight.light.coolFill': { en: 'Cool fill', 'zh-CN': '冷色补光' },
  'relight.light.window': { en: 'Window', 'zh-CN': '窗光' },
  'relight.light.pink': { en: 'Pink neon', 'zh-CN': '粉色霓虹' },
  'relight.light.blue': { en: 'Blue neon', 'zh-CN': '蓝色霓虹' },
  'relight.light.moon': { en: 'Moon', 'zh-CN': '月光' },
  'relight.light.new': { en: 'Light {n}', 'zh-CN': '灯光 {n}' },
  'relight.light.copy': { en: '{name} copy', 'zh-CN': '{name} 副本' },
  'relight.light.dot': {
    en: '{name}. Arrow keys move it, Shift moves further.',
    'zh-CN': '{name}。方向键移动，按住 Shift 移动更多。'
  },
  'relight.light.hide': { en: 'Hide {name}', 'zh-CN': '隐藏{name}' },
  'relight.light.show': { en: 'Show {name}', 'zh-CN': '显示{name}' },
  'relight.light.duplicate': {
    en: 'Duplicate {name}',
    'zh-CN': '复制{name}'
  },
  'relight.light.remove': { en: 'Delete {name}', 'zh-CN': '删除{name}' },
  'relight.kind': { en: 'Kind', 'zh-CN': '类型' },
  'relight.kind.point': { en: 'Point', 'zh-CN': '点光' },
  'relight.kind.directional': { en: 'Directional', 'zh-CN': '平行光' },
  'relight.intensity': { en: 'Intensity', 'zh-CN': '强度' },
  'relight.softness': { en: 'Softness', 'zh-CN': '柔和度' },
  'relight.direction': { en: 'Direction', 'zh-CN': '方向' },
  'relight.elevation': { en: 'Elevation', 'zh-CN': '仰角' },
  'relight.orbit': { en: 'Light position', 'zh-CN': '灯光位置' },
  'relight.orbit.around': {
    en: 'Around the subject',
    'zh-CN': '环绕主体'
  },
  'relight.orbit.height': { en: 'Height', 'zh-CN': '高度' },
  'relight.orbit.front': { en: 'Front', 'zh-CN': '正面' },
  'relight.orbit.top': { en: 'Top', 'zh-CN': '顶部' },
  'relight.orbit.left': { en: 'Left', 'zh-CN': '左侧' },
  'relight.orbit.back': { en: 'Back', 'zh-CN': '背面' },
  'relight.orbit.bottom': { en: 'Bottom', 'zh-CN': '底部' },
  'relight.orbit.right': { en: 'Right', 'zh-CN': '右侧' },
  'relight.castShadows': { en: 'Cast shadows', 'zh-CN': '投射阴影' },
  'relight.color': { en: 'Color', 'zh-CN': '颜色' },
  'relight.color.warm': { en: 'Warm', 'zh-CN': '暖色' },
  'relight.color.cream': { en: 'Cream', 'zh-CN': '奶油色' },
  'relight.color.white': { en: 'White', 'zh-CN': '白色' },
  'relight.color.cool': { en: 'Cool blue', 'zh-CN': '冷蓝' },
  'relight.color.magenta': { en: 'Magenta', 'zh-CN': '洋红' },
  'relight.color.custom': { en: 'Custom color', 'zh-CN': '自定义颜色' },
  'relight.scene': { en: 'Scene', 'zh-CN': '场景' },
  'relight.shadows': { en: 'Shadows', 'zh-CN': '阴影' },
  'relight.scene.summary': { en: 'Ambient {n}', 'zh-CN': '环境光 {n}' },
  'relight.summary': {
    en: '{mood} · {n} light · {shadows} | {mood} · {n} lights · {shadows}',
    'zh-CN': '{mood} · {n} 盏灯 · {shadows}'
  },
  'relight.shadows.none': { en: 'None', 'zh-CN': '无' },
  'relight.shadows.soft': { en: 'Soft', 'zh-CN': '柔和' },
  'relight.shadows.hard': { en: 'Hard', 'zh-CN': '硬朗' },
  'relight.shadows.long': { en: 'Long', 'zh-CN': '长影' },
  'relight.panel.expand': { en: 'Show all settings', 'zh-CN': '显示全部设置' },
  'relight.panel.collapse': { en: 'Hide settings', 'zh-CN': '收起设置' },
  'relight.scene.ambient': { en: 'Ambient light', 'zh-CN': '环境光' },
  'relight.scene.ambientColor': { en: 'Ambient color', 'zh-CN': '环境光颜色' },
  'relight.scene.removeOriginal': {
    en: 'Remove original light',
    'zh-CN': '去除原有光线'
  },
  'relight.scene.reflections': {
    en: 'Surface reflections',
    'zh-CN': '表面反射'
  },
  'relight.masks': { en: 'Masks', 'zh-CN': '蒙版' },
  'relight.masks.applyTo': { en: 'Apply to', 'zh-CN': '应用于' },
  'relight.masks.area': {
    en: 'Where {name} shines',
    'zh-CN': '{name}的照射范围'
  },
  'relight.masks.whole': { en: 'Whole image', 'zh-CN': '整张图片' },
  'relight.masks.noLights': {
    en: 'Add a light to keep it inside a mask.',
    'zh-CN': '添加一盏灯光后可将其限制在蒙版内。'
  },
  'relight.masks.subject': { en: 'Subject', 'zh-CN': '主体' },
  'relight.masks.subjectPlaceholder': {
    en: 'Person, sky, red jacket…',
    'zh-CN': '人物、天空、红色外套…'
  },
  'relight.masks.create': { en: 'Create mask', 'zh-CN': '创建蒙版' },
  'relight.mask.subject': { en: 'Subject', 'zh-CN': '主体' },
  'relight.mask.show': {
    en: 'Show {name} on the photo',
    'zh-CN': '在照片上显示{name}'
  },
  'relight.mask.hide': {
    en: 'Hide {name} on the photo',
    'zh-CN': '在照片上隐藏{name}'
  },
  'relight.mask.remove': { en: 'Delete {name}', 'zh-CN': '删除{name}' },
  'relight.generation': { en: 'Generation', 'zh-CN': '生成' },
  'relight.generation.prompt': {
    en: 'Direction (optional)',
    'zh-CN': '描述（可选）'
  },
  'relight.generation.promptPlaceholder': {
    en: 'Softer shadow transitions, natural reflections…',
    'zh-CN': '更柔和的阴影过渡，自然的反射…'
  },
  'relight.generation.strength': {
    en: 'Change strength',
    'zh-CN': '变化强度'
  },
  'relight.generation.options': {
    en: 'Generation options',
    'zh-CN': '生成选项'
  },
  'relight.generation.area': { en: 'Where to generate', 'zh-CN': '生成区域' },
  'relight.generation.whole': { en: 'Whole image', 'zh-CN': '整张图片' },
  'relight.generation.masked': { en: 'Masked area', 'zh-CN': '蒙版区域' },
  'relight.generation.seed': { en: 'Seed', 'zh-CN': '种子' },
  'relight.generation.value': { en: '{n}%', 'zh-CN': '{n}%' },
  'relight.close': { en: 'Close', 'zh-CN': '关闭' },
  'relight.run': { en: 'Relight', 'zh-CN': '重新布光' },
  'relight.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'relight.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'relight.busy.title': { en: 'Relighting…', 'zh-CN': '正在重新布光…' },
  'relight.busy.detail': {
    en: '{time} · {n} light | {time} · {n} lights',
    'zh-CN': '{time} · {n} 盏灯'
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
    en: 'A woman with short dark hair smiling on a motel walkway, a man behind her',
    'zh-CN': '一位短发女子在汽车旅馆走廊上微笑，身后有一位男子'
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
