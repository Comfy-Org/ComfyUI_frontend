import { defineComfyExtConfig } from '@/extensions/utils'

export default defineComfyExtConfig({
  name: 'Comfy.Cloud.Subscription',
  activationEvents: ['*'],
  comfyCloud: {
    subscriptionRequired: true,
  },
})
