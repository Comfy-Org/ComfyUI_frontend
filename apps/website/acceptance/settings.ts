import { z } from 'zod'

const environments = {
  prod: { cloud: 'https://cloud.comfy.org', router: 'https://api.comfy.org' },
  staging: {
    cloud: 'https://stagingcloud.comfy.org',
    router: 'https://stagingapi.comfy.org'
  },
  test: {
    cloud: 'https://testcloud.comfy.org',
    router: 'https://testapi.comfy.org'
  }
} as const

export function liveSettings(env: NodeJS.ProcessEnv = process.env) {
  const environment = z
    .enum(['prod', 'staging', 'test'])
    .parse(env.PUBLIC_WORKSHOP_CLOUD_ENV)
  const url = new URL(z.string().url().parse(env.WORKSHOP_SITE_URL))
  const production = ['comfy.org', 'www.comfy.org'].includes(url.hostname)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    production !== (environment === 'prod') ||
    (!production && !url.hostname.endsWith('.vercel.app'))
  )
    throw new Error('Workshop site must match the selected Cloud environment')
  return { environment, site: url.origin, ...environments[environment] }
}

export function requiredSetting(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}; live acceptance cannot run`)
  return value
}

export function expectedCharge(slug: string, variant: string): number {
  const prices = z
    .record(z.number().int().positive())
    .parse(JSON.parse(requiredSetting('WORKSHOP_EXPECTED_CHARGES_JSON')))
  const price = prices[`${slug}/${variant}`]
  if (!price) throw new Error(`Missing reviewed charge for ${slug}/${variant}`)
  return price
}
