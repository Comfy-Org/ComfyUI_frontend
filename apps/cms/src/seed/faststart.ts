import { execFile } from 'node:child_process'
import { open, rename } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Walk an MP4/MOV's top-level atoms in order and report whether `moov` precedes
// `mdat` — the definition of a faststart file, where a player can start before
// downloading the whole thing. Only atom headers are read (8–16 bytes each),
// never the multi-megabyte `mdat` payload. A file with no ISO box structure
// (e.g. an image) never hits `mdat`, so it reports faststart: the check guards
// only the container it applies to.
const moovBeforeMdat = async (filePath: string): Promise<boolean> => {
  const handle = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(16)
    let offset = 0
    for (;;) {
      const { bytesRead } = await handle.read(header, 0, 16, offset)
      if (bytesRead < 8) return true

      const type = header.toString('latin1', 4, 8)
      if (type === 'moov') return true
      if (type === 'mdat') return false

      let size = header.readUInt32BE(0)
      if (size === 1) size = Number(header.readBigUInt64BE(8))
      // size 0 means "to end of file" and a size below the header can't advance;
      // either way there is no further atom to reach, so treat it as faststart
      // rather than blocking the seed on a scan quirk.
      if (size < 8) return true
      offset += size
    }
  } finally {
    await handle.close()
  }
}

// Guarantee a video is faststart before upload, so a non-faststart source can
// never silently degrade the autoplay hero (Payload does not re-encode on
// upload). Already-faststart files are left untouched; others are losslessly
// remuxed in place — a stream copy that only moves `moov` to the front, so no
// pixels change and the byte size is unchanged. ffmpeg is a dev-only seed
// dependency, as with poster extraction.
export const ensureFaststart = async (filePath: string): Promise<void> => {
  if (await moovBeforeMdat(filePath)) return

  const remuxed = `${filePath}.faststart${path.extname(filePath)}`
  await execFileAsync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    filePath,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    remuxed,
  ])
  await rename(remuxed, filePath)
}
