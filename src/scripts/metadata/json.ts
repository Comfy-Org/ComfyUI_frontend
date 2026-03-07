import { isObject } from 'es-toolkit/compat'

type JsonFileData =
  | { templates: object }
  | { prompt: Record<string, object> }
  | { workflow: object }

export function getDataFromJSON(file: File): Promise<JsonFileData> {
  return new Promise<JsonFileData>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const jsonContent = JSON.parse(reader.result as string)
        if (jsonContent?.templates) {
          resolve({ templates: jsonContent.templates })
        } else if (isApiJson(jsonContent)) {
          resolve({ prompt: jsonContent })
        } else {
          resolve({ workflow: jsonContent })
        }
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

function isApiJson(data: unknown) {
  return isObject(data) && Object.values(data).every((v) => v.class_type)
}
