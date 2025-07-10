#!/usr/bin/env python3

from html.parser import HTMLParser
import json
import sys

class PricingParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current_provider = None
        self.current_model = None
        self.in_provider = False
        self.in_model = False
        self.in_price = False
        self.pricing_data = {}
        self.temp_text = ''
        self.row_data = []
        self.in_row = False
        self.cell_count = 0
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        class_name = attrs_dict.get('class', '')
        
        if tag == 'tr':
            self.in_row = True
            self.row_data = []
            self.cell_count = 0
            
        elif tag == 'td' and self.in_row:
            self.cell_count += 1
            if 'provider-name' in class_name:
                self.in_provider = True
            elif 'model-name' in class_name:
                self.in_model = True
            elif 'calculation-cell' in class_name:
                self.in_price = True
            
    def handle_data(self, data):
        data = data.strip()
        if not data:
            return
            
        if self.in_provider:
            self.current_provider = data
            self.row_data.append(('provider', data))
        elif self.in_model:
            self.temp_text += data
        elif self.in_price:
            self.row_data.append(('price', data))
        elif self.in_row and self.cell_count > 0:
            # Capture other cell data
            self.row_data.append(('data', data))
                
    def handle_endtag(self, tag):
        if tag == 'td':
            if self.in_model and self.temp_text:
                self.current_model = self.temp_text.strip()
                self.row_data.append(('model', self.current_model))
                self.temp_text = ''
            self.in_provider = False
            self.in_model = False
            self.in_price = False
            
        elif tag == 'tr' and self.in_row:
            # Process complete row
            if self.row_data:
                provider = None
                model = None
                price = None
                
                for type_, value in self.row_data:
                    if type_ == 'provider':
                        provider = value
                    elif type_ == 'model':
                        model = value
                    elif type_ == 'price' and value != '-':
                        price = value
                        
                if model and price:
                    # Use current provider or last known provider
                    if provider:
                        self.current_provider = provider
                    if self.current_provider:
                        if self.current_provider not in self.pricing_data:
                            self.pricing_data[self.current_provider] = {}
                        self.pricing_data[self.current_provider][model] = price
                        
            self.in_row = False
            self.row_data = []

# Read and parse the HTML file
with open('/home/c_byrne/projects/comfyui-frontend-testing/ComfyUI_frontend-clone-12/new-prices/Pricing - ComfyUI.html', 'r', encoding='utf-8') as f:
    content = f.read()
    
parser = PricingParser()
parser.feed(content)

# Print pricing data organized by provider
print("=== PRICING DATA FROM HTML ===\n")
for provider, models in sorted(parser.pricing_data.items()):
    if provider and models:
        print(f'\n{provider}:')
        for model, price in sorted(models.items()):
            if model:
                print(f'  {model}: {price}')

# Also save to JSON for easier processing
with open('/home/c_byrne/projects/comfyui-frontend-testing/ComfyUI_frontend-clone-12/pricing_data.json', 'w') as f:
    json.dump(parser.pricing_data, f, indent=2)
    
print("\n\nPricing data saved to pricing_data.json")