/**
 * This origin's Firebase identity: the package-owned entry bound to the
 * deployment's project. Nothing here touches the Firebase SDK until a sign-in
 * action runs, so a deployment without configuration boots and offers the
 * sign-in page in its unavailable state rather than failing at import.
 */
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { createFirebaseIdentity } from '@comfyorg/account-core/firebase'

import { FIREBASE_OPTIONS } from '@/config/env'

const APP_NAME = 'billing-web'

export const billingWebIdentity: FirebaseIdentity | undefined = FIREBASE_OPTIONS
  ? createFirebaseIdentity({ options: FIREBASE_OPTIONS, appName: APP_NAME })
  : undefined
