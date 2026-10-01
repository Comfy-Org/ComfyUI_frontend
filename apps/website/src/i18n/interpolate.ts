export type NamedValues = Record<string, string | number>

export function interpolate(message: string, named: NamedValues): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(named, name) ? String(named[name]) : placeholder
  )
}
