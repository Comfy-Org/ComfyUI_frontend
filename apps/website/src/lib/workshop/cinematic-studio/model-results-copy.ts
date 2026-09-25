import type { Locale } from '../../../i18n/translations'

const copy = {
  studio: ['Studio scenes', '工作室场景'],
  models: ['Model & tool results', '模型与工具结果'],
  description: [
    'Results saved from model pages on this browser, for this account and workspace. Earlier unsaved runs are not included.',
    '此浏览器为当前账户和工作区保存的模型页面结果。不包含此前未保存的运行结果。'
  ],
  saving: ['Saving to Your creations…', '正在保存到你的作品…'],
  saved: ['Saved to Your creations', '已保存到你的作品'],
  error: [
    'Could not save this result in this browser.',
    '无法在此浏览器中保存此结果。'
  ],
  retry: ['Retry save', '重试保存'],
  openLibrary: ['Your creations', '你的作品'],
  search: ['Search model & tool results', '搜索模型与工具结果'],
  empty: [
    'No saved model results match. New completed runs from model pages appear here after saving.',
    '没有匹配的已保存模型结果。模型页面上新完成的运行将在保存后显示在此处。'
  ],
  loading: ['Loading model results…', '正在加载模型结果…'],
  loadError: [
    'Could not load or update model results.',
    '无法加载或更新模型结果。'
  ],
  refresh: ['Refresh results', '刷新结果'],
  openModel: ['Open model', '打开模型'],
  download: ['Download', '下载'],
  hidden: [
    'This output is hidden by the content filter.',
    '此输出已被内容过滤器隐藏。'
  ],
  reveal: ['Reveal output', '显示输出'],
  remove: ['Remove result', '移除结果'],
  confirm: [
    'Remove this saved result and all its files from this browser?',
    '要从此浏览器中移除此保存结果及其所有文件吗？'
  ],
  cancel: ['Cancel', '取消'],
  animate: ['Animate', '制作动画'],
  edit: ['Edit image', '编辑图像'],
  file: ['Saved file', '已保存文件'],
  all: ['All output types', '所有输出类型'],
  image: ['Images', '图像'],
  video: ['Videos', '视频'],
  audio: ['Audio', '音频'],
  text: ['Text', '文本'],
  '3d': ['3D', '3D'],
  other: ['Other files', '其他文件']
} as const

export function tcModelResults(key: keyof typeof copy, locale: Locale = 'en') {
  return copy[key][locale === 'zh-CN' ? 1 : 0]
}
