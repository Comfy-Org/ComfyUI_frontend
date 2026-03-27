import type { RoomDefinition, SaveState } from '@/types'

function hasAllPrerequisites(
  room: RoomDefinition,
  earnedTags: string[]
): boolean {
  return room.prerequisites.every((tag) => earnedTags.includes(tag))
}

function getUnmetPrerequisites(
  room: RoomDefinition,
  earnedTags: string[]
): string[] {
  return room.prerequisites.filter((tag) => !earnedTags.includes(tag))
}

function canEnterRoom(room: RoomDefinition, save: SaveState): boolean {
  return hasAllPrerequisites(room, save.currentRun.conceptTags)
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

export { canEnterRoom, getUnmetPrerequisites, grantTags, hasAllPrerequisites }
