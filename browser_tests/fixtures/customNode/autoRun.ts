// Classifies which nodes can execute with no hand-authored fixture; the
// rest are recorded with the reason, never silently dropped.
import { chunk } from 'es-toolkit'

import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'

type AutoRunClass =
  // Widgets cover every required input and a terminus exists.
  | 'AUTO_RUNNABLE'
  // Every required socket is synthesizable from a model-free producer.
  | 'CHAINABLE'
  // A required socket type has no model-free producer (MODEL, CLIP, SEGS...).
  | 'NEEDS_WIRES'
  // A required combo has zero options (empty model/file scan).
  | 'NEEDS_MODELS'
  // No outputs and not an OUTPUT_NODE - nothing the executor could watch.
  | 'NO_OBSERVABLE_OUTPUT'

export interface RequiredSocket {
  name: string
  type: string
}

export interface AutoRunVerdict {
  key: string
  verdict: AutoRunClass
  // Wire output 0 to PreviewAny (false = the node is its own terminus).
  needsPreviewSink?: boolean
  // CHAINABLE: sockets to satisfy from SYNTH_PRODUCERS, in declaration order.
  requiredSockets?: RequiredSocket[]
  reason: string
}

// Model-free producers for each synthesizable socket type. NUMBER is a WAS
// type with a WAS producer, so each entry is validated against the live defs
// before it counts as synthesizable.
export const SYNTH_PRODUCERS: Record<
  string,
  { nodeType: string; outputIndex: number }
> = {
  IMAGE: { nodeType: 'EmptyImage', outputIndex: 0 },
  LATENT: { nodeType: 'EmptyLatentImage', outputIndex: 0 },
  MASK: { nodeType: 'SolidMask', outputIndex: 0 },
  INT: { nodeType: 'PrimitiveInt', outputIndex: 0 },
  FLOAT: { nodeType: 'PrimitiveFloat', outputIndex: 0 },
  STRING: { nodeType: 'PrimitiveString', outputIndex: 0 },
  BOOLEAN: { nodeType: 'PrimitiveBoolean', outputIndex: 0 },
  AUDIO: { nodeType: 'EmptyAudio', outputIndex: 0 },
  NUMBER: { nodeType: 'Constant Number', outputIndex: 0 },
  '*': { nodeType: 'PrimitiveInt', outputIndex: 0 }
}

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN'])

type InputSpec = [unknown, Record<string, unknown>?] | unknown

function classifyInput(spec: InputSpec): 'widget' | 'socket' | 'empty-combo' {
  const specArray = Array.isArray(spec) ? spec : [spec]
  const rawType = specArray[0]
  const options = specArray[1] as
    | { forceInput?: boolean; options?: unknown; widgetType?: string }
    | undefined
  // forceInput beats every form, combos included: no widget materializes,
  // so no default exists to run on - the input must be wired.
  if (options?.forceInput) return 'socket'
  if (Array.isArray(rawType))
    return rawType.length > 0 ? 'widget' : 'empty-combo'
  if (typeof rawType !== 'string') return 'socket'
  if (rawType === 'COMBO') {
    // Transformed (V2-schema) defs carry combos as the literal 'COMBO' with
    // the option list in the opts object. No static list (empty, or a
    // `remote` lazy combo) means the default value cannot be verified
    // runnable at plan time - same bucket as an empty model scan.
    return Array.isArray(options?.options) && options.options.length > 0
      ? 'widget'
      : 'empty-combo'
  }
  return options?.widgetType !== undefined || WIDGET_TYPES.has(rawType)
    ? 'widget'
    : 'socket'
}

function socketType(spec: InputSpec): string {
  const specArray = Array.isArray(spec) ? spec : [spec]
  return String(specArray[0])
}

export function classifyAutoRunnable(
  key: string,
  def: RawNodeDef & { output_node?: boolean },
  synthTypes: ReadonlySet<string>
): AutoRunVerdict {
  const sockets: RequiredSocket[] = []
  for (const [name, spec] of Object.entries(def.input?.required ?? {})) {
    const kind = classifyInput(spec)
    if (kind === 'empty-combo')
      return {
        key,
        verdict: 'NEEDS_MODELS',
        reason: `required combo "${name}" has no options on this backend`
      }
    if (kind === 'socket') {
      const type = socketType(spec)
      // Union-typed sockets ("IMAGE,MASK") accept any member (same semantics
      // isTypeCompatible applies in typePairing), so one synthesizable member
      // makes the socket wireable. Push the MEMBER, not the union string -
      // the chain builder synthesizes a producer for exactly this type.
      const member = type
        .split(',')
        .map((candidate) => candidate.trim())
        .find((candidate) => synthTypes.has(candidate))
      if (member === undefined)
        return {
          key,
          verdict: 'NEEDS_WIRES',
          reason: `required input "${name}" (${type}) has no model-free producer`
        }
      sockets.push({ name, type: member })
    }
  }
  const terminus =
    def.output_node === true
      ? { needsPreviewSink: false, note: 'node is its own terminus' }
      : (def.output ?? []).length > 0
        ? { needsPreviewSink: true, note: 'output 0 -> PreviewAny' }
        : null
  if (!terminus)
    return {
      key,
      verdict: 'NO_OBSERVABLE_OUTPUT',
      reason: 'no outputs and not an OUTPUT_NODE - nothing observable to queue'
    }
  if (sockets.length === 0)
    return {
      key,
      verdict: 'AUTO_RUNNABLE',
      needsPreviewSink: terminus.needsPreviewSink,
      reason: `widgets satisfy all required inputs; ${terminus.note}`
    }
  return {
    key,
    verdict: 'CHAINABLE',
    needsPreviewSink: terminus.needsPreviewSink,
    requiredSockets: sockets,
    reason: `${sockets.length} required socket(s) synthesized from model-free producers; ${terminus.note}`
  }
}

