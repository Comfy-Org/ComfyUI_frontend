import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'

export function withSetup<T>(composable: () => T): T {
  let result!: T
  render(
    defineComponent({
      setup() {
        result = composable()
        return {}
      },
      template: '<div />'
    })
  )
  return result
}
