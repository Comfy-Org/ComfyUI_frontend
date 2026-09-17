import type { WorkspaceRelease } from '@comfyorg/ingest-types'

/**
 * Which developer-platform Release this browser runs its Cloud jobs on, and
 * the list it may pick from (FE-2434). The pick itself is an HttpOnly cookie
 * ingest sets; the editor learns it from the listing and never reads it.
 */
export interface ReleaseListing {
  releases: WorkspaceRelease[]
  pickedReleaseId: string | null
  buildsVisible: boolean
}

export type ReleasePickState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  /** The account is outside the rollout, or the session cannot pick. */
  | { phase: 'hidden' }
  | { phase: 'unavailable'; message: string }
  | ({ phase: 'ready' } & ReleaseListing)
  /** A pick or a clear is in flight; on success the page reloads. */
  | ({ phase: 'switching'; target: string | null } & ReleaseListing)

export type ReleasePickEvent =
  | { type: 'loadStarted' }
  | ({ type: 'loaded' } & ReleaseListing)
  | { type: 'loadRefused' }
  | { type: 'loadFailed'; message: string }
  | { type: 'switchStarted'; target: string | null }
  | { type: 'switchFailed' }

export function reduceReleasePick(
  state: ReleasePickState,
  event: ReleasePickEvent
): ReleasePickState {
  switch (event.type) {
    case 'loadStarted':
      return state.phase === 'switching' ? state : { phase: 'loading' }
    case 'loaded':
      return {
        phase: 'ready',
        releases: event.releases,
        pickedReleaseId: event.pickedReleaseId,
        buildsVisible: event.buildsVisible
      }
    case 'loadRefused':
      return { phase: 'hidden' }
    case 'loadFailed':
      return { phase: 'unavailable', message: event.message }
    case 'switchStarted':
      if (state.phase !== 'ready') return state
      return {
        phase: 'switching',
        target: event.target,
        releases: state.releases,
        pickedReleaseId: state.pickedReleaseId,
        buildsVisible: state.buildsVisible
      }
    case 'switchFailed':
      if (state.phase !== 'switching') return state
      return {
        phase: 'ready',
        releases: state.releases,
        pickedReleaseId: state.pickedReleaseId,
        buildsVisible: state.buildsVisible
      }
  }
}
