import { z } from 'astro/zod'
import { accountID } from './account-id'

const avatarURL = z
  .string()
  .url()
  .max(4000)
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' && !url.username && !url.password && !url.hash
    )
  })
export const profileChoices = z
  .object({
    items: z
      .array(
        z
          .object({
            id: accountID,
            label: z.string().min(1).max(100),
            username: z.string().min(3).max(42),
            avatar_url: avatarURL.optional()
          })
          .strict()
      )
      .max(20)
  })
  .strict()
export type ProfileChoice = z.infer<typeof profileChoices>['items'][number]

export function validProfileQuery(query: string) {
  return (
    query.length >= 2 &&
    query.length <= 100 &&
    query === query.trim() &&
    !/[\p{Cc}@]/u.test(query)
  )
}

export async function searchProfiles(query: string, signal: AbortSignal) {
  if (!validProfileQuery(query)) return { ok: false as const }
  try {
    const response = await fetch(
      `/admin/content-api/profiles?${new URLSearchParams({ q: query })}`,
      {
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)])
      }
    )
    if (!response.ok) return { ok: false as const }
    const parsed = profileChoices.safeParse(await response.json())
    return parsed.success
      ? { ok: true as const, items: parsed.data.items }
      : { ok: false as const }
  } catch {
    return { ok: false as const }
  }
}
