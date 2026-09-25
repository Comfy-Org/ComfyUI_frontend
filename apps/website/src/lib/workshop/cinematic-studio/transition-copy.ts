import type { Locale } from '../../../i18n/translations'

const COPY = {
  title: ['Plan a transition', '规划转场'],
  description: [
    'Choose the first and last frame, then describe the motion between them. Applying these frames does not generate a video.',
    '选择首帧和尾帧，然后描述两者之间的运动。应用这些帧不会生成视频。'
  ],
  first: ['First frame', '首帧'],
  last: ['Last frame', '尾帧'],
  saved: ['Choose a saved image', '选择已保存的图像'],
  upload: ['Upload an image', '上传图像'],
  empty: ['No frame selected', '尚未选择帧'],
  model: ['Video model', '视频模型'],
  unsupported: [
    'No available model supports both first and last frames.',
    '目前没有可用模型同时支持首帧和尾帧。'
  ],
  scene: ['Scene and action between the frames', '场景及帧之间的动作'],
  settings: [
    'Review duration, format and audio in the composer after applying.',
    '应用后，请在编辑区检查时长、格式和音频。'
  ],
  swap: ['Swap frames', '交换帧'],
  apply: ['Use these frames', '使用这些帧'],
  cancel: ['Cancel', '取消'],
  hidden: [
    'This preview is flagged. Reveal it before using it as a frame.',
    '此预览已被标记。请先显示预览，再将其用作帧。'
  ],
  reveal: ['Reveal and use frame', '显示并使用帧'],
  error: [
    'Choose a PNG, JPEG or WebP image up to 12 MiB.',
    '请选择 PNG、JPEG 或 WebP 图像，大小不超过 12 MiB。'
  ],
  account: [
    'Choose an account and workspace before selecting frames.',
    '选择帧前，请先选择账号和工作区。'
  ]
} as const

export function tcTransition(
  key: keyof typeof COPY,
  locale: Locale = 'en'
): string {
  return COPY[key][locale === 'zh-CN' ? 1 : 0]
}
