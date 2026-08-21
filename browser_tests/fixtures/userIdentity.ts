export function createdUserId(value: unknown): string {
  if (typeof value !== 'string' || value === '')
    throw new Error('Failed to create user: response carried no user ID')
  return value
}
