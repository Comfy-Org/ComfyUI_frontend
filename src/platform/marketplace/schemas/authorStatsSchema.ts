import { z } from 'zod'

export const statsPeriodSchema = z.enum(['day', 'week', 'month'])

export const periodDataPointSchema = z.object({
  date: z.string(),
  downloads: z.number().nonnegative(),
  favorites: z.number().nonnegative()
})

export const authorDashboardStatsSchema = z.object({
  totalDownloads: z.number().nonnegative(),
  totalFavorites: z.number().nonnegative(),
  averageRating: z.number().min(0).max(5),
  templateCount: z.number().nonnegative(),
  periodData: z.array(periodDataPointSchema)
})
