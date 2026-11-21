import { register } from 'extendable-media-recorder'
import { connect } from 'extendable-media-recorder-wav-encoder'

import { uploadTempFile } from '@/services/uploadTempFile'

export interface AudioRecordingError {
  type: 'permission' | 'not_supported' | 'encoder' | 'recording' | 'unknown'
  message: string
  originalError?: unknown
}

let isEncoderRegistered: boolean = false

export const useAudioService = () => {
  const handleError = (
    type: AudioRecordingError['type'],
    message: string,
    originalError?: unknown
  ) => {
    console.error(`Audio Service Error (${type}):`, message, originalError)
  }

  const stopAllTracks = (currentStream: MediaStream | null) => {
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        track.stop()
      })
    }
  }

  const registerWavEncoder = async (): Promise<void> => {
    if (isEncoderRegistered) {
      return
    }

    try {
      await register(await connect())
      isEncoderRegistered = true
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('already an encoder stored')
      ) {
        isEncoderRegistered = true
      } else {
        handleError('encoder', 'Failed to register WAV encoder', err)
      }
    }
  }

  const convertBlobToFileAndSubmit = async (blob: Blob): Promise<string> => {
    const name = `recording-${Date.now()}.wav`
    const file = new File([blob], name, { type: blob.type || 'audio/wav' })

    const upload = await uploadTempFile(file, 'audio')
    if (!upload.ok)
      throw new Error(`Error uploading temp file: ${upload.reason}`)
    const tempAudio = upload.file

    return `audio/${tempAudio.name} [temp]`
  }

  return {
    // Methods
    convertBlobToFileAndSubmit,
    registerWavEncoder,
    stopAllTracks
  }
}
