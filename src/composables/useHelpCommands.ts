import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useExternalLink } from '@/composables/useExternalLink'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { buildSupportUrl } from '@/platform/support/config'
import { useTelemetry } from '@/platform/telemetry'
import type { ComfyCommand } from '@/stores/commandStore'

export function useHelpCommands(): ComfyCommand[] {
  const telemetry = useTelemetry()
  const { staticUrls, buildDocsUrl } = useExternalLink()
  const settingsDialog = useSettingsDialog()

  return [
    {
      id: 'Comfy.Help.OpenComfyUIIssues',
      icon: 'pi pi-github',
      label: 'Open ComfyUI Issues',
      menubarLabel: 'ComfyUI Issues',
      versionAdded: '1.5.5',
      function: () => {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'github',
          is_external: true,
          source: 'menu'
        })
        window.open(staticUrls.githubIssues, '_blank')
      }
    },
    {
      id: 'Comfy.Help.OpenComfyUIDocs',
      icon: 'pi pi-info-circle',
      label: 'Open ComfyUI Docs',
      menubarLabel: 'ComfyUI Docs',
      versionAdded: '1.5.5',
      function: () => {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'docs',
          is_external: true,
          source: 'menu'
        })
        window.open(buildDocsUrl('/', { includeLocale: true }), '_blank')
      }
    },
    {
      id: 'Comfy.Help.OpenComfyOrgDiscord',
      icon: 'pi pi-discord',
      label: 'Open Comfy-Org Discord',
      menubarLabel: 'Comfy-Org Discord',
      versionAdded: '1.5.5',
      function: () => {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'discord',
          is_external: true,
          source: 'menu'
        })
        window.open(staticUrls.discord, '_blank')
      }
    },
    {
      id: 'Comfy.Help.AboutComfyUI',
      icon: 'pi pi-info-circle',
      label: 'Open About ComfyUI',
      menubarLabel: 'About ComfyUI',
      versionAdded: '1.6.4',
      function: () => {
        settingsDialog.showAbout()
      }
    },
    {
      id: 'Comfy.Help.OpenComfyUIForum',
      icon: 'pi pi-comments',
      label: 'Open ComfyUI Forum',
      menubarLabel: 'ComfyUI Forum',
      versionAdded: '1.8.2',
      function: () => {
        telemetry?.trackHelpResourceClicked({
          resource_type: 'help_feedback',
          is_external: true,
          source: 'menu'
        })
        window.open(staticUrls.forum, '_blank')
      }
    },
    {
      id: 'Comfy.ContactSupport',
      icon: 'pi pi-question',
      label: 'Contact Support',
      versionAdded: '1.17.8',
      function: () => {
        const { userEmail, resolvedUserInfo } = useCurrentUser()
        const supportUrl = buildSupportUrl({
          userEmail: userEmail.value,
          userId: resolvedUserInfo.value?.id
        })
        window.open(supportUrl, '_blank', 'noopener,noreferrer')
      }
    }
  ]
}
