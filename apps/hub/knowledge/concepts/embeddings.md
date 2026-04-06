# Textual Embeddings

Textual embeddings are learned text representations that encode specific concepts, styles, or objects into the CLIP text encoder's vocabulary. These tiny files (~10–100 KB) effectively add new "words" to your prompt vocabulary, letting you reference complex visual concepts — a particular art style, a specific character, or a set of undesirable artifacts — with a single token. Because they operate at the text-encoding level, embeddings integrate seamlessly with your existing prompts and require no changes to the model itself.

## How It Works in ComfyUI

- Key nodes: `CLIPTextEncode` — reference embeddings directly in your prompt text using the syntax `embedding:name_of_embedding`
- Typical workflow pattern: Place embedding files in `ComfyUI/models/embeddings/` → type `embedding:name_of_embedding` inside your positive or negative prompt in a `CLIPTextEncode` node → connect to sampler as usual

## Key Settings

- **Prompt weighting**: Embeddings have no dedicated strength slider, but you can adjust their influence with prompt weighting syntax, e.g., `(embedding:name_of_embedding:1.2)` to increase strength or `(embedding:name_of_embedding:0.6)` to soften it
- **Placement**: Add embeddings to the negative prompt to suppress unwanted features, or to the positive prompt to invoke a learned concept

## Tips

- Embeddings are commonly used in negative prompts (e.g., `embedding:EasyNegative`, `embedding:bad-hands-5`) to reduce common artifacts like malformed hands or distorted faces
- Make sure the embedding matches your base model version — an SD 1.5 embedding will not work correctly with an SDXL checkpoint
- You can combine multiple embeddings with regular text in the same prompt for fine-grained control
