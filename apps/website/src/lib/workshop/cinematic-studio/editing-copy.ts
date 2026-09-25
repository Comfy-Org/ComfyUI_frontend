import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  title: { en: 'Edit this frame', 'zh-CN': '编辑此画面' },
  description: {
    en: 'Explore a new view or look. Your original stays in your results.',
    'zh-CN': '探索新的视角或视觉风格。原图会保留在结果中。'
  },
  edit: { en: 'Free edit', 'zh-CN': '自由编辑' },
  camera: { en: 'Camera view', 'zh-CN': '相机视角' },
  look: { en: 'Change look', 'zh-CN': '更改风格' },
  relight: { en: 'Relight', 'zh-CN': '重新打光' },
  source: { en: 'Selected source frame', 'zh-CN': '选中的原始画面' },
  model: { en: 'Image editing model', 'zh-CN': '图像编辑模型' },
  aspect: { en: 'Output aspect ratio', 'zh-CN': '输出宽高比' },
  instruction: { en: 'Edit instruction', 'zh-CN': '编辑指令' },
  placeholder: {
    en: 'Describe what to change and what to preserve…',
    'zh-CN': '描述要更改和保留的内容…'
  },
  extra: {
    en: 'Additional instruction (optional)',
    'zh-CN': '补充指令（可选）'
  },
  azimuth: { en: 'Viewpoint', 'zh-CN': '拍摄方向' },
  elevation: { en: 'Camera height', 'zh-CN': '相机高度' },
  distance: { en: 'Shot distance', 'zh-CN': '拍摄距离' },
  type: { en: 'Lighting type', 'zh-CN': '光照类型' },
  direction: { en: 'Light direction', 'zh-CN': '光照方向' },
  front: { en: 'Front', 'zh-CN': '正面' },
  'front-right': { en: 'Front right', 'zh-CN': '右前方' },
  right: { en: 'Right side', 'zh-CN': '右侧' },
  'back-right': { en: 'Back right', 'zh-CN': '右后方' },
  back: { en: 'Behind', 'zh-CN': '背面' },
  'back-left': { en: 'Back left', 'zh-CN': '左后方' },
  left: { en: 'Left side', 'zh-CN': '左侧' },
  'front-left': { en: 'Front left', 'zh-CN': '左前方' },
  low: { en: 'Low angle', 'zh-CN': '低角度' },
  eye: { en: 'Eye level', 'zh-CN': '平视' },
  raised: { en: 'Raised', 'zh-CN': '略高' },
  high: { en: 'High angle', 'zh-CN': '高角度' },
  close: { en: 'Close-up', 'zh-CN': '特写' },
  medium: { en: 'Medium', 'zh-CN': '中景' },
  wide: { en: 'Wide', 'zh-CN': '远景' },
  midday: { en: 'Midday', 'zh-CN': '正午' },
  'blue-hour': { en: 'Blue hour', 'zh-CN': '蓝调时刻' },
  'golden-hour': { en: 'Golden hour', 'zh-CN': '黄金时刻' },
  sunrise: { en: 'Sunrise', 'zh-CN': '日出' },
  spotlight: { en: 'Subject spotlight', 'zh-CN': '主体聚光' },
  overcast: { en: 'Soft daylight', 'zh-CN': '柔和日光' },
  moonlight: { en: 'Moonlight', 'zh-CN': '月光' },
  studio: { en: 'Hard studio light', 'zh-CN': '影棚硬光' },
  auto: { en: 'Let model choose', 'zh-CN': '由模型选择' },
  side: { en: 'Side', 'zh-CN': '侧面' },
  bottom: { en: 'Below', 'zh-CN': '下方' },
  'top-down': { en: 'Above', 'zh-CN': '上方' },
  cameraNote: {
    en: 'Camera position is prompt guidance. Likeness and scene details can change.',
    'zh-CN': '相机位置通过提示词引导。人物相貌和场景细节可能发生变化。'
  },
  lookNote: {
    en: 'Starts from your current camera texture, lens, lighting and color choices. Edit the instruction to refine the treatment.',
    'zh-CN':
      '以当前的相机质感、镜头、光照和颜色设置为起点。编辑指令以调整处理效果。'
  },
  emptyLook: {
    en: 'Describe a color, lighting or lens treatment below, or select a look in the studio first.',
    'zh-CN': '请在下方描述颜色、光照或镜头效果，或先在工作室中选择风格。'
  },
  relightNote: {
    en: 'This is a prompt-based image edit, not physical relighting. Details may change; compare with the original.',
    'zh-CN':
      '这是基于提示词的图像编辑，并非物理打光模拟。细节可能变化，请与原图比较。'
  },
  review: { en: 'Review edit', 'zh-CN': '检查编辑' },
  cancel: { en: 'Cancel', 'zh-CN': '取消' },
  unavailable: {
    en: 'No image editing models are available.',
    'zh-CN': '暂无可用的图像编辑模型。'
  },
  reviewNote: {
    en: 'Review the complete request before generating. Generation uses workspace credits.',
    'zh-CN': '生成前请检查完整请求。生成将使用工作区额度。'
  }
} as const satisfies Record<string, LocalizedText>

export type EditingCopyKey = keyof typeof copy

export function tcEditing(key: EditingCopyKey, locale: Locale = 'en'): string {
  const entry: LocalizedText = copy[key]
  return entry[locale] ?? entry.en
}
