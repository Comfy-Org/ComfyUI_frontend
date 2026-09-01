import { describe, expect, it } from 'vitest'

import type {
  MissingModelGroup,
  MissingModelViewModel
} from '@/platform/missingModel/types'
import {
  getDownloadableModels,
  toDownloadableModel
} from '@/platform/missingModel/missingModelViewUtils'

function makeViewModel(
  name: string,
  opts: {
    url?: string
    directory?: string
  } = {}
): MissingModelViewModel {
  return {
    name,
    representative: {
      name,
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      isAssetSupported: true,
      isMissing: true,
      url: opts.url,
      directory: opts.directory
    },
    referencingNodes: [{ nodeId: '1', widgetName: 'ckpt_name' }]
  }
}

function makeGroup(models: MissingModelViewModel[]): MissingModelGroup {
  return {
    directory: 'checkpoints',
    isAssetSupported: true,
    models
  }
}

describe('missingModelViewUtils', () => {
  describe('toDownloadableModel', () => {
    it('returns a download model for supported URLs and file types', () => {
      const model = makeViewModel('model.safetensors', {
        url: 'https://huggingface.co/comfy/test/resolve/main/model.safetensors',
        directory: 'checkpoints'
      })

      expect(toDownloadableModel(model)).toEqual({
        name: 'model.safetensors',
        url: 'https://huggingface.co/comfy/test/resolve/main/model.safetensors',
        directory: 'checkpoints'
      })
    })

    it('returns null when URL, directory, source, or suffix is not downloadable', () => {
      expect(
        toDownloadableModel(
          makeViewModel('model.safetensors', { directory: 'checkpoints' })
        )
      ).toBeNull()
      expect(
        toDownloadableModel(
          makeViewModel('model.safetensors', {
            url: 'https://huggingface.co/comfy/test/resolve/main/model.safetensors'
          })
        )
      ).toBeNull()
      expect(
        toDownloadableModel(
          makeViewModel('model.safetensors', {
            url: 'https://example.com/model.safetensors',
            directory: 'checkpoints'
          })
        )
      ).toBeNull()
      expect(
        toDownloadableModel(
          makeViewModel('model.gguf', {
            url: 'https://huggingface.co/comfy/test/resolve/main/model.gguf',
            directory: 'checkpoints'
          })
        )
      ).toBeNull()
    })
  })

  describe('getDownloadableModels', () => {
    it('flattens downloadable models across groups and drops non-downloadable entries', () => {
      const groups = [
        makeGroup([
          makeViewModel('downloadable.safetensors', {
            url: 'https://huggingface.co/comfy/test/resolve/main/downloadable.safetensors',
            directory: 'checkpoints'
          }),
          makeViewModel('local-only.safetensors', {
            directory: 'checkpoints'
          })
        ]),
        makeGroup([
          makeViewModel('other.ckpt', {
            url: 'https://civitai.com/api/download/models/123',
            directory: 'checkpoints'
          })
        ])
      ]

      expect(getDownloadableModels(groups)).toEqual([
        {
          name: 'downloadable.safetensors',
          url: 'https://huggingface.co/comfy/test/resolve/main/downloadable.safetensors',
          directory: 'checkpoints'
        },
        {
          name: 'other.ckpt',
          url: 'https://civitai.com/api/download/models/123',
          directory: 'checkpoints'
        }
      ])
    })
  })
})
