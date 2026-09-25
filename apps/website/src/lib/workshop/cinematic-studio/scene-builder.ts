import { z } from 'zod'
import type { SavedCreation } from './creations'
import { cameraGroups, lookGroups, gradeGroup } from './catalog'
import { validateCreativeSettings } from './creative'

const directionChoice = (part: string) =>
  z
    .string()
    .refine((id) =>
      [...cameraGroups, ...lookGroups, gradeGroup]
        .find((group) => group.part === part)
        ?.options.some((option) => option.id === id)
    )
const referenceId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9:_-]+$/)
export const planSettingsSchema = z
  .object({
    modelSlug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9._-]+$/),
    modelName: z.string().max(200).optional(),
    aspect: z.enum(['21:9', '16:9', '4:3', '1:1', '9:16']),
    resolution: z.enum(['1K', '2K']),
    takes: z.number().int().min(1).max(4),
    enhance: z.boolean().default(false),
    assets: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            name: z.string().max(60),
            kind: z.enum(['character', 'location', 'prop']),
            notes: z.string().max(500)
          })
          .strict()
      )
      .max(3)
      .optional(),
    seed: z.number().finite().optional(),
    direction: z
      .object({
        body: directionChoice('body'),
        lens: directionChoice('lens'),
        focal: directionChoice('focal'),
        aperture: directionChoice('aperture'),
        shot: directionChoice('shot'),
        light: directionChoice('light'),
        film: directionChoice('film'),
        look: directionChoice('look'),
        grade: directionChoice('grade')
      })
      .strict(),
    creative: z
      .unknown()
      .transform((value, context) => {
        try {
          return validateCreativeSettings(value)
        } catch {
          context.addIssue({
            code: 'custom',
            message: 'Invalid creative settings'
          })
          return z.NEVER
        }
      })
      .optional(),
    referenceBundleId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    references: z
      .array(z.object({ id: referenceId, label: z.string().max(200) }).strict())
      .max(20)
      .default([])
  })
  .strict()
  .superRefine((settings, context) => {
    if (
      new Set(settings.references.map((item) => item.id)).size !==
        settings.references.length ||
      (settings.references.length > 0 && !settings.referenceBundleId)
    )
      context.addIssue({
        code: 'custom',
        message: 'References require a saved bundle and unique identifiers'
      })
  })
export type PlanSettingsSnapshot = z.infer<typeof planSettingsSchema>

export const SCENE_LIMIT = 8000
export const BRIEF_FIELDS = [
  'subject',
  'action',
  'setting',
  'composition',
  'constraints'
] as const
const text = z.string().max(SCENE_LIMIT)
const identity = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/)
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
  .object({
    id: identity.default(() => crypto.randomUUID()),
    title: z.string().max(100),
    action: text,
    framing: text,
    referenceIds: z.array(referenceId).max(20).optional(),
    includeSharedBrief: z.boolean().default(true)
  })
  .strict()
const draftSchema = z
  .object({
    format: z.literal('comfy-cinema-scene-draft'),
    version: z.literal(1),
    brief: briefSchema,
    plan: z
      .object({
        id: identity.default(() => crypto.randomUUID()),
        character: text,
        setting: text,
        scene: text,
        continuity: text,
        settings: planSettingsSchema.optional(),
        shots: z
          .array(shotSchema)
          .length(3)
          .refine(
            (shots) =>
              new Set(shots.map((shot) => shot.id)).size === shots.length
          )
      })
      .strict()
  })
  .strict()

export type SceneBrief = z.infer<typeof briefSchema>
export type SceneBuilderDraft = z.infer<typeof draftSchema>

export const planShotMetadataSchema = z
  .object({
    planId: identity,
    shotId: identity,
    snapshot: z.string().min(1).max(20000)
  })
  .strict()
export type PlanShotMetadata = z.infer<typeof planShotMetadataSchema>

export function plannedShotMetadata(
  plan: SceneBuilderDraft['plan'],
  index: number
): PlanShotMetadata {
  const shot = plan.shots.at(index)
  if (!shot) throw new Error('Missing shot')
  return planShotMetadataSchema.parse({
    planId: plan.id,
    shotId: shot.id,
    snapshot: JSON.stringify({
      scene: composePlannedScene(plan, index),
      title: shot.title,
      ...(plan.settings
        ? {
            settings: plan.settings,
            referenceIds: plannedReferenceIds(plan, index)
          }
        : {})
    })
  })
}

export function plannedReferenceIds(
  plan: SceneBuilderDraft['plan'],
  index: number
): string[] | undefined {
  if (!plan.settings) return undefined
  const available = plan.settings.references.map((reference) => reference.id)
  const selected = plan.shots.at(index)?.referenceIds
  return selected === undefined
    ? available
    : available.filter((id) => selected.includes(id))
}

/** Matches identity, never names, prompt similarity or card position. */
export function plannedShotTakes(
  plan: SceneBuilderDraft['plan'],
  index: number,
  creations: readonly SavedCreation[]
) {
  const shot = plan.shots.at(index)
  if (!shot) return []
  let snapshot: string | undefined
  try {
    snapshot = plannedShotMetadata(plan, index).snapshot
  } catch {
    /* Invalid draft still retains its prior takes. */
  }
  const settings = z.object({ plan: planShotMetadataSchema })
  return creations
    .flatMap((creation) => {
      const parsed = settings.safeParse(creation.settings)
      if (
        !parsed.success ||
        parsed.data.plan.planId !== plan.id ||
        parsed.data.plan.shotId !== shot.id
      )
        return []
      return [
        { creation, previousVersion: parsed.data.plan.snapshot !== snapshot }
      ]
    })
    .sort((a, b) => b.creation.createdAt - a.creation.createdAt)
}

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
  if (
    !shot ||
    !shot.framing.trim() ||
    (shot.includeSharedBrief && !parsed.scene.trim())
  )
    throw new Error('Missing shot scene or framing')
  return validateScene(
    [
      shot.framing.trim(),
      shot.includeSharedBrief && parsed.scene.trim(),
      shot.includeSharedBrief &&
        parsed.character.trim() &&
        `Character: ${parsed.character.trim()}`,
      shot.includeSharedBrief &&
        parsed.setting.trim() &&
        `Setting: ${parsed.setting.trim()}`,
      shot.action.trim() && `Action: ${shot.action.trim()}`,
      shot.includeSharedBrief && parsed.continuity.trim(),
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
