import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  mockFileReaderAbort,
  mockFileReaderError,
  mockFileReaderResult
} from './__fixtures__/helpers'
import { getDataFromJSON } from './json'

function jsonFile(content: object): File {
  return new File([JSON.stringify(content)], 'test.json', {
    type: 'application/json'
  })
}

describe('getDataFromJSON', () => {
  it('detects API-format workflows by class_type on every value', async () => {
    const apiData = {
      '1': { class_type: 'KSampler', inputs: {} },
      '2': { class_type: 'EmptyLatentImage', inputs: {} }
    }

    const result = await getDataFromJSON(jsonFile(apiData))

    expect(result).toEqual({ prompt: apiData })
  })

  it('treats objects without universal class_type as a workflow', async () => {
    const workflow = { nodes: [], links: [], version: 1 }

    const result = await getDataFromJSON(jsonFile(workflow))

    expect(result).toEqual({ workflow })
  })

  it('extracts templates when the root object has a templates key', async () => {
    const templates = [{ name: 'basic' }]

    const result = await getDataFromJSON(jsonFile({ templates }))

    expect(result).toEqual({ templates })
  })

  it('returns undefined for non-JSON content', async () => {
    const file = new File(['not valid json'], 'bad.json', {
      type: 'application/json'
    })

    const result = await getDataFromJSON(file)

    expect(result).toBeUndefined()
  })

  describe('FileReader failure modes', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('resolves undefined when the FileReader fires error', async () => {
      mockFileReaderError('readAsText')

      const result = await getDataFromJSON(jsonFile({ nodes: [] }))

      expect(result).toBeUndefined()
    })

    it('resolves undefined when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsText')

      const result = await getDataFromJSON(jsonFile({ nodes: [] }))

      expect(result).toBeUndefined()
    })

    it('resolves undefined when reader.result is not a string', async () => {
      mockFileReaderResult('readAsText', new ArrayBuffer(8))

      const result = await getDataFromJSON(jsonFile({ nodes: [] }))

      expect(result).toBeUndefined()
    })

    it('resolves undefined when reader.result is null', async () => {
      mockFileReaderResult('readAsText', null)

      const result = await getDataFromJSON(jsonFile({ nodes: [] }))

      expect(result).toBeUndefined()
    })
  })
})
