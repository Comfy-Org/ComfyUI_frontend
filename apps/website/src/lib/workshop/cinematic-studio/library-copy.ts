import type { Locale } from '../../../i18n/translations'

const copy = {
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
    'Settings restored. Reattach any reference images before generating.',
    '设置已恢复。生成前请重新添加参考图像。'
  ],
  builder: ['Build your scene', '构建场景'],
  creative: ['Creative controls', '创意控制']
} as const

export function libraryCopy(key: keyof typeof copy, locale: Locale = 'en') {
  return copy[key][locale === 'zh-CN' ? 1 : 0]
}
