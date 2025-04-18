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
  apiKey: 'AIzaSyC2-fomLqgCjb7ELwta1I9cEarPK8ziTGs',
  authDomain: 'dreamboothy.firebaseapp.com',
  databaseURL: 'https://dreamboothy-default-rtdb.firebaseio.com',
  projectId: 'dreamboothy',
  storageBucket: 'dreamboothy.appspot.com',
  messagingSenderId: '357148958219',
  appId: '1:357148958219:web:f5917f72e5f36a2015310e',
  measurementId: 'G-3ZBD3MBTG4'
}

// To test with prod config while using dev server, set USE_PROD_FIREBASE_CONFIG=true in .env
// Otherwise, build with `npm run build` and set `--front-end-root` to `ComfyUI_frontend/dist`
export const FIREBASE_CONFIG: FirebaseOptions = __USE_PROD_FIREBASE_CONFIG__
  ? PROD_CONFIG
  : DEV_CONFIG
