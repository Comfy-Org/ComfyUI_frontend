import { expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false,
  isNightly: true
}))

const errors = vi.hoisted(() => ({
  templates: new Error('Templates unavailable'),
  feedback: new Error('Feedback unavailable')
}))

vi.mock(import('./clipspace'), () => ({}))
vi.mock(import('./contextMenuFilter'), () => ({}))
vi.mock(import('./createBoundingBoxes'), () => ({}))
vi.mock(import('./customWidgets'), () => ({}))
vi.mock(import('./dynamicPrompts'), () => ({}))
vi.mock(import('./editAttention'), () => ({}))
vi.mock(import('./electronAdapter'), () => ({}))
vi.mock(import('./groupNode'), () => ({}))
vi.mock(import('./groupOptions'), () => ({}))
vi.mock(import('./imageCompare'), () => ({}))
vi.mock(import('./imageCompositor'), () => ({}))
vi.mock(import('./imageCrop'), () => ({}))
vi.mock(import('./layerEditor'), () => ({}))
vi.mock(import('./load3dLazy'), () => ({}))
vi.mock(import('./maskeditor'), () => ({}))
vi.mock(import('./noteNode'), () => ({}))
vi.mock(import('./painter'), () => ({}))
vi.mock(import('./previewAny'), () => ({}))
vi.mock(import('./saveText'), () => ({}))
vi.mock(import('./rerouteNode'), () => ({}))
vi.mock(import('./saveImageExtraOutput'), () => ({}))
vi.mock(import('./selectionBorder'), () => ({}))
vi.mock(import('./simpleTouchSupport'), () => ({}))
vi.mock(import('./slotDefaults'), () => ({}))
vi.mock(import('./uploadAudio'), () => ({}))
vi.mock(import('./uploadImage'), () => ({}))
vi.mock(import('./webcamCapture'), () => ({}))
vi.mock(import('./widgetInputs'), () => ({}))

vi.mock(import('./nodeTemplates'), () => {
  throw errors.templates
})
vi.mock(import('./cloudFeedbackTopbarButton'), () => {
  throw errors.feedback
})

await import('./index')
const reportedErrors = vi.mocked(reportError).mock.calls.slice()

it('completes core registration despite optional extension load failures', () => {
  expect(reportedErrors).toEqual([
    [
      expect.objectContaining({ cause: errors.templates }),
      { errorType: 'error_loading_optional_extension', surface: 'platform' }
    ],
    [
      expect.objectContaining({ cause: errors.feedback }),
      { errorType: 'error_loading_optional_extension', surface: 'platform' }
    ]
  ])
})
