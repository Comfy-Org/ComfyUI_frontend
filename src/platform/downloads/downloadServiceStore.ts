import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { DownloadService } from './types'

let _service: DownloadService | null = null
let _initPromise: Promise<DownloadService> | null = null

async function createDownloadServiceProvider(): Promise<DownloadService> {
  if (__DISTRIBUTION__ === 'desktop') {
    const { createElectronDownloadService } =
      await import('./providers/createElectronDownloadService')
    const electronService = createElectronDownloadService()
    await electronService.initialize()
    return electronService
  }

  if (__DISTRIBUTION__ === 'cloud') {
    const { createCloudDownloadService } =
      await import('./providers/createCloudDownloadService')
    return createCloudDownloadService()
  }

  const { createBrowserDownloadService } =
    await import('./providers/createBrowserDownloadService')
  return createBrowserDownloadService()
}

export const useDownloadServiceStore = defineStore('downloadService', () => {
  const service = shallowRef<DownloadService | null>(null)

  async function initialize() {
    if (_service) {
      service.value = _service
      return
    }
    if (!_initPromise) {
      _initPromise = createDownloadServiceProvider()
    }
    try {
      _service = await _initPromise
      service.value = _service
    } catch (error) {
      _initPromise = null
      throw error
    }
  }

  return { service, initialize }
})
