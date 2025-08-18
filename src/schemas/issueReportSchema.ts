import { z } from 'zod'

import { t } from '@/i18n'

const checkboxField = z.boolean().optional()
export const issueReportSchema = z
  .object({
    contactInfo: z.string().email().max(320).optional().or(z.literal('')),
    details: z
      .string()
      .min(1, { message: t('validation.descriptionRequired') })
      .max(5_000, { message: t('validation.maxLength', { length: 5_000 }) })
      .optional(),
    helpType: z.string().optional()
  })
  .catchall(checkboxField)
  .refine((data) => Object.values(data).some((value) => value), {
    path: ['details', 'helpType']
  })
  .refine((data) => data.helpType !== undefined && data.helpType !== '', {
    message: t('issueReport.validation.helpTypeRequired'),
    path: ['helpType']
  })
  .refine((data) => data.details !== undefined && data.details !== '', {
    message: t('issueReport.validation.descriptionRequired'),
    path: ['details']
  })
export type IssueReportFormData = z.infer<typeof issueReportSchema>
