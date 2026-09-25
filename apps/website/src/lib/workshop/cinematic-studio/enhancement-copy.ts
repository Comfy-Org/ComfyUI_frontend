import type { Locale } from '../../../i18n/translations'
const copy = {
  recover: ['Check existing request', '检查已有请求'],
  newRequest: ['Start a new review', '开始新的审核'],
  requestId: ['Router request', 'Router 请求'],
  submissionId: ['Submission identity', '提交标识'],
  retained: [
    'Closing keeps this request and your editable suggestion in this browser for this workspace. Reopening never submits again.',
    '关闭后，此工作区的请求和可编辑建议将保留在此浏览器中。重新打开不会再次提交。'
  ],
  noAdmission: [
    'Admission was not confirmed. No safe status lookup is available; this request will not be replayed.',
    '尚未确认请求受理，无法安全查询状态；不会重新提交此请求。'
  ],
  storageError: [
    'This browser could not save or restore the enhancement. Keep this page open to retain the current request and suggestion.',
    '此浏览器无法保存或恢复优化内容。请保持此页面打开以保留当前请求和建议。'
  ],
  confirm: ['Generate suggestion · uses credits', '生成建议 · 使用积分'],
  demoConfirm: [
    'Generate demo suggestion · no credits',
    '生成演示建议 · 不使用积分'
  ],
  demoNotice: [
    'Demo only. This suggestion is a local sample; no request is sent and no credits are used.',
    '仅供演示。建议为本地样例，不发送请求，也不使用积分。'
  ],
  running: ['Preparing your suggestion…', '正在准备建议…'],
  suggestion: ['Editable suggestion', '可编辑的建议'],
  proposed: ['Scene with your suggestion', '添加建议后的场景'],
  apply: ['Apply suggestion', '应用建议'],
  back: ['Back to review', '返回审核'],
  usage: ['Tokens: input / output', '令牌数：输入 / 输出'],
  unknown: ['Unavailable', '未知'],
  request: [
    'The request could not be confirmed. It was not retried; it may already have used credits. Your original scene is unchanged.',
    '无法确认请求，未进行重试；可能已使用积分。原始场景未改变。'
  ],
  signedOut: ['Sign in to request a suggestion.', '登录后即可请求建议。'],
  pending: ['Checking your workspace…', '正在检查工作区…'],
  noCredits: [
    'Your workspace needs credits before requesting a suggestion.',
    '工作区需要积分才能请求建议。'
  ],
  memberNoCredits: [
    'Ask your workspace owner to add credits.',
    '请工作区所有者添加积分。'
  ],
  title: ['Enhance prompt', '优化提示词'],
  description: [
    'Ask Claude Haiku 4.5 through Comfy Router for optional visual details. Your original scene stays unchanged until you review and apply an editable suggestion.',
    '通过 Comfy Router 请 Claude Haiku 4.5 提供可选的视觉细节。审核并应用可编辑的建议之前，原始场景不会改变。'
  ],
  scene: ['Original scene', '原始场景'],
  directions: ['Existing creative directions', '现有创作指导'],
  model: ['Text model', '文本模型'],
  none: ['None', '无'],
  privacy: [
    'Only this scene text and these directions are sent. Reference images are not sent. This request does not generate images or videos.',
    '仅发送此场景文本和这些指导，不发送参考图像。此请求不会生成图像或视频。'
  ],
  cost: [
    'This text request uses workspace credits. Its exact cost is unavailable.',
    '此文本请求使用工作区积分，确切费用未知。'
  ],
  acknowledge: [
    'I understand this text request uses credits.',
    '我了解此文本请求会使用积分。'
  ],
  review: ['Review enhancement request', '审核优化请求'],
  cancel: ['Close without applying', '关闭而不应用'],
  unavailable: [
    'Prompt enhancement is unavailable for this session.',
    '此会话无法使用提示词优化。'
  ],
  input: [
    'Enter a scene of 1–6,000 characters and keep creative directions within 6,000 characters.',
    '请输入 1–6,000 个字符的场景，并将创作指导保持在 6,000 个字符以内。'
  ],
  room: [
    'There is not enough room for a suggestion. Shorten the scene or creative directions.',
    '没有足够空间添加建议，请缩短场景或创作指导。'
  ],
  incomplete: [
    'The suggestion was incomplete. Your original scene is unchanged.',
    '建议不完整，原始场景未改变。'
  ],
  refused: [
    'The model declined the suggestion. Your original scene is unchanged.',
    '模型拒绝了此建议，原始场景未改变。'
  ],
  response: [
    'The model did not return a usable suggestion. Your original scene is unchanged.',
    '模型未返回可用的建议，原始场景未改变。'
  ],
  length: [
    'The suggestion exceeds the prompt limit. Shorten it before applying.',
    '建议超出提示词限制，请缩短后再应用。'
  ],
  changed: [
    'The scene changed after this suggestion was requested. Your current scene is unchanged.',
    '请求建议后场景已改变，当前场景未改变。'
  ]
} as const
export function tcEnhancement(
  key: keyof typeof copy,
  locale: Locale = 'en'
): string {
  return copy[key][locale === 'zh-CN' ? 1 : 0]
}
