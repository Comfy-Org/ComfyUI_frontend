import type { Locale } from '../../../i18n/translations'
const copy = {
  close: ['Close', '关闭'],
  title: ['Compare camera directions', '对比相机运动'],
  description: [
    'Generate separate clips from the same starting frame and action. Each selected direction is one paid generation.',
    '使用同一首帧和动作分别生成片段。每个所选方向均为一次付费生成。'
  ],
  source: ['Starting frame', '起始帧'],
  pick: ['Choose a saved image', '选择已保存图像'],
  upload: ['Upload an image', '上传图像'],
  sensitive: [
    'This saved image is marked sensitive. Reveal it before using it.',
    '此图像被标记为敏感内容。使用前请先显示。'
  ],
  reveal: ['Reveal image', '显示图像'],
  action: ['Scene and action for every clip', '所有片段的场景与动作'],
  moves: ['Choose up to three directions', '最多选择三个方向'],
  locked: ['Locked camera', '固定相机'],
  'push-in': ['Push in', '推进'],
  'pull-out': ['Pull out', '拉远'],
  'orbit-left': ['Orbit left', '向左环绕'],
  'track-right': ['Track right', '向右横移'],
  'crane-up': ['Crane up', '升高相机'],
  model: ['Model', '模型'],
  duration: ['Duration (seconds)', '时长（秒）'],
  resolution: ['Resolution', '分辨率'],
  aspect: ['Aspect ratio', '宽高比'],
  sourceAspect: [
    'The starting frame guides the output aspect ratio.',
    '起始帧引导输出宽高比。'
  ],
  audio: ['Generate audio', '生成音频'],
  seed: ['Shared seed (optional)', '共享种子（可选）'],
  random: [
    'Blank seed lets the provider choose independently for each clip. A shared seed does not guarantee matching results.',
    '留空时，提供商会为每个片段独立选择种子。共享种子不保证结果一致。'
  ],
  preview: ['Exact prompts for review', '待审核的完整提示词'],
  count: ['Separate paid clips', '单独付费的片段'],
  credits: [
    'Each clip uses workspace credits. Exact cost is unavailable. Camera instructions guide the model; they do not lock pixels.',
    '每个片段均消耗工作区点数，确切费用未知。相机指令用于引导模型，并非锁定像素。'
  ],
  review: ['Review clips', '审核片段'],
  unavailable: [
    'Choose a source, an available model, valid settings and one to three directions.',
    '请选择来源、可用模型、有效设置以及一至三个方向。'
  ],
  empty: [
    'No starting-frame video model is available.',
    '没有可用的首帧视频模型。'
  ]
} as const
export type MotionComparisonCopyKey = keyof typeof copy
export const tcMotionComparison = (
  key: MotionComparisonCopyKey,
  locale: Locale = 'en'
) => copy[key][locale === 'zh-CN' ? 1 : 0]
