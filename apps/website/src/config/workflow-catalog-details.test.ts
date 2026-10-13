import { describe, expect, it } from 'vitest'
import {
  validCloudShareURL,
  validDocumentationURL,
  validWorkflowDownloadURL
} from './workflow-catalog-details'

describe('workflow action URL boundaries', () => {
  it.each([
    ['https://cloud.comfy.org/?share=abcdef123456', true],
    ['https://testcloud.comfy.org/?share=abcdef123456', true],
    ['https://cloud.comfy.org/?share=abcdef123456&share=abcdef123456', false],
    ['https://cloud.comfy.org/?share=abcdef123456&api_key=secret', false],
    ['https://cloud.comfy.org.evil.test/?share=abcdef123456', false],
    [
      'https://cloud.comfy.org/?share=00000000-0000-4000-8000-000000000080',
      false
    ]
  ])(
    'requires an existing-shaped trusted Cloud share, not a catalog UID: %s',
    (value, accepted) => {
      expect(validCloudShareURL(value)).toBe(accepted)
    }
  )
  it.each([
    'javascript:alert(1)',
    'http://docs.comfy.org',
    'https://name:password@docs.comfy.org',
    '',
    ' https://docs.comfy.org'
  ])('rejects unsafe documentation URLs: %s', (value) => {
    expect(validDocumentationURL(value)).toBe(false)
  })
  it('permits exact protected downloads and retained trusted legacy files, not raw arbitrary origins', () => {
    expect(
      validWorkflowDownloadURL(
        '/preview-media/7/00000000-0000-4000-8000-000000000080/00000000-0000-4000-8000-000000000081'
      )
    ).toBe(true)
    expect(
      validWorkflowDownloadURL(
        'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates/file.json'
      )
    ).toBe(true)
    expect(
      validWorkflowDownloadURL('https://private-bucket.example/file.json')
    ).toBe(false)
    expect(validWorkflowDownloadURL('/preview-media/7/invalid/invalid')).toBe(
      false
    )
  })
})
