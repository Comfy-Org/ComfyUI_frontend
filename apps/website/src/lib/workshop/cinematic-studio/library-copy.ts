import type { Locale } from '../../../i18n/translations'

const copy = {
  referencePreparing: [
    'Saving references before generation…',
    '正在生成前保存参考图…'
  ],
  transition: ['Plan a transition', '规划转场'],
  motion: ['Compare camera directions', '对比相机运动'],
  separateClips: [
    'Separate clips; each uses workspace credits. Later clips stop if one fails.',
    '独立片段；每个均使用工作区积分。如某个失败，则停止后续片段。'
  ],
  referenceSaveError: [
    'Could not save the reference images in this browser. Free browser storage and try again. No generation was submitted.',
    '无法在此浏览器保存参考图像。请释放浏览器存储空间后重试。尚未提交生成请求。'
  ],
  referenceUnsupported: [
    'This model cannot use these references. Choose a reference-capable model or remove some images.',
    '此模型无法使用这些参考图。请选择支持参考图的模型，或移除部分图像。'
  ],
  compare: ['Compare results', '比较结果'],
  restoreError: [
    'Could not fully restore these settings or references. Check the selected model and reattach missing images.',
    '无法完整恢复这些设置或参考图。请检查所选模型并重新添加缺失的图像。'
  ],
  seed: ['Seed (optional)', '种子（可选）'],
  random: ['Random', '随机'],
  providerAspect: [
    'Framing follows source or provider',
    '构图由源图或提供方决定'
  ],
  title: ['Your creations', '你的作品'],
  description: [
    'Saved in this browser for your current account and workspace. Download important work to keep a backup.',
    '作品保存在当前浏览器中，按账号和工作区分开。请下载重要作品作为备份。'
  ],
  empty: [
    'Your completed images and videos will appear here.',
    '完成的图像和视频将显示在这里。'
  ],
  search: ['Search creations', '搜索作品'],
  all: ['All', '全部'],
  image: ['Images', '图像'],
  video: ['Videos', '视频'],
  favorite: ['Favorite', '收藏'],
  favorites: ['Favorites only', '仅收藏'],
  remove: ['Delete from this browser', '从此浏览器删除'],
  confirmDelete: ['Delete this saved creation?', '删除此保存的作品？'],
  cancel: ['Cancel', '取消'],
  close: ['Close', '关闭'],
  download: ['Download', '下载'],
  reuse: ['Reuse settings', '复用设置'],
  name: ['Creation name', '作品名称'],
  rename: ['Rename', '重命名'],
  animate: ['Animate', '制作动画'],
  edit: ['Edit image', '编辑图像'],
  recipe: ['Save recipe', '保存配方'],
  retry: ['Retry saving', '重试保存'],
  error: [
    'Some creations could not be saved in this browser. Keep this page open and download your results, or free browser storage and retry.',
    '部分作品无法保存在此浏览器中。请保持页面打开并下载结果，或释放浏览器存储空间后重试。'
  ],
  loading: ['Loading saved creations…', '正在加载已保存作品…'],
  reveal: ['Reveal preview', '显示预览'],
  hidden: ['Preview hidden', '预览已隐藏'],
  reuseNotice: [
    'Settings and locally available references restored. Check your references before generating.',
    '设置和本地可用参考图已恢复。请在生成前检查参考图。'
  ],
  builder: ['Build your scene', '构建场景'],
  creative: ['Creative controls', '创意控制']
} as const

export function libraryCopy(key: keyof typeof copy, locale: Locale = 'en') {
  return copy[key][locale === 'zh-CN' ? 1 : 0]
}
