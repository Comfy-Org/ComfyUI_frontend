import type { Locale, LocalizedText } from '../../../i18n/translations'

const copy = {
  active: { en: 'Scene references', 'zh-CN': '场景参考图' },
  detach: { en: 'Remove from scene', 'zh-CN': '从场景移除' },
  limit: {
    en: 'Use up to three saved references per image. Remove one to choose another.',
    'zh-CN': '每张图像最多使用三张已保存参考图。请先移除一张再选择其他参考图。'
  },
  imageOnly: {
    en: 'Saved references are used for images. Animate the resulting image to carry them into a video.',
    'zh-CN':
      '已保存参考图用于图像。可将生成的图像制作成动画，以在视频中延续其内容。'
  },
  title: { en: 'Characters, places & props', 'zh-CN': '角色、地点与道具' },
  description: {
    en: 'Save named image references in this browser for your account and workspace. References guide appearance; they do not guarantee an identical result.',
    'zh-CN':
      '在此浏览器中为当前账户和工作区保存命名图像参考。参考图引导外观，但无法保证结果完全一致。'
  },
  search: { en: 'Search references', 'zh-CN': '搜索参考图' },
  upload: { en: 'Upload reference image', 'zh-CN': '上传参考图' },
  uploadHint: {
    en: 'PNG, JPEG or WebP, up to 12 MB and 32 megapixels. Up to 40 references per workspace.',
    'zh-CN':
      '支持 PNG、JPEG 或 WebP，最大 12 MB、3200 万像素。每个工作区最多保存 40 张参考图。'
  },
  creation: { en: 'Start from a saved creation', 'zh-CN': '从已保存作品开始' },
  choose: { en: 'Choose an image', 'zh-CN': '选择图像' },
  name: { en: 'Reference name', 'zh-CN': '参考图名称' },
  kind: { en: 'Reference role', 'zh-CN': '参考用途' },
  character: { en: 'Character', 'zh-CN': '角色' },
  location: { en: 'Location', 'zh-CN': '地点' },
  prop: { en: 'Prop', 'zh-CN': '道具' },
  characterGuide: {
    en: 'Describe face, hair and wardrobe to retain. A clear portrait can help identify the character.',
    'zh-CN': '描述要保留的面容、发型和服装。清晰的人像有助于识别角色。'
  },
  locationGuide: {
    en: 'Describe the setting to retain. Mention whether people in this reference should be ignored.',
    'zh-CN': '描述要保留的环境，并说明是否忽略参考图中的人物。'
  },
  propGuide: {
    en: 'Describe the object’s shape, materials and identifying details.',
    'zh-CN': '描述物体的形状、材质和识别细节。'
  },
  notes: { en: 'Details to preserve', 'zh-CN': '要保留的细节' },
  crop: { en: 'Crop reference', 'zh-CN': '裁剪参考图' },
  cropHint: {
    en: 'Choose a region in source pixels. Cropping retains those pixels without resizing or generating new content. Apply crop before saving.',
    'zh-CN':
      '以原图像素选择区域。裁剪保留所选像素，不缩放或生成新内容。保存前请应用裁剪。'
  },
  x: { en: 'Left (px)', 'zh-CN': '左侧（像素）' },
  y: { en: 'Top (px)', 'zh-CN': '顶部（像素）' },
  width: { en: 'Width (px)', 'zh-CN': '宽度（像素）' },
  height: { en: 'Height (px)', 'zh-CN': '高度（像素）' },
  applyCrop: { en: 'Apply crop to draft', 'zh-CN': '将裁剪应用到草稿' },
  save: { en: 'Save reference', 'zh-CN': '保存参考图' },
  saved: { en: 'Reference saved.', 'zh-CN': '参考图已保存。' },
  edit: { en: 'Edit details or crop', 'zh-CN': '编辑详情或裁剪' },
  use: { en: 'Use reference', 'zh-CN': '使用参考图' },
  remove: { en: 'Delete', 'zh-CN': '删除' },
  confirmDelete: {
    en: 'Delete this saved reference from this browser? This cannot be undone.',
    'zh-CN': '从此浏览器删除此参考图？此操作无法撤销。'
  },
  deleteNow: { en: 'Delete reference', 'zh-CN': '删除参考图' },
  cancel: { en: 'Cancel', 'zh-CN': '取消' },
  new: { en: 'New reference', 'zh-CN': '新参考图' },
  empty: {
    en: 'No matching references yet. Upload an image or choose a saved creation.',
    'zh-CN': '暂无匹配的参考图。请上传图像或选择已保存作品。'
  },
  unavailable: {
    en: 'Sign in and select a workspace to save references.',
    'zh-CN': '请登录并选择工作区以保存参考图。'
  },
  error: {
    en: 'Could not complete that change. Check the image format, size and available browser storage, then try again.',
    'zh-CN':
      '无法完成更改。请检查图像格式、大小和浏览器可用存储空间，然后重试。'
  },
  busy: { en: 'Preparing reference…', 'zh-CN': '正在准备参考图…' },
  preview: { en: 'Reference crop preview', 'zh-CN': '参考图裁剪预览' }
} as const satisfies Record<string, LocalizedText>

export type AssetCopyKey = keyof typeof copy
export function tcAssets(key: AssetCopyKey, locale: Locale = 'en'): string {
  const entry: LocalizedText = copy[key]
  return entry[locale] ?? entry.en
}
