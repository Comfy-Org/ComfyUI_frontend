import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { liveSettings, requiredSetting } from './settings'

export default async function setup() {
  liveSettings()
  requiredSetting('WORKSHOP_ACCOUNT_EMAIL')
  requiredSetting('WORKSHOP_ACCOUNT_PASSWORD')
  const directory = requiredSetting('WORKSHOP_FIXTURE_DIR')
  await mkdir(directory, { recursive: true })
  execFileSync('ffmpeg', [
    '-nostdin',
    '-y',
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=1024x1024:rate=1',
    '-frames:v',
    '1',
    join(directory, 'reference.png')
  ])
  execFileSync('ffmpeg', [
    '-nostdin',
    '-y',
    '-v',
    'error',
    '-i',
    join(directory, 'reference.png'),
    '-vf',
    'hflip',
    '-frames:v',
    '1',
    join(directory, 'last-frame.png')
  ])
  execFileSync('ffmpeg', [
    '-nostdin',
    '-y',
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=1280x720:rate=24',
    '-t',
    '5',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    join(directory, 'reference.mp4')
  ])
}
