import type { Page } from '@playwright/test'

/**
 * Single home for the Firebase persistence contract the cloud frontend reads
 * at boot: `browserLocalPersistence` stores the signed-in user in IndexedDB
 * database `firebaseLocalStorageDb`, object store `firebaseLocalStorage`,
 * keyed by `firebase:authUser:<apiKey>:<appName>`. CloudAuthHelper (mock
 * session) and smokeAuth (real smoke-user session) both seed through here so
 * the two writers can never drift apart.
 */
const FIREBASE_AUTH_DB = 'firebaseLocalStorageDb'
const FIREBASE_AUTH_STORE = 'firebaseLocalStorage'

// The app's public Firebase web key and default app name
// (src/config/firebase.ts DEV_CONFIG): the SDK restores the record it finds
// under exactly this key.
export const FIREBASE_WEB_API_KEY = 'AIzaSyDa_YMeyzV0SkVe92vBZ1tVikWBmOU5KVE'
export const FIREBASE_APP_NAME = '[DEFAULT]'

export interface FirebaseAuthUserRecord {
  uid: string
  email: string
  displayName: string | null
  emailVerified: boolean
  isAnonymous: boolean
  providerData: Array<{
    providerId: string
    uid: string
    displayName: string | null
    email: string
    phoneNumber: string | null
    photoURL: string | null
  }>
  stsTokenManager: {
    refreshToken: string
    accessToken: string
    expirationTime: number
  }
  apiKey: string
  appName: string
}

/**
 * Write the user record into Firebase's IndexedDB persistence. Navigates to a
 * lightweight same-origin endpoint first so the write lands in the app
 * origin's storage before the app loads and Firebase reads it.
 */
export async function seedFirebaseAuthUser(
  page: Page,
  appUrl: string,
  record: FirebaseAuthUserRecord
): Promise<void> {
  await page.goto(`${appUrl}/api/users`)

  await page.evaluate(
    ({ dbName, storeName, user }) => {
      const key = `firebase:authUser:${user.apiKey}:${user.appName}`

      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onerror = () => reject(request.error)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName)
          }
        }
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.close()
            const upgradeReq = indexedDB.open(dbName, db.version + 1)
            upgradeReq.onerror = () => reject(upgradeReq.error)
            upgradeReq.onupgradeneeded = () => {
              const upgradedDb = upgradeReq.result
              if (!upgradedDb.objectStoreNames.contains(storeName)) {
                upgradedDb.createObjectStore(storeName)
              }
            }
            upgradeReq.onsuccess = () => {
              const upgradedDb = upgradeReq.result
              const tx = upgradedDb.transaction(storeName, 'readwrite')
              tx.objectStore(storeName).put(
                { fpiVersion: '1', value: user },
                key
              )
              tx.oncomplete = () => {
                upgradedDb.close()
                resolve()
              }
              tx.onerror = () => reject(tx.error)
            }
            return
          }
          const tx = db.transaction(storeName, 'readwrite')
          tx.objectStore(storeName).put({ fpiVersion: '1', value: user }, key)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      })
    },
    { dbName: FIREBASE_AUTH_DB, storeName: FIREBASE_AUTH_STORE, user: record }
  )
}
