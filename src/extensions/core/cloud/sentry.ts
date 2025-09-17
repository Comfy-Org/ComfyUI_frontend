import * as Sentry from '@sentry/vue'

import { app } from '../../../scripts/app'

app.registerExtension({
  name: 'Comfy.Cloud.Sentry',
  onAuthUserResolved: (user, _app) => {
    // https://docs.sentry.io/platforms/javascript/apis/#setUser
    Sentry.setUser({
      id: user.id
    })
  }
})
