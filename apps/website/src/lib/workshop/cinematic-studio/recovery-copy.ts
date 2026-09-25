import type { Locale } from '../../../i18n/translations'

const COPY = {
  title: ['Unfinished requests', '未完成的请求'],
  modelUnavailable: ['Model unavailable', '模型不可用'],
  description: [
    'Check an existing request for its result. This does not start another generation.',
    '检查现有请求的结果，不会开始新的生成。'
  ],
  unknown: [
    'Submission was interrupted before a recoverable receipt was saved. Its status is unknown. Check your workspace activity before starting again.',
    '提交中断，尚未保存可恢复的凭据。状态未知，请先查看工作区活动，再决定是否重新生成。'
  ],
  pending: [
    'A request receipt is saved. Check whether its result is ready.',
    '已保存请求凭据。可检查结果是否已就绪。'
  ],
  cancelRequested: [
    'Cancellation was requested; completion is not confirmed. Check the request for its final status.',
    '已请求取消，但尚未确认最终状态。请检查请求。'
  ],
  complete: [
    'The result has not yet been confirmed saved in this browser. Retry saving or check the existing request.',
    '尚未确认结果已保存在此浏览器中。请重试保存或检查现有请求。'
  ],
  terminal: [
    'The request finished without a recoverable result.',
    '请求已结束，没有可恢复的结果。'
  ],
  recover: ['Check existing request', '检查现有请求'],
  dismiss: ['Dismiss notice', '关闭提示'],
  error: [
    'Recovery information could not be saved or a result could not be checked. Keep this page open and download any completed results.',
    '无法保存恢复信息或检查结果。请保持页面打开，并下载已完成的结果。'
  ]
} as const

export function tcRecovery(
  key: keyof typeof COPY,
  locale: Locale = 'en'
): string {
  return COPY[key][locale === 'zh-CN' ? 1 : 0]
}
