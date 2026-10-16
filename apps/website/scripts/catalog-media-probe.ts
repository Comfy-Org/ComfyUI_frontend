import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
export async function probeFile(path: string) {
  const { stdout } = await run(
    '/opt/homebrew/bin/ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=format_name,duration:stream=codec_type,codec_name,width,height',
      '-of',
      'json',
      path
    ],
    { timeout: 10000, maxBuffer: 65536 }
  )
  return { stdout }
}
