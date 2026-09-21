import { vi } from 'vitest'

import type { User } from 'firebase/auth'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { createTestIdentity } from '@comfyorg/account-core/testing'

import { testCredential } from '../__fixtures__/workshopSessionFakes'
import type * as realModule from '../workshop-firebase'

const testIdentity = vi.mockObject<FirebaseIdentity>(
  {
    ...createTestIdentity<User>({
      onUserChanged(callback) {
        callback(null)
        return () => {}
      }
    }),
    onTokenChanged(callback) {
      callback(null)
      return () => {}
    },
    initialize: () => {},
    currentUser: () => null,
    signInWithGoogle: async () => testCredential(),
    signInWithGitHub: async () => testCredential(),
    signInWithEmail: async () => testCredential(),
    createUserWithEmail: async () => testCredential(),
    sendPasswordReset: async () => {},
    updatePassword: async () => {},
    signOut: async () => {}
  },
  { spy: true }
)

const firebase = vi.mockObject<typeof realModule>(
  {
    workshopIdentity: testIdentity,
    provisionCustomer: async () => {},
    signInWorkshopWithGoogle: async () => testCredential(),
    signInWorkshopWithGitHub: async () => testCredential(),
    provisionWorkshopCustomer: async () => {},
    isNewWorkshopUser: () => false,
    signInWorkshopWithEmail: async () => testCredential(),
    signUpWorkshopWithEmail: async () => testCredential(),
    sendWorkshopPasswordReset: async () => {},
    signOutWorkshop: async () => {},
    isWorkshopProvisioningError: (_error): _error is never => false
  },
  { spy: true }
)

export const {
  workshopIdentity,
  provisionCustomer,
  signInWorkshopWithGoogle,
  signInWorkshopWithGitHub,
  provisionWorkshopCustomer,
  isNewWorkshopUser,
  signInWorkshopWithEmail,
  signUpWorkshopWithEmail,
  sendWorkshopPasswordReset,
  signOutWorkshop,
  isWorkshopProvisioningError
} = firebase
