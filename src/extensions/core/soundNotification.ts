import { StatusWsMessageStatus } from '../../schemas/apiSchema'
import { api } from '../../scripts/api'
import { app } from '../../scripts/app'

app.registerExtension({
  name: 'Comfy.SoundNotification',
  init() {
    app.ui.settings.addSetting({
      id: 'Comfy.SoundNotification.AfterOnePrompt',
      name: 'After executing a prompt',
      type: 'audio',
      defaultValue: undefined
    })
    app.ui.settings.addSetting({
      id: 'Comfy.SoundNotification.AfterAllPrompts',
      name: 'After executing all the prompts',
      type: 'audio',
      defaultValue: undefined
    })

    let lastQueueRemaining: number = 0

    function playAudio(settingId: string) {
      const soundData = app.ui.settings.getSettingValue(settingId)
      if (soundData) {
        new Audio(soundData).play()
      }
    }

    api.addEventListener(
      'status',
      (event: CustomEvent<StatusWsMessageStatus>): void => {
        const queueRemaining = event.detail.exec_info.queue_remaining
        if (lastQueueRemaining > 0 && queueRemaining === 0) {
          // In order to prevent "AfterAllPrompts" sound from being played when another prompt is immediately queued,
          // checking again after a short delay.
          // TODO: more reliable way
          setTimeout(() => {
            if (lastQueueRemaining === 0) {
              playAudio('Comfy.SoundNotification.AfterAllPrompts')
            } else {
              playAudio('Comfy.SoundNotification.AfterOnePrompt')
            }
          }, 500)
        } else if (queueRemaining < lastQueueRemaining) {
          playAudio('Comfy.SoundNotification.AfterOnePrompt')
        }
        lastQueueRemaining = queueRemaining
      }
    )
  }
})
