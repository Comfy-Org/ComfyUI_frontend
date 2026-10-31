from pathlib import Path
from types import SimpleNamespace

import folder_paths
import torch
from safetensors.torch import save_file

from comfy.model_patcher import ModelPatcher
from comfy.sd import CLIP


folder = Path(folder_paths.models_dir) / "loras" / "native-lora-e2e"
folder.mkdir(parents=True, exist_ok=True)
for name, delta in (("A", 1.0), ("B", 2.0), ("C", 4.0)):
    weights = {}
    for prefix in ("diffusion_model", "text_encoders.proj"):
        weights[f"{prefix}.lora_up.weight"] = torch.tensor([[delta]])
        weights[f"{prefix}.lora_down.weight"] = torch.ones(1, 1)
    save_file(weights, str(folder / f"{name}.safetensors"))


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
        weight = patcher.patch_weight_to_device(key, return_weight=True)
        result = torch.nn.functional.linear(torch.ones(1, 1), weight).item()
        return (f"{result:.3f}",)


NODE_CLASS_MAPPINGS = {
    "NativeLoraTestSource": NativeLoraTestSource,
    "NativeLoraTestOutput": NativeLoraTestOutput,
}
