import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'

import type { WorkspaceInviteCommands } from '@comfyorg/account-core/billing'

export const WORKSPACE_INVITES_KEY: InjectionKey<WorkspaceInviteCommands> =
  Symbol('workspaceInvites')

export function provideWorkspaceInvites(invites: WorkspaceInviteCommands) {
  provide(WORKSPACE_INVITES_KEY, invites)
}

/** The invite commands the billing shell built for this scope. */
export function useWorkspaceInvites(): WorkspaceInviteCommands {
  const invites = inject(WORKSPACE_INVITES_KEY)
  if (invites === undefined) {
    throw new Error('No workspace invites: render inside the billing shell')
  }
  return invites
}
