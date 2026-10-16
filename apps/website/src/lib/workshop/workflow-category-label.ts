import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { translationsFor } from '@/i18n/translations'

export function workflowCategoryLabel(
  model: Pick<WorkflowWorkshopModel, 'category' | 'categoryLabel'>,
  locale: string
) {
  const language = locale === 'zh-CN' ? 'zh-CN' : 'en'
  return (
    model.categoryLabel?.[language].trim() ||
    model.category?.trim() ||
    translationsFor(language).t('workshop.catalogue.uncategorized')
  )
}
