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

const approvedSiteOrigins: Record<
  keyof typeof environments,
  readonly string[]
> = {
  prod: ['https://comfy.org', 'https://www.comfy.org'],
  staging: [],
  test: []
}

export function liveSettings(
  env: NodeJS.ProcessEnv = process.env,
  approvedOrigins = approvedSiteOrigins
) {
  const environment = z
    .enum(['prod', 'staging', 'test'])
    .parse(env.PUBLIC_WORKSHOP_CLOUD_ENV)
  const url = new URL(z.string().url().parse(env.WORKSHOP_SITE_URL))
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !approvedOrigins[environment].includes(url.origin)
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
    .record(z.number().finite().positive())
    .parse(JSON.parse(requiredSetting('WORKSHOP_EXPECTED_CHARGES_JSON')))
  const price = prices[`${slug}/${variant}`]
  if (!price) throw new Error(`Missing reviewed charge for ${slug}/${variant}`)
  return price
}
