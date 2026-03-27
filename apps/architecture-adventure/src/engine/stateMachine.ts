import type {
  ChallengeDefinition,
  ChallengeResult,
  GamePhase,
  GameState,
  SaveState
} from '@/types'
import { persistSave } from '@/state/gameState'
import { grantTags } from '@/state/tags'

type GameEventHandler = (state: GameState) => void

let currentState: GameState
let listeners: GameEventHandler[] = []

function initGameState(save: SaveState): void {
  currentState = {
    phase: 'exploring',
    save
  }
  notify()
}

function getGameState(): GameState {
  return currentState
}

function subscribe(handler: GameEventHandler): () => void {
  listeners.push(handler)
  return () => {
    listeners = listeners.filter((l) => l !== handler)
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener(currentState)
  }
}

function transition(phase: GamePhase, saveUpdates?: Partial<SaveState>): void {
  const newSave = saveUpdates
    ? { ...currentState.save, ...saveUpdates }
    : currentState.save

  currentState = { phase, save: newSave }
  persistSave(currentState.save)
  notify()
}

function enterRoom(roomId: string): void {
  const run = currentState.save.currentRun
  const newPath = run.path.includes(roomId) ? run.path : [...run.path, roomId]

  transition('exploring', {
    currentRun: {
      ...run,
      currentRoom: roomId,
      path: newPath
    }
  })
}

function resolveChallenge(
  challenge: ChallengeDefinition,
  choiceKey: string
): void {
  const choice = challenge.choices.find((c) => c.key === choiceKey)
  if (!choice) return

  const result: ChallengeResult = {
    choiceKey,
    rating: choice.rating,
    tier: challenge.tier
  }

  let save = {
    ...currentState.save,
    currentRun: {
      ...currentState.save.currentRun,
      resolvedChallenges: {
        ...currentState.save.currentRun.resolvedChallenges,
        [challenge.id]: result
      },
      insightEarned:
        currentState.save.currentRun.insightEarned + choice.insightReward
    }
  }

  save = grantTags(save, choice.tagsGranted)

  transition('challenge-resolved', save)
}

function showEnding(): void {
  transition('ending')
}

function resetForPrestige(newSave: SaveState): void {
  transition('exploring', newSave)
}

export {
  enterRoom,
  getGameState,
  initGameState,
  resetForPrestige,
  resolveChallenge,
  showEnding,
  subscribe,
  transition
}
