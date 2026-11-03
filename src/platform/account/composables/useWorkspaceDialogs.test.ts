import { describe, expect, it, vi } from 'vitest'

import { useWorkspaceDialogs } from '@/platform/account/composables/useWorkspaceDialogs'
import TeamWorkspacesDialogContent from '@/platform/account/components/dialogs/TeamWorkspacesDialogContent.vue'
import { useDialogStore } from '@/stores/dialogStore'

describe('useWorkspaceDialogs', () => {
  it('opens the team workspace dialog with the host creation callback', async () => {
    const onConfirm = vi
      .fn<(name: string) => Promise<void>>()
      .mockResolvedValue(undefined)

    await useWorkspaceDialogs().showTeamWorkspacesDialog(onConfirm)

    expect(useDialogStore().dialogStack).toMatchObject([
      {
        key: 'team-workspaces',
        visible: true,
        component: TeamWorkspacesDialogContent,
        contentProps: { onConfirm },
        dialogComponentProps: { headless: true }
      }
    ])
  })
})
