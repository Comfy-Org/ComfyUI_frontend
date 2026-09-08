let counter = 0

export function generateId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}
