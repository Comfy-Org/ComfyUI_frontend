// --- Enumerations ---

type Layer = 1 | 2 | 3

type ChallengeRating = 'good' | 'ok' | 'bad'

type GamePhase =
  | 'exploring'
  | 'challenge-available'
  | 'challenge-resolved'
  | 'ending'
  | 'prestige'

type RoomState = 'locked' | 'discovered' | 'challenge-available' | 'solved'

// --- Room & Challenge Data ---

interface RoomConnection {
  targetRoomId: string
  label: string
  hint: string
}

interface Artifact {
  name: string
  type: string
  icon: string
}

interface RoomDefinition {
  id: string
  title: string
  layer: string
  discoveryDescription: string
  solutionDescription: string
  prerequisites: string[]
  artifacts: Artifact[]
  connections: RoomConnection[]
  challengeId?: string
  imageUrl?: string
}

interface ChallengeChoice {
  key: string
  label: string
  hint: string
  icon: string
  rating: ChallengeRating
  feedback: string
  tagsGranted: string[]
  insightReward: number
}

interface ChallengeDefinition {
  id: string
  roomId: string
  title: string
  tier: number
  description: string
  recommended: string
  docLink?: { label: string; url: string }
  choices: ChallengeChoice[]
}

// --- Narrative ---

interface NarrativeSentence {
  challengeId: string
  good: string
  ok: string
  bad: string
}

interface NarrativeSection {
  id: string
  title: string
  challengeIds: string[]
  introByTone: { optimistic: string; mixed: string; pessimistic: string }
}

interface NarrativeBridge {
  fromSectionId: string
  toSectionId: string
  byTone: { optimistic: string; mixed: string; pessimistic: string }
}

// --- Save State ---

interface ChallengeResult {
  choiceKey: string
  rating: ChallengeRating
  tier: number
}

interface RunRecord {
  layer: Layer
  path: string[]
  challenges: Record<string, ChallengeResult>
  conceptTags: string[]
  insightEarned: number
  narrativeSummary: string
}

interface CurrentRun {
  layer: Layer
  path: string[]
  resolvedChallenges: Record<string, ChallengeResult>
  conceptTags: string[]
  insightEarned: number
  currentRoom: string
}

interface PersistentState {
  totalInsight: number
  currentLayer: Layer
  achievements: string[]
}

interface SaveState {
  version: number
  currentRun: CurrentRun
  history: RunRecord[]
  persistent: PersistentState
}

// --- Engine State ---

interface GameState {
  phase: GamePhase
  save: SaveState
}

export type {
  Artifact,
  ChallengeChoice,
  ChallengeDefinition,
  ChallengeRating,
  ChallengeResult,
  CurrentRun,
  GamePhase,
  GameState,
  Layer,
  NarrativeBridge,
  NarrativeSection,
  NarrativeSentence,
  PersistentState,
  RoomConnection,
  RoomDefinition,
  RoomState,
  RunRecord,
  SaveState
}
