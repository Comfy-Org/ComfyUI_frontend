import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'

/**
 * Creates a mock SimplifiedWidget for testing Vue Node widgets.
 * This utility function is shared across widget component tests to ensure consistency.
 */
export function createMockWidget<T extends WidgetValue>(
  value: T = null as T,
  options: Record<string, any> = {},
  callback?: (value: T) => void,
  overrides: Partial<SimplifiedWidget<T>> = {}
): SimplifiedWidget<T> {
  return {
    name: 'test_widget',
    type: 'default',
    value,
    options,
    callback,
    ...overrides
  }
}

/**
 * Creates a mock file for testing file upload widgets.
 */
export function createMockFile(name: string, type: string, size = 1024): File {
  const file = new File(['mock content'], name, { type })
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false
  })
  return file
}
