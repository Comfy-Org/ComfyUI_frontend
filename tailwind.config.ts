import { default as config } from '@comfyorg/design-system/tailwind-config'

export default {
  ...config,
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}']
}
