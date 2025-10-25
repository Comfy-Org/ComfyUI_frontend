import { computed } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { t } from '@/i18n'
import { useExtensionService } from '@/services/extensionService'
import type { TopbarBadge } from '@/types/comfy'

const badges = computed<TopbarBadge[]>(() => {
  const result: TopbarBadge[] = []

  // Add server health alert first (if present)
  const alert = remoteConfig.value.server_health_alert
  if (alert) {
    result.push({
      text: alert.message,
      label: alert.badge,
      variant: alert.severity ?? 'error',
      tooltip: alert.tooltip
    })
  }

  // TEMPORARY: Test badges for responsive design
  result.push({
    text: 'Server Maintenance',
    label: 'ALERT',
    variant: 'error',
    tooltip: 'Scheduled maintenance in 2 hours'
  })

  result.push({
    text: 'New Features Available',
    label: 'NEW',
    variant: 'warning',
    tooltip: 'Check out the latest updates'
  })

  result.push({
    text: 'System Status',
    variant: 'info',
    icon: 'pi pi-check-circle',
    tooltip: 'All systems operational'
  })

  // Always add cloud badge last (furthest right)
  result.push({
    label: t('g.beta'),
    text: 'Comfy Cloud'
  })

  return result
})

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.Badges',
  get topbarBadges() {
    return badges.value
  }
})
