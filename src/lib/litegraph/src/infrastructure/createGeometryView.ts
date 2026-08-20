import { createMutationView } from './createMutationView'

interface GeometryViewOptions {
  commit: () => void
  mapValue?: (property: PropertyKey, value: unknown) => unknown
  observe?: ArrayLike<number>
  synchronize?: () => void
}

export function createGeometryView<T extends object & ArrayLike<number>>(
  target: T,
  options: GeometryViewOptions
): T {
  return createMutationView(target, options)
}
