import { isObject } from 'es-toolkit/compat'

export function getDataFromJSON(file: File): Promise<Record<string, object>> {
  return new Promise<Record<string, object>>((resolve, reject) => {
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
