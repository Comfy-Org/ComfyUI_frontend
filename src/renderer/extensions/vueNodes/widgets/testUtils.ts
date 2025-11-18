import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

/**
 * Creates a mock SimplifiedWidget for testing Vue Node widgets.
 * This utility function is shared across widget component tests to ensure consistency.
 */
export function createMockWidget<T extends WidgetValue = WidgetValue>(
  value: T = null as T,
  options: Record<string, any> = {},
  callback?: (value: T) => void,
  overrides: Partial<SimplifiedWidget<T>> = {},
  spec?: Partial<InputSpec>
): SimplifiedWidget<T> {
  const widget: SimplifiedWidget<T> = {
    name: 'test_widget',
    type: 'default',
    value,
    options,
    callback,
    ...overrides
  }

  // Only add spec if provided
  if (spec) {
    widget.spec = spec as InputSpec
  }

  return widget
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
