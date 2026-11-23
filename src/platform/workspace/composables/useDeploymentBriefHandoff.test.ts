import { describe, expect, it, vi } from 'vitest'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { useDeploymentBriefHandoff } from '@/platform/workspace/composables/useDeploymentBriefHandoff'

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))
vi.mock(import('@/platform/workflow/deploy/utils/agentApps'), () => ({
  openAgentApp: vi.fn()
}))

describe(useDeploymentBriefHandoff, () => {
  it('downloads the workflow and opens the app within the click, then says the brief was copied', async () => {
    const steps: string[] = []
    vi.mocked(downloadBlob).mockImplementation((fileName) => {
      steps.push(`download ${fileName}`)
    })
    vi.mocked(openAgentApp).mockImplementation((app, prompt) => {
      steps.push(`open ${app}: ${prompt}`)
    })
    let grantClipboard!: () => void
    vi.spyOn(navigator.clipboard, 'writeText').mockReturnValue(
      new Promise<void>((resolve) => {
        grantClipboard = resolve
      })
    )
    const { openBriefIn } = useDeploymentBriefHandoff(() => ({
      brief: '# The brief for an agent',
      workflow: { fileName: 'portrait.json', serialize: () => '{}' }
    }))

    const opening = openBriefIn('claude')

    expect(steps).toEqual([
      'download portrait.json',
      'open claude: # The brief for an agent'
    ])

    grantClipboard()
    await opening

    expect(
      useToast().toasts.map(({ kind, title }) => ({ kind, title }))
    ).toEqual([
      {
        kind: 'info',
        title:
          'Prompt copied. If the app asks you to sign in first, paste it after you sign in.'
      }
    ])
  })
})
