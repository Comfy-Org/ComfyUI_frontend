import type { Locale } from '../../../i18n/translations'

const COPY = {
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
    'Each card shares the character and setting. Use a scene, then review your generation settings in the studio. References must be attached separately.',
    '每张卡片共用角色和环境。使用场景后，请在工作室中检查生成设置。参考图需单独添加。'
  ],
  optional: ['Optional', '可选'],
  characters: ['characters', '字符']
} as const

export function tcBuilder(key: keyof typeof COPY, locale: Locale): string {
  return COPY[key][locale === 'zh-CN' ? 1 : 0]
}
