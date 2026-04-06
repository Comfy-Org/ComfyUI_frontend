export function workflowOgUrl(
  title: string,
  thumbnail?: string,
  creator?: string
): string {
  const params = new URLSearchParams({ type: 'workflow', title })
  if (thumbnail) params.set('thumbnail', thumbnail)
  if (creator) params.set('creator', creator)
  return `/workflows/og.png?${params}`
}

export function creatorOgUrl(
  name: string,
  username: string,
  avatar?: string
): string {
  const params = new URLSearchParams({ type: 'creator', name, username })
  if (avatar) params.set('avatar', avatar)
  return `/workflows/og.png?${params}`
}
