import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

const defStatus = () => ({
  ready: false,
  spinning: false,
  socket: 'disconnected' /* disconnected | connecting | connected | error */,
  generation: 'idle' /* idle | started | generating */,
  rebooting: false,
  isSocketConnected: false,
  isLeftPaneVisible: true,
  isRightPaneVisible: false,
  isBottomPaneVisible: false
})

const defProgress = {
  percent: 0.0,
  runningNodeId: null,
  runningNodeTitle: null,
  averageStepDuration: 0,
  remainingSteps: 0,
  stepsPerSecond: 0,
  currentStep: 0,
  totalSteps: 0,
  eta: 0,
  currentImage: null,
  job_count: 0,
  job_no: 0
}

export const useMainStore = defineStore('mainStore', {
  state: () => ({
    darkMode: useStorage('vueuse-color-scheme', 'dark'),
    status: useStorage('status', defStatus()),
    progress: useStorage('progress', defProgress)
  }),

  actions: {
    reset() {
      this.status = defStatus()
      this.progress = defProgress
    },

    resetGenerationStatus() {
      this.status.generation = 'idle'
      this.progress = defProgress
    },

    spinner(bool: boolean) {
      this.status.spinning = bool
    },

    setRebooting(bool: boolean) {
      this.status.rebooting = bool
    },

    isRebooting() {
      return this.status.rebooting
    },

    updateProgress(progress: any) {
      if (progress) {
        this.progress = progress
      } else {
        this.progress = {
          percent: 0.0,
          runningNodeId: null,
          runningNodeTitle: null,
          averageStepDuration: 0,
          remainingSteps: 0,
          stepsPerSecond: 0,
          currentStep: 0,
          totalSteps: 0,
          eta: 0,
          currentImage: null,
          job_count: 0,
          job_no: 0
        }
      }
    },

    setSocketStatus(socketStatus: string) {
      this.status.socket = socketStatus
      this.status.isSocketConnected =
        socketStatus === 'connected' ? true : false
      // console.log('#socket:', socketStatus)
    },

    setLeftPane(isLeftPaneVisible: boolean) {
      this.status.isLeftPaneVisible = isLeftPaneVisible
    },

    toggleLeftPane() {
      this.status.isLeftPaneVisible = !this.status.isLeftPaneVisible
    },

    setRightPane(isRightPaneVisible: boolean) {
      this.status.isRightPaneVisible = isRightPaneVisible
    },

    toggleRightPane() {
      this.status.isRightPaneVisible = !this.status.isRightPaneVisible
    },

    setBottomPane(isBottomPaneVisible: boolean) {
      this.status.isBottomPaneVisible = isBottomPaneVisible
    },

    toggleBottomPane() {
      this.status.isBottomPaneVisible = !this.status.isBottomPaneVisible
    }
  }
})
