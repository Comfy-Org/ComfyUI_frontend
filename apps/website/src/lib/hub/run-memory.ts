/**
 * Which job made what is on the page, remembered across a reload.
 *
 * Cloud keeps a finished job and its outputs; this page kept only the blobs it
 * had downloaded, so closing the tab threw away the result of something that
 * had already been paid for. Remembering the job's name is enough to ask Cloud
 * for it again — the result itself is never stored here.
 *
 * The name is kept per workflow and per whoever ran it, so a second account or
 * a second workspace on the same browser opens on its own runs and not on
 * somebody else's.
 */
const keyFor = (slug: string, owner: string) => `hub.lastRun.${owner}.${slug}`

/** A browser that refuses storage is a browser with no memory, not an error. */
function withStore<T>(act: (store: Storage) => T): T | undefined {
  try {
    return act(window.localStorage)
  } catch {
    return undefined
  }
}

export function rememberRun(slug: string, owner: string, jobId: string) {
  withStore((store) => store.setItem(keyFor(slug, owner), jobId))
}

export function recallRun(slug: string, owner: string) {
  return withStore((store) => store.getItem(keyFor(slug, owner))) ?? undefined
}

export function forgetRun(slug: string, owner: string) {
  withStore((store) => store.removeItem(keyFor(slug, owner)))
}
