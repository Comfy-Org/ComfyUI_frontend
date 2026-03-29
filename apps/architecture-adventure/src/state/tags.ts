import type { RoomDefinition, SaveState } from '@/types'

function canEnterRoom(room: RoomDefinition, save: SaveState): boolean {
  return room.prerequisites.every((tag) =>
    save.currentRun.conceptTags.includes(tag)
  )
}

function grantTags(save: SaveState, tags: string[]): SaveState {
  const newTags = tags.filter((t) => !save.currentRun.conceptTags.includes(t))
  if (newTags.length === 0) return save

  return {
    ...save,
    currentRun: {
      ...save.currentRun,
      conceptTags: [...save.currentRun.conceptTags, ...newTags]
    }
  }
}

export { canEnterRoom, grantTags }
