import * as Y from 'yjs'

export function write(value: unknown): void {
  if (value instanceof Y.Map) value.set('1', 'KSampler')
}
