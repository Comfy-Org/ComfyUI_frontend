import type { RoomDefinition, SaveState } from '@/types'
import { canEnterRoom } from '@/state/tags'

type NavigationResult =
  | { allowed: true }
  | { allowed: false; unmetTags: string[] }

function checkNavigation(
  room: RoomDefinition,
  save: SaveState
): NavigationResult {
  if (canEnterRoom(room, save)) {
    return { allowed: true }
  }
  const unmetTags = room.prerequisites.filter(
    (tag) => !save.currentRun.conceptTags.includes(tag)
  )
  return { allowed: false, unmetTags }
}

function isRoomDiscovered(roomId: string, save: SaveState): boolean {
  return save.currentRun.path.includes(roomId)
}

function isChallengeResolved(challengeId: string, save: SaveState): boolean {
  return challengeId in save.currentRun.resolvedChallenges
}

function countResolvedChallenges(save: SaveState): number {
  return Object.keys(save.currentRun.resolvedChallenges).length
}

export type { NavigationResult }
export {
  checkNavigation,
  countResolvedChallenges,
  isChallengeResolved,
  isRoomDiscovered
}
