import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { ModelsHandle } from '@/platform/nodeApi/v4/types'
import { api } from '@/scripts/api'

import { textFieldOfEach } from './jsonValues'

export function createModelsHandle(): ModelsHandle {
  const models: ModelsHandle = {
    list(folder) {
      if (typeof folder !== 'string' || !/^(?!\.{1,2}$)[\w.-]+$/.test(folder)) {
        throw invalidArgument('models.list', 'a model folder name', folder)
      }
      return listModelNames(folder)
    }
  }
  return Object.freeze(models)
}

async function listModelNames(
  folder: string
): Promise<readonly string[] | undefined> {
  let files: unknown
  try {
    files = await api.getModels(folder)
  } catch {
    return undefined
  }
  const names = textFieldOfEach(files, 'name')
  return names && Object.freeze([...new Set(names)])
}
