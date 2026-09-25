import { z } from 'zod'

export const SCENE_LIMIT = 8000
export const BRIEF_FIELDS = [
  'subject',
  'action',
  'setting',
  'composition',
  'constraints'
] as const
const text = z.string().max(SCENE_LIMIT)
const briefSchema = z
  .object({
    subject: text,
    action: text,
    setting: text,
    composition: text,
    constraints: text
  })
  .strict()
const shotSchema = z
  .object({ title: z.string().max(100), action: text, framing: text })
  .strict()
const draftSchema = z
  .object({
    format: z.literal('comfy-cinema-scene-draft'),
    version: z.literal(1),
    brief: briefSchema,
    plan: z
      .object({
        character: text,
        setting: text,
        scene: text,
        continuity: text,
        shots: z.array(shotSchema).length(3)
      })
      .strict()
  })
  .strict()

export type SceneBrief = z.infer<typeof briefSchema>
export type SceneBuilderDraft = z.infer<typeof draftSchema>

const labels = {
  action: 'Action',
  setting: 'Setting',
  composition: 'Composition',
  constraints: 'Keep or avoid'
}

function validateScene(scene: string): string {
  if (!scene.trim() || scene.length > SCENE_LIMIT)
    throw new Error('Invalid scene length')
  return scene
}

export function composeSceneBrief(brief: SceneBrief): string {
  const parsed = briefSchema.parse(brief)
  if (!parsed.subject.trim()) throw new Error('Missing subject')
  return validateScene(
    BRIEF_FIELDS.flatMap((key) => {
      const value = parsed[key].trim()
      if (!value) return []
      return [key === 'subject' ? value : `${labels[key]}: ${value}`]
    }).join('\n\n')
  )
}

export function createSceneBuilderDraft(scene: string): SceneBuilderDraft {
  return draftSchema.parse({
    format: 'comfy-cinema-scene-draft',
    version: 1,
    brief: {
      subject: scene,
      action: '',
      setting: '',
      composition: '',
      constraints: ''
    },
    plan: {
      scene,
      character: '',
      setting: '',
      continuity: '',
      shots: [
        {
          title: 'Establish the world',
          action: '',
          framing:
            'A wide establishing shot from a distant camera position. Make the main subject small in the frame and let the location occupy most of the image. Show foreground and background context.'
        },
        {
          title: 'Move into the action',
          action: '',
          framing:
            'An eye-level medium shot. Focus on the main subject and the key action. Keep important hands, props and interactions readable.'
        },
        {
          title: 'Find the important detail',
          action: '',
          framing:
            'A tight close-up. Fill most of the frame with the main subject’s most expressive or important detail. Crop away the full body and most of the surroundings. Keep only a small hint of the original setting in the background, at the same story moment.'
        }
      ]
    }
  })
}

export function composePlannedScene(
  plan: SceneBuilderDraft['plan'],
  index: number
): string {
  const parsed = draftSchema.shape.plan.parse(plan)
  const shot = parsed.shots.at(index)
  if (!shot || !shot.framing.trim() || !parsed.scene.trim())
    throw new Error('Missing shot scene or framing')
  return validateScene(
    [
      shot.framing.trim(),
      parsed.scene.trim(),
      parsed.character.trim() && `Character: ${parsed.character.trim()}`,
      parsed.setting.trim() && `Setting: ${parsed.setting.trim()}`,
      shot.action.trim() && `Action: ${shot.action.trim()}`,
      parsed.continuity.trim(),
      'One film still. Follow the shot framing above; retain the scene, people and clothing.'
    ]
      .filter(Boolean)
      .join('\n\n')
  )
}

export function parseSceneBuilderDraft(json: string): SceneBuilderDraft {
  if (json.length > 1000000) throw new Error('Scene draft too large')
  return draftSchema.parse(JSON.parse(json))
}

export function serializeSceneBuilderDraft(draft: SceneBuilderDraft): string {
  return JSON.stringify(draftSchema.parse(draft), null, 2)
}

export function sceneBuilderStorageKey(namespace: string): string {
  if (!namespace) throw new Error('Missing scene draft scope')
  return `comfy-cinema-scene-draft-v1:${namespace}`
}
