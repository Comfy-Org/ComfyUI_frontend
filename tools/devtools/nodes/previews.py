from __future__ import annotations

from PIL import Image

import server
from comfy_execution.progress import get_progress_state
from protocol import BinaryEventTypes


class LivePreview:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "red": ("INT", {"default": 0, "min": 0, "max": 255}),
                "display_node": ("STRING", {"default": ""}),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "preview"
    CATEGORY = "DevTools"
    DESCRIPTION = "Sends one solid-color live preview frame for a sibling display node, like a sampler step preview"

    def preview(self, red, display_node, unique_id):
        scope = unique_id.rpartition(":")[0]
        display_node_id = f"{scope}:{display_node}" if scope else display_node
        prompt_server = server.PromptServer.instance
        frame = Image.new("RGB", (64, 64), (red, 0, 0))
        metadata = {
            "node_id": unique_id,
            "prompt_id": get_progress_state().prompt_id,
            "display_node_id": display_node_id,
            "parent_node_id": None,
            "real_node_id": unique_id,
        }
        prompt_server.send_sync(
            BinaryEventTypes.PREVIEW_IMAGE_WITH_METADATA,
            (("JPEG", frame, 64), metadata),
            prompt_server.client_id,
        )
        return ()


NODE_CLASS_MAPPINGS = {
    "DevToolsLivePreview": LivePreview,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DevToolsLivePreview": "Live Preview",
}

__all__ = [
    "LivePreview",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
