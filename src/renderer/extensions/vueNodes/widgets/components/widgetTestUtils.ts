import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'

export function createMockWidget<T extends WidgetValue = string>(
  overrides: Partial<SimplifiedWidget<T>> & { value: T }
): SimplifiedWidget<T> {
  return {
    name: 'test_widget',
    type: 'string',
    options: {},
    ...overrides
  }
}
