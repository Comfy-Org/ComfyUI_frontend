import { defineComfyExtConfig } from '@/extensions/utils'

export default defineComfyExtConfig({
  name: 'Comfy.SaveGLB',
  activationEvents: ['onWidgets:contributes', 'onCommands:contributes', 'onSettings:contributes'],
  contributes: [
    {
      name: 'Comfy.SaveGLB',
      widgets: ['SAVE_GLB'],
    },
  ],
})
