import { FirebaseOptions } from 'firebase/app'

const DEV_CONFIG: FirebaseOptions = {
  apiKey: 'AIzaSyAIOcnOl01Roycc4kCiVoxyOZzlvM27O1o',
  authDomain: 'dreamboothy.firebaseapp.com',
  databaseURL: 'https://dreamboothy-default-rtdb.firebaseio.com',
  projectId: 'dreamboothy',
  storageBucket: 'dreamboothy.appspot.com',
  messagingSenderId: '357148958219',
  appId: '1:357148958219:web:062460a94961edd31531de',
  measurementId: 'G-3RDG85K1MH'
}

const PROD_CONFIG: FirebaseOptions = {
  apiKey: __FIREBASE_API_KEY__,
  authDomain: __FIREBASE_AUTH_DOMAIN__,
  databaseURL: __FIREBASE_DATABASE_URL__,
  projectId: __FIREBASE_PROJECT_ID__,
  storageBucket: __FIREBASE_STORAGE_BUCKET__,
  messagingSenderId: __FIREBASE_MESSAGING_SENDER_ID__,
  appId: __FIREBASE_APP_ID__,
  measurementId: __FIREBASE_MEASUREMENT_ID__
}

export const FIREBASE_CONFIG: FirebaseOptions = __USE_PROD_CONFIG__
  ? PROD_CONFIG
  : DEV_CONFIG
