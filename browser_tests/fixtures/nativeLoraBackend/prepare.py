"""Write tiny, real LoRA files into an isolated E2E server's model directory."""
import sys
from pathlib import Path

import torch
from safetensors.torch import save_file


folder = Path(sys.argv[1]) / "models" / "loras" / "native-lora-e2e"
folder.mkdir(parents=True, exist_ok=True)
for name, delta in (("A", 1.0), ("B", 2.0), ("C", 4.0)):
    weights = {}
    for prefix in ("diffusion_model", "text_encoders.proj"):
        weights[f"{prefix}.lora_up.weight"] = torch.tensor([[delta]])
        weights[f"{prefix}.lora_down.weight"] = torch.ones(1, 1)
    save_file(weights, str(folder / f"{name}.safetensors"))
