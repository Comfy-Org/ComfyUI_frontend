import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.CloudBadge',
  // Only show badge when running in cloud environment
  topbarBadges: isCloud
    ? [
        {
          label: t('g.beta'),
          text: 'Comfy Cloud'
        }
      ]
    : undefined
})
