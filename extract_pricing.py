#!/usr/bin/env python3
import re
import json

# Read the HTML file
with open('/home/c_byrne/projects/comfyui-frontend-testing/ComfyUI_frontend-clone-12/new-prices/Pricing - ComfyUI.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract table rows
rows = re.findall(r'<tr>(.*?)</tr>', content, re.DOTALL)

pricing_data = {}
current_provider = None

for row in rows:
    # Extract cells
    cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
    
    if len(cells) >= 3:
        # Clean HTML from cells
        provider = re.sub(r'<[^>]+>', '', cells[0]).strip()
        model = re.sub(r'<[^>]+>', '', cells[1]).strip()
        price = re.sub(r'<[^>]+>', '', cells[2]).strip()
        
        # Skip header rows and empty data
        if provider and model and price and price != 'Price':
            if provider:
                current_provider = provider
            if current_provider:
                if current_provider not in pricing_data:
                    pricing_data[current_provider] = {}
                pricing_data[current_provider][model] = price

# Print specific providers we care about for ComfyUI nodes
comfyui_providers = [
    'BFL', 'Ideogram', 'Kling', 'Luma', 'MiniMax', 'OpenAI', 
    'PixVerse', 'Pika', 'RunwayML', 'Recraft', 'Stability AI',
    'Tripo', 'Rodin', 'Google'
]

print("=== COMFYUI NODE PRICING ===\n")
for provider in comfyui_providers:
    if provider in pricing_data:
        print(f"\n{provider}:")
        for model, price in sorted(pricing_data[provider].items()):
            print(f"  {model}: {price}")

# Save full data to JSON
with open('/home/c_byrne/projects/comfyui-frontend-testing/ComfyUI_frontend-clone-12/comfyui_pricing.json', 'w') as f:
    filtered_data = {p: pricing_data[p] for p in comfyui_providers if p in pricing_data}
    json.dump(filtered_data, f, indent=2)