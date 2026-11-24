import { defineStore } from 'pinia'

export const useReleaseNoticeStore = defineStore('releaseNotice', () => {
  const noticed = new Set<string>()

  function claim(releaseId: string): boolean {
    if (noticed.has(releaseId)) return false
    noticed.add(releaseId)
    return true
  }

  return { claim }
})
