import { isCloud } from '@/platform/distribution/types'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.CloudBadge',
  // Only show badge when running in cloud environment
  topbarBadges: isCloud
    ? [
        {
          label: 'BETA',
          text: 'Comfy Cloud'
        }
      ]
    : undefined
})
