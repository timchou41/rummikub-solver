"""
Generate reference digit templates for Rummikub offline recognition.
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def generate_templates(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    font_path = r'C:\Windows\Fonts\arialbd.ttf' # Arial Bold
    if not os.path.exists(font_path):
        font_path = r'C:\Windows\Fonts\arial.ttf'

    font = ImageFont.truetype(font_path, 64)

    for num in range(1, 14):
        text = str(num)
        # Create white canvas
        img = Image.new('L', (80, 80), color=255)
        draw = ImageDraw.Draw(img)
        
        # Get bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        
        # Center text
        x = (80 - w) // 2 - bbox[0]
        y = (80 - h) // 2 - bbox[1]
        draw.text((x, y), text, font=font, fill=0)

        # Convert to numpy binary image (white text on black background for template match)
        arr = np.array(img)
        binary = np.where(arr < 128, 255, 0).astype(np.uint8)

        # Save template
        save_path = os.path.join(output_dir, f'{num}.png')
        cv2.imwrite(save_path, binary)

    print(f"Generated 13 templates in {output_dir}")

if __name__ == '__main__':
    cur_dir = os.path.dirname(os.path.abspath(__file__))
    tpl_dir = os.path.join(cur_dir, 'templates')
    generate_templates(tpl_dir)
