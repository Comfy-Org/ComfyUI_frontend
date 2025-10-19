import { t } from '@/i18n'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.CloudBadge',
  topbarBadges: [
    {
      label: t('g.beta'),
      text: 'Comfy Cloud'
    }
  ]
})
