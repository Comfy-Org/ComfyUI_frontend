import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionService } from '@/services/extensionService'
import type { AboutPageBadge, TopbarBadge } from '@/types/comfy'

const REPO = 'https://github.com/Comfy-Org/ComfyUI_frontend'

const prNumber = __CI_PR_NUMBER__
const author = __CI_PR_AUTHOR__
const commit = __COMFYUI_FRONTEND_COMMIT__
const commitShort = commit ? commit.slice(0, 8) : ''

const settingStore = useSettingStore()
const apiNodesEnabled = settingStore.get('Comfy.NodeBadge.ShowApiPricing')

const backendUrl = localStorage.getItem('comfyui-preview-backend-url') ?? '—'

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

const popoverLinks = [
  { label: `PR #${prNumber}`, url: `${REPO}/pull/${prNumber}` },
  ...(author
    ? [{ label: `@${author}`, url: `https://github.com/${author}` }]
    : []),
  ...(commitShort
    ? [{ label: commitShort, url: `${REPO}/commit/${commit}` }]
    : []),
  { label: t('prPreview.badge.configureBackend'), url: '/connect' }
]

const badgeText = commitShort ? `#${prNumber} · ${commitShort}` : `#${prNumber}`

const topbarBadges: TopbarBadge[] = [
  {
    label: t('prPreview.badge.label'),
    text: badgeText,
    variant: 'warning',
    tooltip: tooltipLines,
    popoverLinks
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
