import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { i18n } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { assetService } from '@/platform/assets/services/assetService'
import type { ResultItem } from '@/platform/remote/comfyui/execution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetExportStore } from '@/stores/assetExportStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { useNodeOutputsExport } from './useNodeOutputsExport'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/assets/services/assetService'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadFile: vi.fn(),
  downloadFileAsBlob: vi.fn()
}))

function mountComposable(): ReturnType<typeof useNodeOutputsExport> {
  let composable!: ReturnType<typeof useNodeOutputsExport>
  render(
    {
      setup() {
        composable = useNodeOutputsExport()
        return () => h(GlobalDialog)
      }
    },
    { global: { plugins: [i18n] } }
  )
  return composable
}

async function openExportDialog(node: LGraphNode) {
  const { showOutputsExportDialog } = mountComposable()
  showOutputsExportDialog(node)
  const dialog = await screen.findByRole('dialog', { name: 'Export Assets' })
  return { dialog, user: userEvent.setup() }
}

async function exportFromDialog(node: LGraphNode, deselect: string[] = []) {
  const { dialog, user } = await openExportDialog(node)
  for (const name of deselect)
    await user.click(within(dialog).getByRole('checkbox', { name }))
  await user.click(within(dialog).getByRole('button', { name: /^Export/ }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
}

function nodeWithOutputs(images: ResultItem[]): LGraphNode {
  const node = createMockLGraphNode({ id: 7 })
  vi.spyOn(useNodeOutputStore(), 'getNodeOutputs').mockReturnValue({ images })
  return node
}

describe('useNodeOutputsExport', () => {
  it.for([
    { name: 'no outputs', images: [], expected: false },
    { name: 'one output', images: [{ filename: 'a.png' }], expected: false },
    {
      name: 'outputs without filenames',
      images: [{ filename: 'a.png' }, { subfolder: 'x' }],
      expected: false
    },
    {
      name: 'two outputs',
      images: [{ filename: 'a.png' }, { filename: 'b.png' }],
      expected: true
    }
  ])(
    'offers exporting outputs with $name: $expected',
    ({ images, expected }) => {
      const node = nodeWithOutputs(images)
      const { hasMultipleOutputs } = mountComposable()

      expect(hasMultipleOutputs(node)).toBe(expected)
    }
  )

  it('lists the saved outputs of the node in the export dialog', async () => {
    const node = nodeWithOutputs([
      { filename: 'a.png', subfolder: 'shots', type: 'output' },
      { subfolder: 'unsaved' },
      { filename: 'b.png', subfolder: '', type: 'temp' }
    ])

    const { dialog } = await openExportDialog(node)

    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(3)
    expect(
      within(dialog).getByRole('checkbox', { name: 'a.png' })
    ).toBeVisible()
    expect(
      within(dialog).getByRole('checkbox', { name: 'b.png' })
    ).toBeVisible()
  })

  it('exports the outputs left selected as one zip', async () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    vi.mocked(assetService.createAssetExport).mockResolvedValue({
      task_id: 'task-1',
      status: 'created'
    })
    const node = nodeWithOutputs([
      { filename: 'f1.exr', subfolder: 'EXR', type: 'output', id: 'asset-1' },
      { filename: 'f2.exr', subfolder: 'EXR', type: 'output', id: 'asset-2' },
      { filename: 'f3.exr', subfolder: 'EXR', type: 'output', id: 'asset-3' }
    ])

    await exportFromDialog(node, ['f2.exr'])

    await vi.waitFor(() => {
      expect(useToastStore().messagesToAdd).toEqual([
        expect.objectContaining({
          severity: 'info',
          summary: 'Preparing ZIP download...',
          detail: 'Preparing ZIP export for 2 files'
        })
      ])
    })
    expect(assetService.createAssetExport).toHaveBeenCalledWith({
      asset_ids: ['asset-1', 'asset-3'],
      naming_strategy: 'preserve'
    })
    expect(useAssetExportStore().exportList.map((e) => e.taskId)).toEqual([
      'task-1'
    ])
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('downloads a single selected output directly', async () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    const node = nodeWithOutputs([
      { filename: 'a.png', subfolder: 'shots', type: 'output', id: 'asset-a' },
      { filename: 'b.png', subfolder: 'shots', type: 'output', id: 'asset-b' }
    ])

    await exportFromDialog(node, ['a.png'])

    await vi.waitFor(() => {
      expect(vi.mocked(downloadFile).mock.calls).toEqual([
        ['/api/view?filename=b.png&subfolder=shots&type=output', 'b.png']
      ])
    })
    expect(assetService.createAssetExport).not.toHaveBeenCalled()
  })

  it('closes the dialog without downloading on cancel', async () => {
    const node = nodeWithOutputs([{ filename: 'a.png' }, { filename: 'b.png' }])
    const { dialog, user } = await openExportDialog(node)

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(downloadFile).not.toHaveBeenCalled()
    expect(assetService.createAssetExport).not.toHaveBeenCalled()
  })

  const separateDownloadCases: {
    name: string
    assetsEnabled: boolean
    secondAssetId?: string
  }[] = [
    {
      name: 'the assets system is disabled',
      assetsEnabled: false,
      secondAssetId: 'asset-b'
    },
    { name: 'an output has no asset id', assetsEnabled: true }
  ]

  it.for(separateDownloadCases)(
    'downloads each output separately when $name',
    async ({ assetsEnabled, secondAssetId }) => {
      vi.mocked(useFeatureFlags().flags).assetsEnabled = assetsEnabled
      const node = nodeWithOutputs([
        {
          filename: 'a.png',
          subfolder: 'shots',
          type: 'output',
          id: 'asset-a'
        },
        { filename: 'b.png', subfolder: '', type: 'temp', id: secondAssetId }
      ])

      await exportFromDialog(node)

      await vi.waitFor(() => {
        expect(vi.mocked(downloadFile).mock.calls).toEqual([
          ['/api/view?filename=a.png&subfolder=shots&type=output', 'a.png'],
          ['/api/view?filename=b.png&subfolder=&type=temp', 'b.png']
        ])
      })
      expect(assetService.createAssetExport).not.toHaveBeenCalled()
    }
  )

  it('reports a failed export request and tells the user', async () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    const failure = new Error('Failed to create asset export: 500')
    vi.mocked(assetService.createAssetExport).mockRejectedValue(failure)
    const node = nodeWithOutputs([
      { filename: 'a.png', id: 'asset-a' },
      { filename: 'b.png', id: 'asset-b' }
    ])

    await exportFromDialog(node)

    await vi.waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(failure, {
        errorType: 'error_exporting_assets',
        context: { count: 2 }
      })
    })
    expect(useToastStore().messagesToAdd).toEqual([
      expect.objectContaining({
        severity: 'error',
        detail: 'Failed to create ZIP export'
      })
    ])
    expect(useAssetExportStore().exportList).toEqual([])
  })
})
