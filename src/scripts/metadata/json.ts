import { isObject } from 'es-toolkit/compat'

import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

export function getDataFromJSON(
  file: File
): Promise<Record<string, object> | undefined> {
  return new Promise<Record<string, object> | undefined>((resolve) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        if (typeof reader.result !== 'string') {
          resolve(undefined)
          return
        }
        const jsonContent = parseJsonWithNonFinite<Record<string, unknown>>(
          reader.result
        )
        if (jsonContent?.templates) {
          resolve({ templates: jsonContent.templates as object })
          return
        }
        if (isApiJson(jsonContent)) {
          resolve({ prompt: jsonContent })
          return
        }
        resolve({ workflow: jsonContent })
      } catch {
        resolve(undefined)
      }
    }
    reader.onerror = () => resolve(undefined)
    reader.onabort = () => resolve(undefined)
    reader.readAsText(file)
  })
}

function isApiJson(data: unknown) {
  return isObject(data) && Object.values(data).every((v) => v.class_type)
}
