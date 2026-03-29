import type { SaveState } from '@/types'

function isRoomDiscovered(roomId: string, save: SaveState): boolean {
  return save.currentRun.path.includes(roomId)
}

function isChallengeResolved(challengeId: string, save: SaveState): boolean {
  return challengeId in save.currentRun.resolvedChallenges
}

function countResolvedChallenges(save: SaveState): number {
  return Object.keys(save.currentRun.resolvedChallenges).length
}

export { countResolvedChallenges, isChallengeResolved, isRoomDiscovered }
