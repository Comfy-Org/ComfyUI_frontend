import { z } from 'zod'

export const AshbyJobPostingSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  isListed: z.boolean(),
  jobUrl: z.string().url(),
  applyUrl: z.string().url().optional()
})

export const AshbyJobBoardResponseSchema = z.object({
  apiVersion: z.literal('1'),
  // Deliberately z.unknown() — each job is validated individually in
  // parseRoles() so that invalid postings are dropped with per-job error
  // messages rather than rejecting the entire response.
  jobs: z.array(z.unknown())
})

export type AshbyJobPosting = z.infer<typeof AshbyJobPostingSchema>
