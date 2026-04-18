import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyExtension } from '@/types/comfy'

interface CapturedExtension {
  name: string
  beforeRegisterNodeDef?: ComfyExtension['beforeRegisterNodeDef']
}

const registerExtension = vi.fn<(ext: CapturedExtension) => void>()

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: (ext: CapturedExtension) => registerExtension(ext)
  }
}))

let uploadImageExtension: CapturedExtension | undefined

beforeAll(async () => {
  await import('./uploadImage')
  uploadImageExtension = registerExtension.mock.calls
    .map(([ext]) => ext)
    .find((ext) => ext.name === 'Comfy.UploadImage')
})

describe('Comfy.UploadImage extension', () => {
  it('attaches an IMAGEUPLOAD widget when the image input declares image_upload', () => {
    const nodeData = {
      name: 'LoadImage',
      input: {
        required: {
          image: ['COMBO', { image_upload: true }]
        }
      }
    }

    uploadImageExtension!.beforeRegisterNodeDef!(
      undefined as unknown as typeof LGraphNode,
      nodeData as never,
      undefined as never
    )

    const upload = (nodeData.input.required as Record<string, unknown>).upload
    expect(upload).toBeDefined()
    expect((upload as [string, { imageInputName: string }])[0]).toBe(
      'IMAGEUPLOAD'
    )
    expect(
      (upload as [string, { imageInputName: string }])[1].imageInputName
    ).toBe('image')
  })

  it('attaches an IMAGEUPLOAD widget for LoadImage even when the backend omits image_upload', () => {
    // Reproduces the cloud bug: the cloud backend serves LoadImage without
    // image_upload: true on the image input, so Comfy.UploadImage skips
    // attaching the IMAGEUPLOAD widget. That cascade leaves node.pasteFiles
    // unset, which hides the right-click "Paste Image" menu item on cloud.
    const nodeData = {
      name: 'LoadImage',
      input: {
        required: {
          image: ['COMBO', {}]
        }
      }
    }

    uploadImageExtension!.beforeRegisterNodeDef!(
      undefined as unknown as typeof LGraphNode,
      nodeData as never,
      undefined as never
    )

    const upload = (nodeData.input.required as Record<string, unknown>).upload
    expect(upload).toBeDefined()
    expect((upload as [string, { imageInputName: string }])[0]).toBe(
      'IMAGEUPLOAD'
    )
    expect(
      (upload as [string, { imageInputName: string }])[1].imageInputName
    ).toBe('image')
  })
})
