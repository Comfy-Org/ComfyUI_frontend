"""Small CPU endpoints for exercising the real native LoRA loaders."""
from types import SimpleNamespace

import torch

from comfy.model_patcher import ModelPatcher
from comfy.sd import CLIP


class NativeLoraTestSource:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ("MODEL", "CLIP")
    FUNCTION = "create"
    CATEGORY = "testing"

    def create(self):
        model = torch.nn.Module()
        model.diffusion_model = torch.nn.Linear(1, 1, bias=False)
        model.diffusion_model.weight = torch.nn.Parameter(torch.ones(1, 1))
        model.model_config = SimpleNamespace(unet_config={})
        device = torch.device("cpu")
        patcher = ModelPatcher(model, load_device=device, offload_device=device)

        clip = CLIP(no_init=True)
        clip.cond_stage_model = torch.nn.Module()
        clip.cond_stage_model.proj = torch.nn.Linear(1, 1, bias=False)
        clip.cond_stage_model.proj.weight = torch.nn.Parameter(torch.ones(1, 1))
        clip.patcher = ModelPatcher(clip.cond_stage_model, load_device=device, offload_device=device)
        clip.tokenizer = None
        clip.layer_idx = None
        clip.tokenizer_options = {}
        clip.use_clip_schedule = False
        clip.apply_hooks_to_conds = None
        return (patcher, clip)


class NativeLoraTestOutput:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}, "optional": {"model": ("MODEL",), "clip": ("CLIP",)}}

    RETURN_TYPES = ("STRING",)
    FUNCTION = "read"
    CATEGORY = "testing"

    def read(self, model=None, clip=None):
        patcher = model if model is not None else clip.patcher
        key = "diffusion_model.weight" if model is not None else "proj.weight"
        # Apply the actual patches without mutating the cached source model.
        weight = patcher.patch_weight_to_device(key, return_weight=True)
        result = torch.nn.functional.linear(torch.ones(1, 1), weight).item()
        return (f"{result:.3f}",)


NODE_CLASS_MAPPINGS = {
    "NativeLoraTestSource": NativeLoraTestSource,
    "NativeLoraTestOutput": NativeLoraTestOutput,
}
