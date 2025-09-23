import * as THREE from 'three'

import { EventManagerInterface } from './interfaces'

export class RecordingManager {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private isRecording: boolean = false
  private recordingStream: MediaStream | null = null
  private recordingIndicator: THREE.Sprite | null = null
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private eventManager: EventManagerInterface
  private recordingStartTime: number = 0
  private recordingDuration: number = 0
  private recordingCanvas: HTMLCanvasElement | null = null

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    eventManager: EventManagerInterface
  ) {
    this.scene = scene
    this.renderer = renderer
    this.eventManager = eventManager
    this.setupRecordingIndicator()
  }

  private setupRecordingIndicator(): void {
    const map = new THREE.TextureLoader().load(
      'data:image/svg+xml;base64,' +
        btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="24" fill="#4CAF50" opacity="0.8" />
        <circle cx="32" cy="32" r="16" fill="#2E7D32" opacity="0.8" />
      </svg>`)
    )
    const material = new THREE.SpriteMaterial({
      map: map,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
    this.recordingIndicator = new THREE.Sprite(material)
    this.recordingIndicator.scale.set(0.5, 0.5, 0.5)
    this.recordingIndicator.position.set(-0.8, 0.8, 0)
    this.recordingIndicator.visible = false

    this.scene.add(this.recordingIndicator)
  }

  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      return
    }

    try {
      this.recordingCanvas = this.renderer.domElement

      this.recordingStream = this.recordingCanvas.captureStream(30)

      if (!this.recordingStream) {
        throw new Error('Failed to capture stream from canvas')
      }

      this.mediaRecorder = new MediaRecorder(this.recordingStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      })

      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        this.recordingIndicator!.visible = false
        this.isRecording = false
        this.recordingStream = null

        this.eventManager.emitEvent('recordingStopped', {
          duration: this.recordingDuration,
          hasRecording: this.recordedChunks.length > 0
        })
      }

      if (this.recordingIndicator) {
        this.recordingIndicator.visible = true
      }

      this.mediaRecorder.start(100)
      this.isRecording = true
      this.recordingStartTime = Date.now()

      this.eventManager.emitEvent('recordingStarted', null)
    } catch (error) {
      console.error('Error starting recording:', error)
      this.eventManager.emitEvent('recordingError', error)
    }
  }

  public stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      return
    }

    this.recordingDuration = (Date.now() - this.recordingStartTime) / 1000

    this.mediaRecorder.stop()
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach((track) => track.stop())
    }
  }

  public getIsRecording(): boolean {
    return this.isRecording
  }

  public hasRecording(): boolean {
    return this.recordedChunks.length > 0
  }

  public getRecordingDuration(): number {
    return this.recordingDuration
  }

  public getRecordingData(): string | null {
    if (this.recordedChunks.length !== 0) {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' })

      return URL.createObjectURL(blob)
    }

    return null
  }

  public exportRecording(filename: string = 'scene-recording.mp4'): void {
    if (this.recordedChunks.length === 0) {
      this.eventManager.emitEvent(
        'recordingError',
        new Error('No recording available to export')
      )
      return
    }

    this.eventManager.emitEvent('exportingRecording', null)

    try {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      document.body.appendChild(a)
      a.style.display = 'none'
      a.href = url
      a.download = filename
      a.click()

      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      this.eventManager.emitEvent('recordingExported', null)
    } catch (error) {
      console.error('Error exporting recording:', error)
      this.eventManager.emitEvent('recordingError', error)
    }
  }

  public clearRecording(): void {
    this.recordedChunks = []
    this.recordingDuration = 0
    this.eventManager.emitEvent('recordingCleared', null)
  }

  public dispose(): void {
    this.stopRecording()
    this.clearRecording()

    if (this.recordingIndicator) {
      this.scene.remove(this.recordingIndicator)
      ;(this.recordingIndicator.material as THREE.SpriteMaterial).map?.dispose()
      ;(this.recordingIndicator.material as THREE.SpriteMaterial).dispose()
    }
  }
}
