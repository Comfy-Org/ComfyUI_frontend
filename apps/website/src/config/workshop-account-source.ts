/**
 * Which identity the header shows, decided once per page load: the shared
 * web session, or the Firebase lifecycle it shows today. Flag off, the answer
 * is Firebase after the one probe GET, and the session code never loads.
 */
import { readUnifiedWebSessionEnabled } from './workshop-web-session'

export type WorkshopAccountSource = 'session' | 'firebase'

/** Past this, the Firebase header mounts for the page load and never swaps. */
export const ACCOUNT_SOURCE_CAP_MS = 800

function decideAccountSource(): Promise<WorkshopAccountSource> {
  return new Promise((resolve) => {
    let capped = false
    let stop: (() => void) | undefined
    const cap = setTimeout(() => {
      capped = true
      stop?.()
      resolve('firebase')
    }, ACCOUNT_SOURCE_CAP_MS)
    const decide = (source: WorkshopAccountSource) => {
      clearTimeout(cap)
      resolve(source)
    }
    void readUnifiedWebSessionEnabled()
      .then((enabled) => {
        if (capped) return undefined
        if (!enabled) {
          decide('firebase')
          return undefined
        }
        return import('./workshop-web-session-identity').then(
          ({ bootWorkshopWebSession }) => bootWorkshopWebSession
        )
      })
      .then((boot) => {
        if (!boot || capped) return
        stop = boot(decide)
      })
  })
}

let resolution: Promise<WorkshopAccountSource> | undefined

/** Settles once per page load, at the latest when the cap fires. */
export function resolveWorkshopAccountSource(): Promise<WorkshopAccountSource> {
  resolution ??= decideAccountSource()
  return resolution
}
