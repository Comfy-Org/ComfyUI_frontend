import type { Locale, LocalizedText } from '@/i18n/translations'

const copy = {
  'paparazzi.title': { en: 'Paparazzi me', 'zh-CN': '狗仔偶遇' },
  'paparazzi.tools': { en: 'Paparazzi tools', 'zh-CN': '狗仔偶遇工具' },
  'paparazzi.panel': { en: 'Paparazzi settings', 'zh-CN': '狗仔偶遇设置' },
  'paparazzi.panel.expand': {
    en: 'Show all settings',
    'zh-CN': '显示全部设置'
  },
  'paparazzi.panel.collapse': { en: 'Hide settings', 'zh-CN': '收起设置' },
  'paparazzi.face': { en: 'Your face', 'zh-CN': '你的脸' },
  'paparazzi.face.change': { en: 'Change', 'zh-CN': '更换' },
  'paparazzi.face.changeLabel': {
    en: 'Change your face photo',
    'zh-CN': '更换你的照片'
  },
  'paparazzi.face.tip': {
    en: 'A clear, front-on photo. Drop or paste one here.',
    'zh-CN': '一张清晰的正脸照片。可拖放或粘贴到这里。'
  },
  'paparazzi.star': { en: 'Star', 'zh-CN': '明星' },
  'paparazzi.star.label': { en: 'Star’s name', 'zh-CN': '明星姓名' },
  'paparazzi.star.placeholder': {
    en: 'Type a name, like Nova Reyes',
    'zh-CN': '输入姓名，例如 Nova Reyes'
  },
  'paparazzi.star.find': { en: 'Find photos', 'zh-CN': '查找照片' },
  'paparazzi.star.suggestions': { en: 'Suggestions', 'zh-CN': '推荐' },
  'paparazzi.star.hint': {
    en: 'We look up paparazzi photos of them. Upload a scene to use your own.',
    'zh-CN': '我们会查找 TA 的狗仔照片。也可以上传你自己的场景。'
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
  'paparazzi.scene.pick': { en: 'Pick a scene', 'zh-CN': '选择场景' },
  'paparazzi.scene.found': {
    en: '{name} · from {provider}',
    'zh-CN': '{name} · 来自 {provider}'
  },
  'paparazzi.scene.searching': {
    en: 'Looking up {name}…',
    'zh-CN': '正在查找 {name}…'
  },
  'paparazzi.scene.idle': {
    en: 'Find a star’s photos',
    'zh-CN': '查找明星照片'
  },
  'paparazzi.scene.empty': {
    en: 'No paparazzi photos found. Try another spelling, or upload a scene.',
    'zh-CN': '没有找到狗仔照片。换个拼写试试，或上传一个场景。'
  },
  'paparazzi.scene.note': {
    en: 'The first photo is used unless you pick another. Your own scene overrides them.',
    'zh-CN': '默认使用第一张照片，你也可以另选。上传的场景会优先使用。'
  },
  'paparazzi.scene.own': { en: 'Your scene', 'zh-CN': '你的场景' },
  'paparazzi.scene.upload': {
    en: 'Upload your own scene',
    'zh-CN': '上传你自己的场景'
  },
  'paparazzi.place.redCarpet': { en: 'Red carpet', 'zh-CN': '红毯' },
  'paparazzi.place.beach': { en: 'Malibu boardwalk', 'zh-CN': '马里布木栈道' },
  'paparazzi.place.yacht': { en: 'Cannes yacht', 'zh-CN': '戛纳游艇' },
  'paparazzi.place.fashionWeek': { en: 'Fashion week', 'zh-CN': '时装周' },
  'paparazzi.place.hotel': { en: 'Hotel exit', 'zh-CN': '酒店门口' },
  'paparazzi.place.market': { en: 'Farmers market', 'zh-CN': '农夫市集' },
  'paparazzi.place.ski': { en: 'Ski village', 'zh-CN': '滑雪小镇' },
  'paparazzi.place.backstage': {
    en: 'Festival backstage',
    'zh-CN': '音乐节后台'
  },
  'paparazzi.place.gym': { en: 'Gym exit', 'zh-CN': '健身房门口' },
  'paparazzi.resolution': { en: 'Resolution', 'zh-CN': '分辨率' },
  'paparazzi.resolution.size': {
    en: '{width} × {height} px',
    'zh-CN': '{width} × {height} 像素'
  },
  'paparazzi.seed': { en: 'Seed', 'zh-CN': '种子' },
  'paparazzi.seed.shuffle': { en: 'New seed', 'zh-CN': '换一个种子' },
  'paparazzi.hint': {
    en: 'Pick one of the star’s photos · Drop or paste your face',
    'zh-CN': '选一张明星的照片 · 拖放或粘贴你的照片'
  },
  'paparazzi.history': { en: 'History', 'zh-CN': '历史记录' },
  'paparazzi.tool.undo': { en: 'Undo', 'zh-CN': '撤销' },
  'paparazzi.tool.redo': { en: 'Redo', 'zh-CN': '重做' },
  'paparazzi.run': { en: 'Insert me', 'zh-CN': '把我放进去' },
  'paparazzi.credits': { en: '{n} credits', 'zh-CN': '{n} 积分' },
  'paparazzi.cancel': { en: 'Cancel', 'zh-CN': '取消' },
  'paparazzi.needsStar': {
    en: 'Type a star’s name or upload a scene.',
    'zh-CN': '请输入明星姓名，或上传一个场景。'
  },
  'paparazzi.busy.searching': {
    en: 'Looking up a paparazzi photo…',
    'zh-CN': '正在查找狗仔照片…'
  },
  'paparazzi.busy.queued': { en: 'Queued', 'zh-CN': '排队中' },
  'paparazzi.busy.running': {
    en: 'Inserting you · {n}%',
    'zh-CN': '正在把你放进去 · {n}%'
  },
  'paparazzi.busy.detail': {
    en: '{time} · {name}, {scene}',
    'zh-CN': '{time} · {name}，{scene}'
  },
  'paparazzi.failed': {
    en: 'The shot didn’t develop. No credits were used.',
    'zh-CN': '照片没有生成。未扣除积分。'
  },
  'paparazzi.searchFailed': {
    en: 'The photo look-up is unavailable right now. Try again or upload a scene.',
    'zh-CN': '照片查找暂时不可用。请重试或上传一个场景。'
  },
  'paparazzi.view.compare': { en: 'Compare', 'zh-CN': '对比' },
  'paparazzi.view.original': { en: 'Original', 'zh-CN': '原图' },
  'paparazzi.view.result': { en: 'Result', 'zh-CN': '结果' },
  'paparazzi.compare': {
    en: 'Drag to compare the paparazzi photo and your shot',
    'zh-CN': '拖动以对比狗仔原图与你的合照'
  },
  'paparazzi.edit': { en: 'Edit shot', 'zh-CN': '编辑画面' },
  'paparazzi.again': { en: 'Try again', 'zh-CN': '再拍一张' },
  'paparazzi.alt.result': {
    en: 'A paparazzi photo of you next to {name}',
    'zh-CN': '你与 {name} 同框的狗仔照'
  },
  'paparazzi.alt.scene': {
    en: 'A paparazzi photo of {name}: {scene}',
    'zh-CN': '{name} 的狗仔照：{scene}'
  },
  'paparazzi.summary': {
    en: '{name} · {scene} · {resolution}',
    'zh-CN': '{name} · {scene} · {resolution}'
  },
  'paparazzi.close': { en: 'Close', 'zh-CN': '关闭' }
} as const satisfies Record<string, LocalizedText>

export type PaparazziCopyKey = keyof typeof copy

type NamedValues = Record<string, string | number>

/** Paparazzi me copy. A `one | many` entry picks by `n`. */
export function pc(
  key: PaparazziCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  const [one, many = one] = (entry[locale] ?? entry.en).split(' | ')
  return (named.n === 1 ? one : many).replace(
    /\{(\w+)\}/g,
    (placeholder, name: string) =>
      Object.hasOwn(named, name) ? String(named[name]) : placeholder
  )
}
