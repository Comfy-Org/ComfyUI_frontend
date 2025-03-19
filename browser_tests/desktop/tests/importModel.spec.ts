import { expect, mergeTests } from '@playwright/test'

import { ComfyPage, comfyPageFixture } from '../../fixtures/ComfyPage'
import { MockElectronAPI, electronFixture } from '../fixtures/electron'

const test = mergeTests(comfyPageFixture, electronFixture)

comfyPageFixture.describe('Import Model (web)', () => {
  comfyPageFixture(
    'Import dialog does not show when electron api is not available',
    async ({ comfyPage }) => {
      await comfyPage.dragAndDropFile('test.bin', { buffer: Buffer.from('') })

      // Normal unable to find workflow in file error
      await expect(
        comfyPage.page.locator('.unhandled-file-dialog')
      ).toBeVisible()
    }
  )
})

test.describe('Import Model (electron)', () => {
  const dropFile = async (
    comfyPage: ComfyPage,
    electronAPI: MockElectronAPI,
    fileName: string,
    metadata: string
  ) => {
    const getFilePathMock = electronAPI.setup('getFilePath', () =>
      Promise.resolve('some/file/path/' + fileName)
    )

    let buffer: Buffer | undefined
    if (metadata) {
      const contentBuffer = Buffer.from(metadata, 'utf-8')

      const headerSizeBuffer = Buffer.alloc(8)
      headerSizeBuffer.writeBigUInt64LE(BigInt(contentBuffer.length))

      buffer = Buffer.concat([headerSizeBuffer, contentBuffer])
    }

    await comfyPage.dragAndDropFile('importModel/' + fileName, {
      buffer
    })
    await getFilePathMock.called()

    await expect(comfyPage.page.locator('.unhandled-file-dialog')).toBeHidden()
    await expect(comfyPage.importModelDialog.rootEl).toBeVisible()
  }

  test('Can show import file dialog by dropping file onto the app', async ({
    comfyPage,
    electronAPI
  }) => {
    await dropFile(comfyPage, electronAPI, 'test.bin', '{}')
  })

  test('Can autodetect checkpoint model type from modelspec', async ({
    comfyPage,
    electronAPI
  }) => {
    await dropFile(
      comfyPage,
      electronAPI,
      'file.safetensors',
      JSON.stringify({
        __metadata__: {
          'modelspec.sai_model_spec': 'test',
          'modelspec.architecture': 'stable-diffusion-v1'
        }
      })
    )

    await expect(comfyPage.importModelDialog.modelTypeInput).toHaveValue(
      'checkpoints'
    )
  })

  test('Can autodetect lora model type from modelspec', async ({
    comfyPage,
    electronAPI
  }) => {
    await dropFile(
      comfyPage,
      electronAPI,
      'file.safetensors',
      JSON.stringify({
        __metadata__: {
          'modelspec.sai_model_spec': 'test',
          'modelspec.architecture': 'Flux.1-AE/lora'
        }
      })
    )

    await expect(comfyPage.importModelDialog.modelTypeInput).toHaveValue(
      'loras'
    )
  })

  test('Can autodetect checkpoint model type from header keys', async ({
    comfyPage,
    electronAPI
  }) => {
    await dropFile(
      comfyPage,
      electronAPI,
      'file.safetensors',
      JSON.stringify({
        'model.diffusion_model.input_blocks.0.0.bias': {}
      })
    )

    await expect(comfyPage.importModelDialog.modelTypeInput).toHaveValue(
      'checkpoints'
    )
  })

  test('Can autodetect lora model type from header keys', async ({
    comfyPage,
    electronAPI
  }) => {
    await dropFile(
      comfyPage,
      electronAPI,
      'file.safetensors',
      JSON.stringify({
        'lora_unet_down_blocks_0_attentions_0_proj_in.alpha': {}
      })
    )

    await expect(comfyPage.importModelDialog.modelTypeInput).toHaveValue(
      'loras'
    )
  })

  test('Can import file', async ({ comfyPage, electronAPI }) => {
    await dropFile(
      comfyPage,
      electronAPI,
      'checkpoint_modelspec.safetensors',
      '{}'
    )

    const importModelMock = electronAPI.setup(
      'importModel',
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )

    // Model type is required so select one
    await expect(comfyPage.importModelDialog.importButton).toBeDisabled()
    await comfyPage.importModelDialog.modelTypeInput.fill('checkpoints')
    await expect(comfyPage.importModelDialog.importButton).toBeEnabled()

    // Click import, ensure API is called
    await comfyPage.importModelDialog.importButton.click()
    await importModelMock.called()

    // Toast should be shown and dialog closes
    await expect(
      comfyPage.page.locator('.p-toast-message.p-toast-message-success')
    ).toBeVisible()
    await expect(comfyPage.importModelDialog.rootEl).toBeHidden()
  })
})
