interface SupportFormIdentity {
  email?: string | null
  userId?: string | null
}

/** Appends the signed-in user's details as the form's pre-fill parameters. */
export function buildSupportFormUrl(
  baseUrl: string,
  { email, userId }: SupportFormIdentity = {}
): string {
  const url = new URL(baseUrl)
  if (email) url.searchParams.set('email', email)
  if (userId) url.searchParams.set('comfy_cloud_user_id', userId)
  return url.toString()
}
