import type { Locale } from '../../../i18n/translations'

const copy = {
  previous: ['Previous', '上一个'],
  next: ['Next', '下一个'],
  of: ['of', '/'],
  guidance: [
    'These choices guide the visual style of your prompt; they do not simulate physical camera hardware.',
    '这些选项为提示词提供视觉风格指导，并不模拟真实相机硬件。'
  ]
} as const

export function tcEquipment(key: keyof typeof copy, locale: Locale = 'en') {
  return copy[key][locale === 'zh-CN' ? 1 : 0]
}
