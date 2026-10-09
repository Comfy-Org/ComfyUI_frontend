import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { modelCases } from './cases'
import { expectedCharge, liveSettings, requiredSetting } from './settings'

function validateAccountSettings() {
  const settings = liveSettings()
  const checkout = process.env.WORKSHOP_ACCEPTANCE_SCOPE === 'checkout'
  if (checkout && settings.environment !== 'test')
    throw new Error('Checkout acceptance only runs against test Cloud')
  const names = checkout
    ? ['WORKSHOP_SIGNUP_EMAIL_DOMAIN', 'WORKSHOP_SIGNUP_PASSWORD']
    : [
        'WORKSHOP_ACCOUNT_EMAIL',
        'WORKSHOP_ACCOUNT_PASSWORD',
        'WORKSHOP_WORKSPACE_ID'
      ]
  names.forEach(requiredSetting)
}

function validateReviewedCharges() {
  const selected =
    process.env.WORKSHOP_ACCEPTANCE_SCOPE === 'release'
      ? modelCases
      : modelCases.filter((model) => model.smoke)
  const variants =
    process.env.WORKSHOP_ACCEPTANCE_SCOPE === 'checkout'
      ? ['own']
      : ['defaults', 'own', 'advanced']
  for (const model of selected) validateModelCharges(model.slug, variants)
}

function validateModelCharges(slug: string, variants: string[]) {
  for (const variant of variants) expectedCharge(slug, variant)
}

export default async function setup() {
  validateAccountSettings()
  validateReviewedCharges()
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
