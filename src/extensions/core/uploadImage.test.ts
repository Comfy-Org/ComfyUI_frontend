import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'

interface CapturedExtension {
  name: string
  beforeRegisterNodeDef?: ComfyExtension['beforeRegisterNodeDef']
}

const registerExtension = vi.hoisted(() =>
  vi.fn<(ext: CapturedExtension) => void>()
)

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: (ext: CapturedExtension) => registerExtension(ext)
  }
}))

// Static import — vi.mock hoisting ensures the mock is ready before the
// module's top-level app.registerExtension() call executes.
import './uploadImage'

function getExtension(): CapturedExtension {
  const ext = registerExtension.mock.calls
    .map(([e]) => e)
    .find((e) => e.name === 'Comfy.UploadImage')
  if (!ext) throw new Error('Comfy.UploadImage not registered')
  return ext
}

function callBeforeRegister(nodeData: {
  name: string
  input: { required: Record<string, unknown> }
}) {
  getExtension().beforeRegisterNodeDef!(
    undefined as unknown as typeof LGraphNode,
    nodeData as ComfyNodeDef,
    undefined as never
  )
}

function getUpload(
  required: Record<string, unknown>
): [string, Record<string, unknown>] | undefined {
  return required.upload as [string, Record<string, unknown>] | undefined
}

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

    callBeforeRegister(nodeData)

    const upload = getUpload(nodeData.input.required as Record<string, unknown>)
    expect(upload).toBeDefined()
    expect(upload![0]).toBe('IMAGEUPLOAD')
    expect(upload![1].imageInputName).toBe('image')
  })

  it('attaches an IMAGEUPLOAD widget for LoadImage even when the backend omits image_upload', () => {
    const nodeData = {
      name: 'LoadImage',
      input: {
        required: {
          image: ['COMBO', {}]
        }
      }
    }

    callBeforeRegister(nodeData)

    const upload = getUpload(nodeData.input.required as Record<string, unknown>)
    expect(upload).toBeDefined()
    expect(upload![0]).toBe('IMAGEUPLOAD')
    expect(upload![1].imageInputName).toBe('image')
    expect(upload![1].image_upload).toBe(true)
  })

  it('attaches an IMAGEUPLOAD widget for LoadVideo with video_upload synthesized', () => {
    const nodeData = {
      name: 'LoadVideo',
      input: {
        required: {
          file: ['COMBO', {}]
        }
      }
    }

    callBeforeRegister(nodeData)

    const upload = getUpload(nodeData.input.required as Record<string, unknown>)
    expect(upload).toBeDefined()
    expect(upload![0]).toBe('IMAGEUPLOAD')
    expect(upload![1].imageInputName).toBe('file')
    expect(upload![1].video_upload).toBe(true)
  })

  it('does not attach an upload widget for unknown node types', () => {
    const nodeData = {
      name: 'UnknownNode',
      input: {
        required: {
          image: ['COMBO', {}]
        }
      }
    }

    callBeforeRegister(nodeData)

    expect(
      getUpload(nodeData.input.required as Record<string, unknown>)
    ).toBeUndefined()
  })

  it('does not touch LoadAudio — audio is handled by Comfy.UploadAudio', () => {
    const nodeData = {
      name: 'LoadAudio',
      input: {
        required: {
          audio: ['COMBO', {}]
        }
      }
    }

    callBeforeRegister(nodeData)

    expect(
      getUpload(nodeData.input.required as Record<string, unknown>)
    ).toBeUndefined()
  })

  it('never overwrites an upload widget another extension already attached', () => {
    const existingUpload = ['AUDIOUPLOAD', {}]
    const nodeData = {
      name: 'LoadAudio',
      input: {
        required: {
          audio: ['COMBO', {}],
          upload: existingUpload
        }
      }
    }

    callBeforeRegister(nodeData)

    expect((nodeData.input.required as Record<string, unknown>).upload).toBe(
      existingUpload
    )
  })
})
