import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { api } from '@/scripts/api'

import type { StorageHandle, StoredText } from '@/platform/nodeApi/v4/types'
import { textFieldOfEach } from './jsonValues'
import { isText } from './packArguments'

const NOT_READ: StoredText = Object.freeze({ ok: false })

export function createStorageHandle(): StorageHandle {
  const storage: StorageHandle = {
    get(name) {
      return readText(storageName('storage.get', name))
    },

    set(name, text) {
      const path = storageName('storage.set', name)
      if (!isText(text)) throw invalidArgument('storage.set', 'text', text)
      return storeText(path, text)
    },

    remove(name) {
      return removeText(storageName('storage.remove', name))
    },

    list(folder) {
      return listNames(storageName('storage.list', folder))
    }
  }
  return Object.freeze(storage)
}

function storageName(member: string, name: unknown): string {
  if (!isStoragePath(name)) {
    throw invalidArgument(
      member,
      'a relative path such as MyPack/data.json',
      name
    )
  }
  return name
}

function isStoragePath(name: unknown): name is string {
  return (
    isText(name) &&
    !/[\\\0]/.test(name) &&
    name
      .split('/')
      .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  )
}

async function readText(name: string): Promise<StoredText> {
  try {
    const response = await api.getUserData(name)
    if (response.status === 404)
      return Object.freeze({ ok: true, text: undefined })
    if (!response.ok) return NOT_READ
    return Object.freeze({ ok: true, text: await response.text() })
  } catch {
    return NOT_READ
  }
}

async function storeText(name: string, text: string): Promise<boolean> {
  try {
    const response = await api.storeUserData(name, text, {
      overwrite: true,
      stringify: false,
      throwOnError: false
    })
    return response.ok
  } catch {
    return false
  }
}

async function removeText(name: string): Promise<boolean> {
  try {
    const response = await api.deleteUserData(name)
    return response.ok || response.status === 404
  } catch {
    return false
  }
}

async function listNames(
  folder: string
): Promise<readonly string[] | undefined> {
  let entries: unknown
  try {
    entries = await api.listUserDataFullInfo(folder)
  } catch {
    return undefined
  }
  const paths = textFieldOfEach(entries, 'path')
  return paths && Object.freeze(paths.map((path) => `${folder}/${path}`))
}
