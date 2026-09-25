import type { Locale } from '../../../i18n/translations'

const COPY = {
  sharedSettings: ['Saved studio settings', '已保存的工作室设置'],
  captureSettings: ['Use current studio settings', '使用当前工作室设置'],
  noSettings: [
    'No saved settings. Applying uses the current studio settings.',
    '尚未保存设置。应用时使用当前工作室设置。'
  ],
  settingsReview: [
    'Review the restored model and settings in the studio before generating. Unavailable models or reference bundles must be resolved there.',
    '生成前请在工作室中检查恢复的模型和设置。不可用的模型或参考图包需在那里处理。'
  ],
  settingsError: [
    'Save a valid studio setup and its reference bundle before capturing settings.',
    '请先保存有效的工作室设置及其参考图包。'
  ],
  takeCount: ['takes', '版本'],
  shotSettings: ['Shared brief and references', '共用场景与参考图'],
  includeSharedBrief: [
    'Include shared scene, character, setting and continuity',
    '包含共用场景、角色、环境及连贯性说明'
  ],
  references: ['References', '参考图'],
  referenceNote: [
    'Uncheck all to use no references for this shot.',
    '全部取消勾选即可不使用参考图。'
  ],
  noReferences: ['No references saved in this setup.', '此设置未保存参考图。'],
  takes: ['Saved takes', '已存版本'],
  previousVersion: [
    'Made with previous scene directions',
    '使用之前的场景指导生成'
  ],
  currentVersion: ['Matches these scene directions', '匹配当前场景指导'],
  sensitive: [
    'This take may contain sensitive content.',
    '此版本可能包含敏感内容。'
  ],
  reveal: ['Reveal this take', '显示此版本'],
  mediaUnavailable: [
    'Media is unavailable in this browser.',
    '此浏览器中无法获取媒体。'
  ],
  viewTake: ['View take', '查看版本'],
  editTake: ['Edit frame', '编辑画面'],
  animateTake: ['Animate frame', '动画化画面'],
  title: ['Scene workshop', '场景工作台'],
  description: [
    'Organize your own words and plan three shots. Applying a scene does not generate media or use credits.',
    '整理自己的文字并规划三个镜头。应用场景不会生成媒体或消耗积分。'
  ],
  build: ['Build scene', '构建场景'],
  plan: ['Plan shots', '规划镜头'],
  subject: ['Scene or starting idea', '场景或初始想法'],
  action: ['Action', '动作'],
  setting: ['Setting', '环境'],
  composition: ['Composition', '构图'],
  constraints: ['Keep or avoid', '保留或避免'],
  character: ['Shared character details', '共用角色细节'],
  continuity: ['Continuity notes', '连贯性说明'],
  scene: ['Shared scene', '共用场景'],
  framing: ['Shot framing', '镜头构图'],
  shotTitle: ['Shot title', '镜头标题'],
  preview: ['Exact scene preview', '完整场景预览'],
  apply: ['Use this scene', '使用此场景'],
  cancel: ['Cancel', '取消'],
  save: ['Save draft in this browser', '在此浏览器中保存草稿'],
  saved: ['Draft saved in this browser.', '草稿已保存在此浏览器中。'],
  export: ['Export JSON', '导出 JSON'],
  import: ['Import JSON', '导入 JSON'],
  imported: [
    'Draft imported. Review it before applying.',
    '草稿已导入，请检查后再应用。'
  ],
  invalid: [
    'Add a scene and framing, and keep each combined scene within 8,000 characters.',
    '请填写场景和构图，并将每个组合场景控制在 8,000 个字符以内。'
  ],
  importError: [
    'Choose a valid Cinema scene draft JSON file, up to 1 MB.',
    '请选择有效的 Cinema 场景草稿 JSON 文件，大小不超过 1 MB。'
  ],
  storageError: [
    'This browser could not save or restore the draft. Export JSON to keep a backup.',
    '此浏览器无法保存或恢复草稿。请导出 JSON 备份。'
  ],
  reset: ['Start from current scene', '从当前场景开始'],
  planNote: [
    'Save studio settings for this plan, choose each shot’s shared brief and references, then review in the studio before generating.',
    '为此计划保存工作室设置，选择各镜头的共用场景与参考图，然后在工作室中检查后再生成。'
  ],
  optional: ['Optional', '可选'],
  characters: ['characters', '字符']
} as const

export function tcBuilder(key: keyof typeof COPY, locale: Locale): string {
  return COPY[key][locale === 'zh-CN' ? 1 : 0]
}
