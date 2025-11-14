import { defineComfyExtConfig } from '@/extensions/utils'

export default defineComfyExtConfig({
  name: 'Comfy.Cloud.RemoteConfig',
  activationEvents: ['*'],
  comfyCloud: true,
})
