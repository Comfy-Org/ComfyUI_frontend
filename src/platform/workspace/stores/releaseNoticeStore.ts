import { defineStore } from 'pinia'

import { createToastId } from '@/types/toastId'

export const releaseNoticeId = createToastId()

export const useReleaseNoticeStore = defineStore('releaseNotice', () => {
  const claims = new Map<string, string | undefined>()

  function claim(releaseId: string, owner?: string): boolean {
    if (claims.has(releaseId))
      return owner !== undefined && claims.get(releaseId) === owner
    claims.set(releaseId, owner)
    return true
  }

  let shownBy: string | undefined

  function markShown(owner: string) {
    shownBy = owner
  }

  function isShownBy(owner: string): boolean {
    return shownBy === owner
  }

  return { claim, markShown, isShownBy }
})
