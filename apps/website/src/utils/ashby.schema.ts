import { z } from 'zod'

export const AshbyJobPostingSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  isListed: z.boolean(),
  jobUrl: z.url(),
  applyUrl: z.url().optional()
})

export const AshbyJobBoardResponseSchema = z.object({
  apiVersion: z.literal('1'),
  jobs: z.array(z.unknown())
})

export type AshbyJobPosting = z.infer<typeof AshbyJobPostingSchema>
