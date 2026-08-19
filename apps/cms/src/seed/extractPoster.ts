import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Extract the first frame of a video as a JPEG poster still. Idempotent: skips
// when the poster already exists in the cache. Requires ffmpeg on PATH — a
// dev-only seed dependency (see ticket 01); this is not the CMS upload pipeline.
export const extractPoster = async (videoPath: string, posterPath: string): Promise<void> => {
  if (existsSync(posterPath)) return

  await execFileAsync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    posterPath,
  ])
}
