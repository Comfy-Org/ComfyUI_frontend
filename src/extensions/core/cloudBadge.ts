import { isProductionEnvironment } from '@/config/environment'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.CloudBadge',
  // Only show badge when running in cloud environment
  topbarBadges: isProductionEnvironment()
    ? [
        {
          label: 'BETA',
          text: 'Comfy Cloud'
        }
      ]
    : undefined
})
