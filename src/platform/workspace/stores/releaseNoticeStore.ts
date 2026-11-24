import { defineStore } from 'pinia'

export const useReleaseNoticeStore = defineStore('releaseNotice', () => {
  const claims = new Map<string, string | undefined>()

  function claim(releaseId: string, owner?: string): boolean {
    if (claims.has(releaseId))
      return owner !== undefined && claims.get(releaseId) === owner
    claims.set(releaseId, owner)
    return true
  }

  return { claim }
})