export function planAutoRuns(
  defs: Record<string, RawNodeDef & { output_node?: boolean }>,
  packNodeKeys: string[]
): AutoRunVerdict[] {
  // A producer only counts if the backend actually registers it.
  const synthTypes = new Set(
    Object.entries(SYNTH_PRODUCERS)
      .filter(([, producer]) => producer.nodeType in defs)
      .map(([type]) => type)
  )
  return packNodeKeys.map((key) =>
    classifyAutoRunnable(key, defs[key], synthTypes)
  )
}

// Independent chains per prompt so one bad node fails a batch, not the tier.
export function batchAutoRunnable(
  verdicts: AutoRunVerdict[],
  batchSize: number
): AutoRunVerdict[][] {
  const runnable = verdicts.filter(
    (verdict) =>
      verdict.verdict === 'AUTO_RUNNABLE' || verdict.verdict === 'CHAINABLE'
  )
  return chunk(runnable, batchSize)
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const cloudListValidationOutcome = (
  classType: string,
  inputName: string,
  receivedValue: string
) => {
  const node = escapeRegExp(classType)
  const input = escapeRegExp(inputName)
  const value = escapeRegExp(receivedValue)
  return new RegExp(
    String.raw`^EXECUTION_ERROR \(ServiceError - Failed to send prompt request: request returned error status 400: \{"error":\{"details":"","extra_info":\{\},"message":"Prompt outputs failed validation","type":"prompt_outputs_failed_validation"\},"node_errors":\{"\d+":\{"class_type":"${node}","dependent_outputs":\["\d+"\],"errors":\[\{"details":"${input}: '${value}' is not a valid value","extra_info":\{"input_config":null,"input_name":"${input}","received_value":"${value}"\},"message":"Value not in list","type":"value_not_in_list"\}\]\}\}\}\)$`
  )
}

type AllowedAutoRunFailure = {
  outcomes: Array<string | RegExp>
  reason: string
  requireFailure?: boolean
}

const requiredCloudListValidation = (
  classType: string,
  inputName: string
): AllowedAutoRunFailure => ({
  outcomes: [cloudListValidationOutcome(classType, inputName, 'Select model')],
  reason:
    'the live Cloud node requires a selected model and must return this exact 400 validation diagnostic for the placeholder',
  requireFailure: true
})

// Exact accepted non-pass outcomes. Required failures are deterministic
// cannot-run contracts; the rest are source-proven environment variants.
export const AUTO_RUN_ALLOWED_FAILURES: Record<
  string,
  Record<string, AllowedAutoRunFailure>
> = {
  'ComfyUI-DepthAnythingV3': {
    DownloadAndLoadDepthAnythingV3Model: requiredCloudListValidation(
      'DownloadAndLoadDepthAnythingV3Model',
      'model'
    )
  },
  'ComfyUI-Impact-Pack': {
    ImpactSelectNthItemOfAnyList: {
      outcomes: ['VALIDATION_FAIL'],
      reason:
        'victim, not cause: a background impact-add-queue app.queuePrompt from a queue-control node holds app.processingQueue and the harness submission returns bare false (failed run 31545300324, passed run 31537458068 on the identical commit); tolerated while the emitters sit in AUTO_RUN_EXCLUDE'
    }
  },
  'ComfyUI-Upscaler-Tensorrt': {
    LoadUpscalerTensorrtModel: {
      outcomes: ['TIMEOUT'],
      reason:
        'downloads or builds the TensorRT engine when its model cache is cold and loads it directly when warm'
    }
  },
  'ComfyUI-LivePortraitKJ': {
    LivePortraitLoadCropper: {
      outcomes: [
        /^EXECUTION_ERROR \(LivePortraitLoadCropper: onnxruntime\.capi\.onnxruntime_pybind11_state\.NoSuchFile - \[ONNXRuntimeError\] : 3 : NO_SUCHFILE : Load model from \/app\/comfyui\/models\/liveportrait\/landmark\.onnx failed:Load model \/app\/comfyui\/models\/liveportrait\/landmark\.onnx failed\. File doesn't exist\)$/
      ],
      reason:
        'Cloud state varies: one exact run lacked landmark.onnx while another ran clean'
    }
  },
  'ComfyUI-MimicMotionWrapper': {
    DownloadAndLoadMimicMotionModel: requiredCloudListValidation(
      'DownloadAndLoadMimicMotionModel',
      'model'
    )
  },
  'ComfyUI-SeedVR2_VideoUpscaler': {
    SeedVR2LoadDiTModel: requiredCloudListValidation(
      'SeedVR2LoadDiTModel',
      'model'
    )
  },
  'ComfyUI-UltraShape1': {
    UltraShapeLoadModel: requiredCloudListValidation(
      'UltraShapeLoadModel',
      'checkpoint'
    )
  },
  ComfyUI_LayerStyle_Advance: {
    'LayerMask: ObjectDetectorYOLO8': {
      outcomes: [
        cloudListValidationOutcome(
          'LayerMask: ObjectDetectorYOLO8',
          'yolo_model',
          'yolov8s.pt'
        ),
        cloudListValidationOutcome(
          'LayerMask: ObjectDetectorYOLO8',
          'yolo_model',
          'Select model'
        )
      ],
      reason:
        'Cloud model state varies: exact runs rejected yolov8s.pt and the Select model placeholder'
    },
    'LayerMask: YoloV8Detect': {
      outcomes: [
        cloudListValidationOutcome(
          'LayerMask: YoloV8Detect',
          'yolo_model',
          'yolov8n.pt'
        )
      ],
      reason:
        'Cloud model state varies: one exact run rejected yolov8n.pt while another ran clean'
    }
  },
  'ComfyUI-WanVideoWrapper': {
    LoadNLFModel: requiredCloudListValidation('LoadNLFModel', 'nlf_model'),
    WanVideoLoraSelect: requiredCloudListValidation(
      'WanVideoLoraSelect',
      'lora'
    )
  },
  'audio-separation-nodes-comfyui': {
    AudioSeparation: {
      outcomes: [
        /^EXECUTION_ERROR \(AudioSeparation: RuntimeError - Input type \(float\) and bias type \(double\) should be the same\)$/
      ],
      reason:
        'deployed 1.5.0 produced this exact dtype failure in one exact run while another ran clean'
    },
    AudioSpeedShift: {
      outcomes: [
        /^EXECUTION_ERROR \(AudioSpeedShift: TypeError - Expected complex-valued STFT for phase vocoder, got dtype torch\.complex128\)$/
      ],
      reason:
        'deployed 1.5.0 produced this exact phase-vocoder failure in one exact run while another ran clean'
    },
    AudioTempoMatch: {
      outcomes: [
        /^EXECUTION_ERROR \(AudioTempoMatch: TypeError - Expected complex-valued STFT for phase vocoder, got dtype torch\.complex128\)$/
      ],
      reason:
        'deployed 1.5.0 produced this exact phase-vocoder failure in one exact run while another ran clean'
    }
  },
  'comfyui-animatediff-evolved': {
    ADE_AnimateDiffLoRALoader: requiredCloudListValidation(
      'ADE_AnimateDiffLoRALoader',
      'name'
    ),
    ADE_LoadAnimateDiffModel: requiredCloudListValidation(
      'ADE_LoadAnimateDiffModel',
      'model_name'
    )
  },
  'comfyui-frame-interpolation': {
    'FILM VFI': requiredCloudListValidation('FILM VFI', 'ckpt_name'),
    'RIFE VFI': requiredCloudListValidation('RIFE VFI', 'ckpt_name')
  },
  'comfyui-inpaint-nodes': {
    INPAINT_LoadInpaintModel: requiredCloudListValidation(
      'INPAINT_LoadInpaintModel',
      'model_name'
    )
  },
  'comfyui-segment-anything-2': {
    DownloadAndLoadSAM2Model: requiredCloudListValidation(
      'DownloadAndLoadSAM2Model',
      'model'
    )
  },
  comfyui_ipadapter_plus: {
    IPAdapterModelLoader: requiredCloudListValidation(
      'IPAdapterModelLoader',
      'ipadapter_file'
    )
  },
  'comfyui-rmbg': {
    SAM3Segment: {
      outcomes: ['TIMEOUT'],
      reason:
        'downloads sam3.pt and builds its processor when the Cloud model cache is cold, then reuses both when warm'
    }
  }
}

export function matchesAllowedAutoRunOutcome(
  detail: string,
  outcomes: Array<string | RegExp>
): boolean {
  return outcomes.some((outcome) =>
    typeof outcome === 'string' ? outcome === detail : outcome.test(detail)
  )
}
