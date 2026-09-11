/**
 * Which backend family the Workshop talks to. One switch selects the Router
 * origin, the Cloud origin and the Firebase project together, because a token
 * minted against one family is only valid inside it.
 *
 * `PUBLIC_WORKSHOP_CLOUD_ENV` names the family: `prod`, `staging` or `test`.
 * Unset means staging, so local development needs no configuration. A build
 * that ships must name it explicitly — see `assertWorkshopCloudEnvForBuild`
 * in `workshop-release.ts` — because the backends' CORS allowlists pair each
 * origin with exactly one family: comfy.org may only reach production Cloud,
 * and a Vercel preview may only reach staging or test (cloud FE-2009).
 */
import type { FirebaseOptions } from 'firebase/app'

import type { WorkshopCloudEnv } from './workshop-cloud-env'
import { resolveWorkshopCloudEnv } from './workshop-cloud-env'

const WORKSHOP_CLOUD_ENV: WorkshopCloudEnv = resolveWorkshopCloudEnv(
  import.meta.env.PUBLIC_WORKSHOP_CLOUD_ENV
)

const ROUTER_BASE_URLS: Record<WorkshopCloudEnv, string> = {
  prod: 'https://api.comfy.org',
  staging: 'https://stagingapi.comfy.org',
  test: 'https://testapi.comfy.org'
}

const CLOUD_BASE_URLS: Record<WorkshopCloudEnv, string> = {
  prod: 'https://cloud.comfy.org',
  staging: 'https://stagingcloud.comfy.org',
  test: 'https://testcloud.comfy.org'
}

export const WORKSHOP_ROUTER_BASE_URL = ROUTER_BASE_URLS[WORKSHOP_CLOUD_ENV]
export const WORKSHOP_CLOUD_BASE_URL = CLOUD_BASE_URLS[WORKSHOP_CLOUD_ENV]

export const WORKSHOP_CREDITS_URL = new URL(
  '/?settings=plan-credits',
  WORKSHOP_CLOUD_BASE_URL
).href

// Public web-app configs, same values the platform app ships in
// src/config/firebase.ts. Staging and test both validate tokens from the dev
// project; prod validates the prod project.
const DEV_FIREBASE: FirebaseOptions = {
  apiKey: 'AIzaSyDa_YMeyzV0SkVe92vBZ1tVikWBmOU5KVE',
  authDomain: 'dreamboothy-dev.firebaseapp.com',
  databaseURL: 'https://dreamboothy-dev-default-rtdb.firebaseio.com',
  projectId: 'dreamboothy-dev',
  storageBucket: 'dreamboothy-dev.appspot.com',
  messagingSenderId: '313257147182',
  appId: '1:313257147182:web:be38f6ebf74345fc7618bf',
  measurementId: 'G-YEVSMYXSPY'
}

const PROD_FIREBASE: FirebaseOptions = {
  apiKey: 'AIzaSyC2-fomLqgCjb7ELwta1I9cEarPK8ziTGs',
  authDomain: 'dreamboothy.firebaseapp.com',
  databaseURL: 'https://dreamboothy-default-rtdb.firebaseio.com',
  projectId: 'dreamboothy',
  storageBucket: 'dreamboothy.appspot.com',
  messagingSenderId: '357148958219',
  appId: '1:357148958219:web:f5917f72e5f36a2015310e',
  measurementId: 'G-3ZBD3MBTG4'
}

export const WORKSHOP_FIREBASE_OPTIONS: FirebaseOptions =
  WORKSHOP_CLOUD_ENV === 'prod' ? PROD_FIREBASE : DEV_FIREBASE

/**
 * Public per-environment Turnstile sitekeys, the same constants the platform
 * app bakes in. Whether the widget renders is still governed by Cloudflare's
 * hostname allowlist; where it cannot, sign-up proceeds without a token and
 * the server's own policy decides. Test has no sitekey in this mapping, so the
 * widget stays off there.
 */
// TODO(auth parity, E7): the cloud app overrides this live from remote config;
// give the website a live source (PostHog flag payload) so a rotation needs no deploy.
const TURNSTILE_SITE_KEYS: Record<WorkshopCloudEnv, string> = {
  prod: '0x4AAAAAADnYZPVOpFCL_zeo',
  staging: '0x4AAAAAADnYY4_Q0qxHZ5a7',
  test: ''
}

export const WORKSHOP_TURNSTILE_SITE_KEY =
  TURNSTILE_SITE_KEYS[WORKSHOP_CLOUD_ENV]
