#!/usr/bin/env python3
import json
import re

# Load the HTML pricing data
with open('comfyui_pricing.json', 'r') as f:
    html_pricing = json.load(f)

# Current pricing in our codebase (extracted manually from useNodePricing.ts)
current_pricing = {
    'FluxProCannyNode': '$0.05/Run',
    'FluxProDepthNode': '$0.05/Run', 
    'FluxProExpandNode': '$0.05/Run',
    'FluxProFillNode': '$0.05/Run',
    'FluxProUltraImageNode': '$0.06/Run',
    'IdeogramV1': '$0.06',  # base price per image
    'IdeogramV2': '$0.08',  # base price per image
    'IdeogramV3': {'turbo': '$0.03', 'balanced': '$0.06', 'quality': '$0.08'},
    'KlingCameraControlI2VNode': '$0.49/Run',
    'KlingCameraControlT2VNode': '$0.14/Run',
    'KlingTextToVideoNode': {'std': {'5s': '$0.14', '10s': '$0.28'}, 'pro': {'5s': '$0.49', '10s': '$0.98'}},
    'LumaVideoNode': {
        'ray-2': {'540p_5s': '$0.14', '540p_10s': '$0.28', '720p_5s': '$0.28', '720p_10s': '$0.56'},
        'ray-1-6': {'540p_5s': '$0.07', '540p_10s': '$0.14', '720p_5s': '$0.14', '720p_10s': '$0.28'},
        'rayflash-2': {'540p_5s': '$0.05', '540p_10s': '$0.10', '720p_5s': '$0.10', '720p_10s': '$0.20'}
    },
    'MinimaxVideoNode': '$0.43/Run',
    'MoonvalleyTxt2VideoNode': {'5s': '$1.50/Run', '10s': '$3.00/Run'},
    'MoonvalleyImg2VideoNode': {'5s': '$1.50/Run', '10s': '$3.00/Run'},
    'MoonvalleyVideo2VideoNode': {'5s': '$2.25/Run', '10s': '$4.00/Run'},
    'OpenAIDalle2': {'256x256': '$0.016', '512x512': '$0.018', '1024x1024': '$0.02'},
    'OpenAIDalle3': {
        'standard_1024x1024': '$0.04',
        'standard_1024x1792': '$0.08',
        'hd_1024x1024': '$0.08',
        'hd_1024x1792': '$0.12'
    },
    'OpenAIGPTImage1': {'input_image': '$10/1M', 'input_text': '$5/1M', 'output': '$40/1M'},
    'PixverseTextToVideoNode': 'varies',  # Complex pricing
    'PikaLabsVideoNode': 'varies',  # Complex pricing
    'RecraftTextToImageNode': '$0.022',  # base price
    'RecraftImageInpaintingNode': '$0.022',  # base price
    'RecraftRemoveBackgroundNode': '$0.01',
    'RecraftClarity': '$0.004',
    'RecraftGenerativeUpscale': '$0.25',
    'RecraftVectorizeImage': '$0.01',
    'RecraftV3TextToImageNode': '$0.04',  # base price
    'StabilityAICoreTextToImageNode': '$0.03/Run',
    'StabilityAIUltraTextToImageNode': '$0.08/Run',
    'StabilityAISd35TextToImageNode': 'varies',  # $0.035-$0.065
    'VeoVideoGenerationNode': '$0.5/second'
}

# Map our node names to HTML pricing entries
node_mapping = {
    'FluxProCannyNode': ('BFL', 'flux tools (edit, fill, expand, canny)'),
    'FluxProDepthNode': ('BFL', 'flux tools (edit, fill, expand, canny)'),
    'FluxProExpandNode': ('BFL', 'flux tools (edit, fill, expand, canny)'),
    'FluxProFillNode': ('BFL', 'flux tools (edit, fill, expand, canny)'),
    'FluxProUltraImageNode': ('BFL', 'flux-pro-1.1-ultra'),
    'IdeogramV1': ('Ideogram', 'V1_generate'),
    'IdeogramV2': ('Ideogram', 'V2_generate'),
    'IdeogramV3': ('Ideogram', ['V3_generate_TURBO', 'V3_generate_BALANCED', 'V3_generate_QUALITY']),
    'OpenAIDalle2': ('OpenAI', ['dall-e-2, 256×256', 'dall-e-2, 512×512', 'dall-e-2, 1024×1024']),
    'OpenAIDalle3': ('OpenAI', ['dall-e-3, 1024×1024, standard', 'dall-e-3, 1024×1792, standard', 
                                 'dall-e-3, 1024×1024, hd', 'dall-e-3, 1024×1792, hd']),
    'VeoVideoGenerationNode': ('Google', 'veo-2.0-generate-001'),
    'StabilityAICoreTextToImageNode': ('Stability AI', 'v2beta/stable-image/generate/core'),
    'StabilityAIUltraTextToImageNode': ('Stability AI', 'v2beta/stable-image/generate/ultra')
}

print("=== PRICING COMPARISON ===\n")
print("Node Name | Current Price | HTML Price | Status")
print("-" * 70)

issues_found = []

for node_name, mapping in node_mapping.items():
    provider, model_keys = mapping
    
    if provider in html_pricing:
        if isinstance(model_keys, list):
            # Multiple models for this node
            for model_key in model_keys:
                if model_key in html_pricing[provider]:
                    html_price = html_pricing[provider][model_key]
                    print(f"{node_name} ({model_key}): {current_pricing.get(node_name, 'N/A')} | {html_price}")
                    
                    # Simple comparison - check if prices differ
                    if node_name in current_pricing:
                        current = current_pricing[node_name]
                        if isinstance(current, dict):
                            # Skip complex comparisons for now
                            pass
                        elif current.replace('/Run', '') != html_price:
                            issues_found.append(f"{node_name}: Current={current}, Should be={html_price}")
        else:
            # Single model
            if model_keys in html_pricing[provider]:
                html_price = html_pricing[provider][model_keys]
                current = current_pricing.get(node_name, 'N/A')
                status = "✓" if str(current).replace('/Run', '') == html_price else "✗"
                print(f"{node_name}: {current} | {html_price} | {status}")
                
                if status == "✗" and node_name in current_pricing:
                    issues_found.append(f"{node_name}: Current={current}, Should be={html_price}")

print("\n\n=== ISSUES FOUND ===")
for issue in issues_found:
    print(f"- {issue}")

# Check for new nodes in HTML that aren't in our codebase
print("\n\n=== NEW NODES IN HTML (for PR 2) ===")
new_nodes = []
# Check specific providers for video/image generation nodes
for provider in ['RunwayML', 'Tripo', 'Rodin']:
    if provider in html_pricing:
        print(f"\n{provider}:")
        for model, price in html_pricing[provider].items():
            print(f"  {model}: {price}")
            new_nodes.append((provider, model, price))