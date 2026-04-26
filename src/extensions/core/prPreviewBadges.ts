import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useExtensionService } from '@/services/extensionService'
import type { AboutPageBadge, TopbarBadge } from '@/types/comfy'

const REPO = 'https://github.com/Comfy-Org/ComfyUI_frontend'

const prNumber = __CI_PR_NUMBER__
const author = __CI_PR_AUTHOR__
const commit = __COMFYUI_FRONTEND_COMMIT__
const commitShort = commit ? commit.slice(0, 8) : ''

const settingStore = useSettingStore()
const apiNodesEnabled = settingStore.get('Comfy.NodeBadge.ShowApiPricing')

const backendUrl = `${api.api_host}${api.api_base}` || 'localhost:8188'

const tooltipLines = [
  author ? `@${author}` : null,
  commitShort ? commitShort : null,
  t('prPreview.badge.tooltipBackend', { url: backendUrl }),
  apiNodesEnabled
    ? t('prPreview.badge.tooltipCloudApiNote')
    : t('prPreview.badge.tooltipCloudApiDisabled')
]
  .filter(Boolean)
  .join(' · ')

const topbarBadges: TopbarBadge[] = [
  {
    label: t('prPreview.badge.label'),
    text: `#${prNumber}`,
    variant: 'warning',
    tooltip: tooltipLines
  }
]

const aboutPageBadges: AboutPageBadge[] = [
  {
    label: `PR #${prNumber}`,
    url: `${REPO}/pull/${prNumber}`,
    icon: 'pi pi-github'
  },
  ...(author
    ? [
        {
          label: `@${author}`,
          url: `https://github.com/${author}`,
          icon: 'pi pi-user'
        }
      ]
    : []),
  ...(commitShort
    ? [
        {
          label: commitShort,
          url: `${REPO}/commit/${commit}`,
          icon: 'pi pi-code'
        }
      ]
    : [])
]

useExtensionService().registerExtension({
  name: 'Comfy.PrPreview.Badges',
  topbarBadges,
  aboutPageBadges
})
