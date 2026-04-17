function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeUserEntry(
  entry: unknown
): { userId: string; username: string } | null {
  if (Array.isArray(entry) && entry.length >= 2) {
    const [userId, username] = entry
    if (typeof userId === 'string' && typeof username === 'string') {
      return { userId, username }
    }
    return null
  }

  if (!isRecord(entry)) {
    return null
  }

  const userId =
    typeof entry.userId === 'string'
      ? entry.userId
      : typeof entry.id === 'string'
        ? entry.id
        : null
  const username =
    typeof entry.username === 'string'
      ? entry.username
      : typeof entry.name === 'string'
        ? entry.name
        : null

  return userId && username ? { userId, username } : null
}

export function findUserIdByUsername(
  payload: unknown,
  username: string
): string | null {
  if (!isRecord(payload)) {
    return null
  }

  const { users } = payload
  if (Array.isArray(users)) {
    for (const entry of users) {
      const normalized = normalizeUserEntry(entry)
      if (normalized?.username === username) {
        return normalized.userId
      }
    }
    return null
  }

  if (!isRecord(users)) {
    return null
  }

  for (const [userId, currentUsername] of Object.entries(users)) {
    if (currentUsername === username) {
      return userId
    }
  }

  return null
}

export function isDuplicateUserErrorMessage(message: string): boolean {
  return /duplicate username|already exists/i.test(message)
}

export function buildFallbackUsername(
  username: string,
  suffix: string | number = Date.now()
): string {
  return `${username}-${suffix}`
}
