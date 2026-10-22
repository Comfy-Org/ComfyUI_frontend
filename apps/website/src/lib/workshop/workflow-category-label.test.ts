import { expect, it } from 'vitest'

import { workflowCategoryLabel } from './workflow-category-label'

it.for([
  {
    model: {
      category: 'video',
      categoryLabel: { en: 'Create videos', 'zh-CN': '制作视频' }
    },
    locale: 'zh-CN',
    label: '制作视频'
  },
  { model: { category: 'video' }, locale: 'en', label: 'video' },
  {
    model: { category: 'video', categoryLabel: { en: ' ', 'zh-CN': '' } },
    locale: 'en',
    label: 'video'
  },
  { model: {}, locale: 'en', label: 'Uncategorized' },
  { model: { category: '' }, locale: 'zh-CN', label: '未分类' }
])('names workflow category $label in $locale', ({ model, locale, label }) => {
  expect(workflowCategoryLabel(model, locale)).toBe(label)
})
