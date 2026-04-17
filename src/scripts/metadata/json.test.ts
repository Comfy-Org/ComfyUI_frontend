import { afterEach, describe, expect, it, vi } from 'vitest'

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
      vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(
        function (this: FileReader) {
          queueMicrotask(() =>
            this.onerror?.(
              new ProgressEvent('error') as ProgressEvent<FileReader>
            )
          )
        }
      )

      const result = await getDataFromJSON(jsonFile({ nodes: [] }))

      expect(result).toBeUndefined()
    })

    it('resolves undefined when the FileReader fires abort', async () => {
      vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(
        function (this: FileReader) {
          queueMicrotask(() =>
            this.onabort?.(
              new ProgressEvent('abort') as ProgressEvent<FileReader>
            )
          )
        }
      )

      const result = await getDataFromJSON(jsonFile({ nodes: [] }))

      expect(result).toBeUndefined()
    })
  })
})
