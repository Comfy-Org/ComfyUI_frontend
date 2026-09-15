/** One file's before and after, enough to publish it or put it back. */
export interface FileWrite {
  file: string
  /**
   * Absent when the file did not exist, so rolling it back means removing it.
   * Writing an empty original instead would leave a published story with no
   * content, which the site would happily render.
   */
  original?: string
  written: string
}

/**
 * Publish a planned set of files, restoring the ones already written if any
 * fails.
 *
 * The writers plan and verify everything before touching disk, which makes a
 * rejected plan all-or-nothing. Writing was not: a failure on the tenth of
 * eighteen files left nine changed and the run reporting an error, which is the
 * state a person is least able to act on — half a translation run, with no
 * record of which half. The planner already holds each file's original content,
 * so putting it back costs nothing.
 *
 * What this does not survive is the process dying outright, mid-loop. A real
 * guarantee against that needs a journal on disk, which is a great deal of
 * machinery for a script a person runs and can re-run — so each writer's header
 * says that plainly rather than claiming an atomicity it does not have.
 */
export function commitAll(
  entries: readonly FileWrite[],
  io: {
    write: (file: string, contents: string) => void
    // Required, not optional. An optional remove would silently skip rolling
    // back a created file whenever a caller left it out — the rollback would
    // report success and leave the file on disk.
    remove: (file: string) => void
  }
): void {
  const written: FileWrite[] = []
  try {
    for (const entry of entries) {
      io.write(entry.file, entry.written)
      written.push(entry)
    }
  } catch (error) {
    const stuck: string[] = []
    // Newest first, undoing in the reverse order things were done. Copied
    // rather than reversed in place, so the record of what was written is not
    // rearranged as a side effect of undoing it.
    const undo = [...written].reverse()
    // Every file is attempted even after one restore fails, so a single
    // unwritable path does not strand the rest of the run's changes on disk.
    for (const entry of undo) {
      try {
        if (entry.original === undefined) io.remove(entry.file)
        else io.write(entry.file, entry.original)
      } catch {
        stuck.push(entry.file)
      }
    }
    if (stuck.length > 0) {
      throw new Error(
        `${String(error)}\ncould not restore: ${stuck.join(', ')}. ` +
          `Those files hold new content; the rest were put back.`,
        { cause: error }
      )
    }
    throw error
  }
}
