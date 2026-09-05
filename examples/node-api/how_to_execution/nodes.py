from aiohttp import web
from nodes import LoadImage
from server import PromptServer


class HowToMaskEditor(LoadImage):
    CATEGORY = "API Examples/Execution"


class HowToTextOutput:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": (
                    "STRING",
                    {"default": "Run this node", "multiline": True},
                )
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "API Examples/Execution"

    def run(self, text):
        return {"ui": {"text": [text]}, "result": ()}


@PromptServer.instance.routes.get("/how-to-api/ping")
async def ping(_request):
    return web.json_response({"ok": True, "message": "Hello from Python"})


@PromptServer.instance.routes.post("/how-to-api/event")
async def emit_event(request):
    body = await request.json()
    message = str(body.get("message", "Hello from a backend event"))
    PromptServer.instance.send_sync("how-to-api-event", {"message": message})
    return web.json_response({"ok": True})


NODE_CLASS_MAPPINGS = {
    "HowToMaskEditor": HowToMaskEditor,
    "HowToTextOutput": HowToTextOutput,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HowToMaskEditor": "How-To: Mask Editor Image",
    "HowToTextOutput": "How-To: Text Output",
}
