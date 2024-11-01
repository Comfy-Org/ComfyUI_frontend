import { api } from '@/scripts/api'

export async function syncEntities<T>(
  dir: string,
  entityByPath: Record<string, T>,
  createEntity: (file: any) => T,
  updateEntity: (entity: T, file: any) => void
) {
  const files = (await api.listUserDataFullInfo(dir)).map((file) => ({
    ...file,
    path: dir ? `${dir}/${file.path}` : file.path
  }))

  for (const file of files) {
    const existingEntity = entityByPath[file.path]

    if (!existingEntity) {
      // New entity, add it to the map
      entityByPath[file.path] = createEntity(file)
    } else {
      // Entity has been modified, update its properties
      updateEntity(existingEntity, file)
    }
  }

  // Remove entities that no longer exist
  for (const path in entityByPath) {
    if (!files.some((file) => file.path === path)) {
      delete entityByPath[path]
    }
  }
}
