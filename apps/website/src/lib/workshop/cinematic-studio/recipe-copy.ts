import type { Locale } from '../../../i18n/translations'

const COPY = {
  title: ['Import a recipe', '导入配方'],
  description: [
    'Review saved settings before applying them. Importing never starts a generation.',
    '应用前请检查保存的设置。导入不会开始生成。'
  ],
  choose: ['Choose recipe JSON', '选择配方 JSON'],
  apply: ['Apply recipe', '应用配方'],
  cancel: ['Cancel', '取消'],
  model: ['Model', '模型'],
  format: ['Format', '格式'],
  preview: ['Saved prompt', '保存的提示词'],
  settings: ['Saved settings', '保存的设置'],
  unsupported: [
    'This recipe’s model is not available for this operation. Choose another recipe; no substitute model will be selected.',
    '此配方的模型不适用于当前操作。请选择其他配方，系统不会自动选择替代模型。'
  ],
  unavailable: ['Model unavailable', '模型不可用'],
  references: [
    'Reference images and video frames are not included in a recipe. Reattach the original references before generating.',
    '配方不包含参考图像和视频帧。生成前请重新添加原始参考素材。'
  ],
  source: ['Original source image', '原始源图像'],
  sourceHelp: [
    'This is an image-editing recipe. Choose its original source image: PNG, JPEG or WebP, up to 12 MiB.',
    '这是图像编辑配方。请选择其原始源图像：PNG、JPEG 或 WebP，大小不超过 12 MiB。'
  ],
  sourceError: [
    'Choose a valid PNG, JPEG or WebP source image up to 12 MiB.',
    '请选择有效的 PNG、JPEG 或 WebP 源图像，大小不超过 12 MiB。'
  ],
  error: [
    'Choose a valid version 1 Cinema recipe JSON file up to 1 MB.',
    '请选择有效的第 1 版 Cinema 配方 JSON 文件，大小不超过 1 MB。'
  ],
  chooseAccount: [
    'Choose an account and workspace before importing a recipe.',
    '导入配方前，请先选择账号和工作区。'
  ]
} as const

export function tcRecipe(
  key: keyof typeof COPY,
  locale: Locale = 'en'
): string {
  return COPY[key][locale === 'zh-CN' ? 1 : 0]
}
