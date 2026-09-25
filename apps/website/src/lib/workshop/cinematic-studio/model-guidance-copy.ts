import type { Locale } from '../../../i18n/translations'

const en = {
  clipLength: 'Clip length',
  secondsUnit: 's',
  autoDuration: 'Auto',
  startingPoint: 'Studio starting point',
  suggestionNote:
    'Start with one simple action. This is a Studio suggestion, not a provider recommendation.',
  unknownDuration: 'Not specified here — check model page controls',
  waitTime: 'Generation wait time',
  details: 'More capabilities & generation wait time'
}
const zh = {
  clipLength: '视频时长',
  secondsUnit: '秒',
  autoDuration: '自动',
  startingPoint: '工作室建议起点',
  suggestionNote:
    '建议先尝试一个简单动作。这是工作室的建议，并非模型提供商的推荐。',
  unknownDuration: '此处未指定，请查看模型页面的控件',
  waitTime: '生成等待时间',
  details: '更多功能与生成等待时间'
}

export function modelGuidanceCopy(locale: Locale = 'en') {
  return locale === 'zh-CN' ? zh : en
}
