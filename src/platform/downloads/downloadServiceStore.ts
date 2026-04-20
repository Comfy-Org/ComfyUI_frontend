import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { DownloadService } from './types'

async function createDownloadServiceProvider(): Promise<DownloadService> {
  if (__DISTRIBUTION__ === 'desktop') {
    const { createElectronDownloadService } = await import(
      './providers/createElectronDownloadService'
    )
    return createElectronDownloadService()
  }

  if (__DISTRIBUTION__ === 'cloud') {
    const { createCloudDownloadService } = await import(
      './providers/createCloudDownloadService'
    )
    return createCloudDownloadService()
  }

  const { createBrowserDownloadService } = await import(
    './providers/createBrowserDownloadService'
  )
  return createBrowserDownloadService()
}

export const useDownloadServiceStore = defineStore('downloadService', () => {
  const service = shallowRef<DownloadService | null>(null)

  const ready = createDownloadServiceProvider().then((provider) => {
    service.value = provider
  })

  return { service, ready }
})
