import { z } from 'zod'

const checkboxField = z.boolean().optional()
export const issueReportSchema = z
  .object({
    contactInfo: z.string().email().max(320).optional().or(z.literal('')),
    details: z.string().max(5_000).optional(),
    helpType: z.string().optional()
  })
  .catchall(checkboxField)
  .refine((data) => Object.values(data).some((value) => value), {
    path: ['details', 'helpType']
  })
  .refine((data) => data.helpType !== undefined && data.helpType !== '', {
    message: 'Help type is required',
    path: ['helpType']
  })
export type IssueReportFormData = z.infer<typeof issueReportSchema>
