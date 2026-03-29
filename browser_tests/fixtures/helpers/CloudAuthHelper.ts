import type { Page } from '@playwright/test'

/**
 * Mocks Firebase authentication for cloud E2E tests.
 *
 * The cloud build's router guard waits for Firebase `onAuthStateChanged`
 * to fire, then checks `getAuthHeader()`. In CI no Firebase project is
 * configured, so the user is never authenticated and the app redirects
 * to `/cloud/login`.
 *
 * This helper seeds Firebase's IndexedDB persistence layer with a mock
 * user and intercepts the Firebase REST APIs (securetoken, identitytoolkit)
 * so the SDK believes a user is signed in. Must be called before navigation.
 */
export class CloudAuthHelper {
  constructor(private readonly page: Page) {}

  /**
   * Set up all auth mocks. Must be called before `comfyPage.setup()`.
   */
  async mockAuth(): Promise<void> {
    await this.seedFirebaseIndexedDB()
    await this.mockFirebaseEndpoints()
  }

  /**
   * Navigate to a lightweight same-origin page to seed Firebase's
   * IndexedDB persistence with a mock user. This ensures the data
   * is written before the app loads and Firebase reads it.
   *
   * Firebase auth uses `browserLocalPersistence` which stores data in
   * IndexedDB database `firebaseLocalStorageDb`, object store
   * `firebaseLocalStorage`, keyed by `firebase:authUser:<apiKey>:<appName>`.
   */
  private async seedFirebaseIndexedDB(): Promise<void> {
    // Navigate to a lightweight endpoint to get a same-origin context
    await this.page.goto('http://localhost:8188/api/users')

    await this.page.evaluate(() => {
      const MOCK_USER_DATA = {
        uid: 'test-user-e2e',
        email: 'e2e@test.comfy.org',
        displayName: 'E2E Test User',
        emailVerified: true,
        isAnonymous: false,
        providerData: [
          {
            providerId: 'google.com',
            uid: 'test-user-e2e',
            displayName: 'E2E Test User',
            email: 'e2e@test.comfy.org',
            phoneNumber: null,
            photoURL: null
          }
        ],
        stsTokenManager: {
          refreshToken: 'mock-refresh-token',
          accessToken: 'mock-firebase-id-token',
          expirationTime: Date.now() + 60 * 60 * 1000
        },
        apiKey: 'AIzaSyDa_YMeyzV0SkVe92vBZ1tVikWBmOU5KVE',
        appName: '[DEFAULT]'
      }

      const DB_NAME = 'firebaseLocalStorageDb'
      const STORE_NAME = 'firebaseLocalStorage'
      const KEY = `firebase:authUser:${MOCK_USER_DATA.apiKey}:${MOCK_USER_DATA.appName}`

      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME)
        request.onerror = () => reject(request.error)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.close()
            const upgradeReq = indexedDB.open(DB_NAME, db.version + 1)
            upgradeReq.onerror = () => reject(upgradeReq.error)
            upgradeReq.onupgradeneeded = () => {
              const upgradedDb = upgradeReq.result
              if (!upgradedDb.objectStoreNames.contains(STORE_NAME)) {
                upgradedDb.createObjectStore(STORE_NAME)
              }
            }
            upgradeReq.onsuccess = () => {
              const upgradedDb = upgradeReq.result
              const tx = upgradedDb.transaction(STORE_NAME, 'readwrite')
              tx.objectStore(STORE_NAME).put(
                { fpiVersion: '1', value: MOCK_USER_DATA },
                KEY
              )
              tx.oncomplete = () => {
                upgradedDb.close()
                resolve()
              }
              tx.onerror = () => reject(tx.error)
            }
            return
          }
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).put(
            { fpiVersion: '1', value: MOCK_USER_DATA },
            KEY
          )
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      })
    })
  }

  /**
   * Intercept Firebase Auth REST API endpoints so the SDK can
   * "refresh" the mock user's token without real credentials.
   */
  private async mockFirebaseEndpoints(): Promise<void> {
    await this.page.route('**/securetoken.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          expires_in: '3600',
          token_type: 'Bearer',
          refresh_token: 'mock-refresh-token',
          id_token: 'mock-firebase-id-token',
          user_id: 'test-user-e2e',
          project_id: 'dreamboothy-dev'
        })
      })
    )

    await this.page.route('**/identitytoolkit.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#GetAccountInfoResponse',
          users: [
            {
              localId: 'test-user-e2e',
              email: 'e2e@test.comfy.org',
              displayName: 'E2E Test User',
              emailVerified: true,
              validSince: '0',
              lastLoginAt: String(Date.now()),
              createdAt: String(Date.now()),
              lastRefreshAt: new Date().toISOString()
            }
          ]
        })
      })
    )

    await this.page.route('**/__/auth/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body></body></html>'
      })
    )
  }
}
