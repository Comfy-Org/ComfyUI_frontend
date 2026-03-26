import { useCommandStore } from '@/stores/commandStore'
import { useExternalLink } from '@/composables/useExternalLink'
import { useTelemetry } from '@/platform/telemetry'

export function useErrorActions() {
  const telemetry = useTelemetry()
  const commandStore = useCommandStore()
  const { staticUrls } = useExternalLink()

  function openGitHubIssues() {
    telemetry?.trackUiButtonClicked({
      button_id: 'error_tab_github_issues_clicked'
    })
    window.open(staticUrls.githubIssues, '_blank', 'noopener,noreferrer')
  }

  function contactSupport() {
    telemetry?.trackHelpResourceClicked({
      resource_type: 'help_feedback',
      is_external: true,
      source: 'error_dialog'
    })
    void commandStore.execute('Comfy.ContactSupport')
  }

  function findOnGitHub(errorMessage: string) {
    telemetry?.trackUiButtonClicked({
      button_id: 'error_tab_find_existing_issues_clicked'
    })
    const query = encodeURIComponent(errorMessage + ' is:issue')
    window.open(
      `${staticUrls.githubIssues}?q=${query}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return { openGitHubIssues, contactSupport, findOnGitHub }
}
