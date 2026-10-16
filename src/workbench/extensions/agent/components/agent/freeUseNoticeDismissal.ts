export const FREE_USE_NOTICE_DISMISSED_KEY =
  'Comfy.AgentPanel.freeUseNoticeDismissed'

/**
 * Account-scoped, because a browser-wide dismissal carries across an account
 * switch and a shared browser: the next viewer sees no notice while the panel
 * still reports them exposed to their treatment arm, diluting the arm with a
 * dismissal nobody in it made. Signed-out viewers share the unsuffixed key.
 */
export function freeUseNoticeDismissedKey(userId: string | undefined): string {
  return userId === undefined
    ? FREE_USE_NOTICE_DISMISSED_KEY
    : `${FREE_USE_NOTICE_DISMISSED_KEY}.${userId}`
}
