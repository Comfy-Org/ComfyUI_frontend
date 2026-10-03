import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { assetService } from '@/platform/assets/services/assetService'
import { api } from '@/scripts/api'
import { useAssetExportStore } from '@/stores/assetExportStore'

vi.mock(import('@/platform/assets/services/assetService'))

describe('assetExportStore triggerDownload', () => {
  it.for([
    {
      name: 'a server-relative URL under the API base',
      url: '/api/view?filename=e.zip&type=temp&subfolder=exports',
      expected:
        'http://localhost:3000/comfy/api/view?filename=e.zip&type=temp&subfolder=exports'
    },
    {
      name: 'an absolute signed URL unchanged',
      url: 'https://storage.example.com/exports/e.zip?signature=abc',
      expected: 'https://storage.example.com/exports/e.zip?signature=abc'
    }
  ])('downloads $name', async ({ url, expected }) => {
    const originalBase = api.api_base
    api.api_base = '/comfy'
    onTestFinished(() => {
      api.api_base = originalBase
    })
    vi.mocked(assetService.getExportDownloadUrl).mockResolvedValue({ url })
    const clickedHrefs: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        clickedHrefs.push(this.href)
      }
    )
    const store = useAssetExportStore()
    store.trackExport('task-1')
    const [exportJob] = store.exportList
    exportJob.exportName = 'e.zip'

    await store.triggerDownload(exportJob)

    expect(clickedHrefs).toEqual([expected])
  })
})
