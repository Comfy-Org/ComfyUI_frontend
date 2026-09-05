class HowToRating:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"rating": ("HOW_TO_RATING", {"default": 3})}}

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("rating",)
    FUNCTION = "run"
    CATEGORY = "API Examples/Widgets"

    def run(self, rating):
        return (int(rating),)


class HowToTemplateText:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": (
                    "STRING",
                    {
                        "default": "rendered-%date:yyyy-MM-dd%",
                        "multiline": True,
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = "API Examples/Widgets"

    def run(self, text):
        return (text,)


NODE_CLASS_MAPPINGS = {
    "HowToRating": HowToRating,
    "HowToTemplateText": HowToTemplateText,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HowToRating": "How-To: Custom Rating Widget",
    "HowToTemplateText": "How-To: Prompt Serialization",
}
