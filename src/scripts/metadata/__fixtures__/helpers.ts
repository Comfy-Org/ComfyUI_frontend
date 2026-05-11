import { vi } from 'vitest'

export const EXPECTED_WORKFLOW = {
  nodes: [{ id: 1, type: 'KSampler', pos: [100, 100], size: [200, 200] }]
}

export const EXPECTED_PROMPT = {
  '1': { class_type: 'KSampler', inputs: {} }
}

type ReadMethod = 'readAsText' | 'readAsArrayBuffer'

export function mockFileReaderError(method: ReadMethod): void {
  vi.spyOn(FileReader.prototype, method).mockImplementation(
    function (this: FileReader) {
      queueMicrotask(() =>
        this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
      )
    }
  )
}

export function mockFileReaderAbort(method: ReadMethod): void {
  vi.spyOn(FileReader.prototype, method).mockImplementation(
    function (this: FileReader) {
      queueMicrotask(() =>
        this.onabort?.(new ProgressEvent('abort') as ProgressEvent<FileReader>)
      )
    }
  )
}

export function mockFileReaderResult(
  method: ReadMethod,
  result: string | ArrayBuffer | null
): void {
  vi.spyOn(FileReader.prototype, method).mockImplementation(
    function (this: FileReader) {
      Object.defineProperty(this, 'result', {
        value: result,
        configurable: true
      })
      queueMicrotask(() =>
        this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>)
      )
    }
  )
}
