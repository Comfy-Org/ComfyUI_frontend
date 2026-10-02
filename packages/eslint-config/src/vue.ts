import type { Linter } from 'eslint'

const vue: Linter.Config = {
  name: '@comfyorg/eslint-config/vue',
  rules: {
    'vue/no-use-v-else-with-v-for': 'error'
  }
}

export default vue
