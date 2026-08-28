import { fromPartial } from '@total-typescript/shoehorn'
import { vi } from 'vitest'

import type {
  getAuth as GetAuth,
  onAuthStateChanged as OnAuthStateChanged,
  Persistence,
  sendPasswordResetEmail as SendPasswordResetEmail,
  setPersistence as SetPersistence,
  signInWithEmailAndPassword as SignInWithEmailAndPassword,
  signOut as SignOut
} from 'firebase/auth'

export const browserLocalPersistence = fromPartial<Persistence>({})
export const getAuth = vi.fn<typeof GetAuth>()
export const onAuthStateChanged = vi.fn<typeof OnAuthStateChanged>()
export const sendPasswordResetEmail = vi.fn<typeof SendPasswordResetEmail>()
export const setPersistence = vi.fn<typeof SetPersistence>()
export const signInWithEmailAndPassword =
  vi.fn<typeof SignInWithEmailAndPassword>()
export const signOut = vi.fn<typeof SignOut>()
