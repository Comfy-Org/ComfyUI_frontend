// Generated API projection from ComfyUI_frontend 1ee083258b (Core #17860).
import { z } from 'zod'

const zModelFile = z.object({
  name: z.string(),
  pathIndex: z.int(),
  size: z.int().gte(0)
})

export const zGetModelsInFolderResponse = z.array(zModelFile)

type ModelFile = {
  /**
   * The filename of the model
   */
  name: string
  /**
   * Index of the path where this model is located
   */
  pathIndex: number
  /**
   * File size in bytes
   */
  size: number
}

type GetModelsInFolderResponses = {
  /**
   * Success - List of models in the folder
   */
  200: Array<ModelFile>
}

export type GetModelsInFolderResponse =
  GetModelsInFolderResponses[keyof GetModelsInFolderResponses]
