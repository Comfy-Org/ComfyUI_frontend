/**
 * Which backend family the Workshop talks to. One switch selects the Router
 * origin and the Firebase project together, because a token minted against
 * one family is only valid inside it. `PUBLIC_WORKSHOP_CLOUD_ENV=staging`
 * exists because prod cannot serve comfy.org yet: the origin is missing from
 * the ingest CORS allowlist (FE-2009) and Firebase authorized domains
 * (FE-2010). Staging already allows the website's preview URLs.
 */
import type { FirebaseOptions } from 'firebase/app'

const STAGING = import.meta.env.PUBLIC_WORKSHOP_CLOUD_ENV === 'staging'

export const WORKSHOP_CLOUD_BASE_URL = STAGING
  ? 'https://stagingcloud.comfy.org'
  : 'https://cloud.comfy.org'

export const WORKSHOP_ROUTER_BASE_URL = STAGING
  ? 'https://stagingapi.comfy.org'
  : 'https://api.comfy.org'

// Public web-app configs, same values the platform app ships in
// src/config/firebase.ts. Staging backends validate tokens from the dev
// project; prod validates the prod project.
const STAGING_FIREBASE: FirebaseOptions = {
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

export const WORKSHOP_FIREBASE_OPTIONS: FirebaseOptions = STAGING
  ? STAGING_FIREBASE
  : PROD_FIREBASE
