import type { Model } from '../config/models'

function isCloudOnly(model: Model): boolean {
  return !model.huggingFaceUrl
}

export function getWhatIsDescription(model: Model, dirDesc: string): string {
  if (isCloudOnly(model)) {
    return `${model.displayName} is ${dirDesc}. You can access it through Comfy Cloud. ComfyUI's node-based workflow editor lets you connect ${model.displayName} with ControlNets, LoRAs, upscalers, and custom nodes to build any pipeline you need. There are ${model.workflowCount} community workflow templates using ${model.displayName} on Comfy Workflows, ready to load and customize.`
  }
  return `${model.displayName} is ${dirDesc}. You can run it locally in ComfyUI with full control over every parameter, or access it through Comfy Cloud. ComfyUI's node-based workflow editor lets you connect ${model.displayName} with ControlNets, LoRAs, upscalers, and custom nodes to build any pipeline you need. There are ${model.workflowCount} community workflow templates using ${model.displayName} on Comfy Workflows, ready to load and customize.`
}

export function getPageDescription(model: Model): string {
  if (isCloudOnly(model)) {
    return `Run ${model.displayName} in ComfyUI. ${model.workflowCount} community workflow templates and step-by-step tutorials.`
  }
  return `Run ${model.displayName} in ComfyUI with full parameter control. ${model.workflowCount} community workflow templates, step-by-step tutorials, and free local inference.`
}

export function getFaqPricingAnswer(model: Model): string {
  if (isCloudOnly(model)) {
    return `This model runs exclusively on Comfy Cloud. Pay-per-compute pricing applies - see comfy.org/cloud/pricing`
  }
  return `ComfyUI is free and open source. ${
    model.huggingFaceUrl
      ? `${model.displayName} weights are available to download from Hugging Face.`
      : `${model.displayName} is available as a cloud API through Comfy Cloud.`
  } You only pay for compute when running on Comfy Cloud; local inference on your own hardware is always free.`
}
