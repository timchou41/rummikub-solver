"""
Optional Gemini Vision API tile recognizer.
Provides zero-shot multimodal recognition for complex/shadowed photos of Rummikub boards.
"""

import os
import json
import base64
import urllib.request
import urllib.error
from typing import Dict, Any, List

PROMPT = """
You are an expert Rummikub (拉密) tile referee and computer vision specialist.
Look at this image of Rummikub tiles on the table.
Identify every single tile clearly visible in the image.

Standard Rummikub tiles:
- Colors: 'R' (Red/紅), 'B' (Blue/藍), 'Y' (Yellow or Orange/黃), 'K' (Black/黑)
- Numbers: 1 to 13
- Joker: 'J' (Smile face / 百搭)

Return STRICTLY a JSON object with this schema:
{
  "tiles": [
    {"tile": "R7", "color": "R", "value": 7, "is_joker": false},
    {"tile": "B10", "color": "B", "value": 10, "is_joker": false},
    {"tile": "J", "color": "J", "value": 0, "is_joker": true}
  ],
  "melds_description": "Optional short summary of the observed groups on the table in Traditional Chinese"
}
Do not wrap in Markdown fences if possible, or return pure JSON.
"""

def call_gemini_vision(image_base64: str, api_key: str) -> Dict[str, Any]:
    """Call Gemini Flash API to detect tiles"""
    if not api_key:
        return {'success': False, 'error': '未提供 Gemini API Key'}

    # Clean base64
    mime_type = "image/jpeg"
    if image_base64.startswith("data:"):
        header, encoded = image_base64.split(",", 1)
        if "png" in header:
            mime_type = "image/png"
        elif "webp" in header:
            mime_type = "image/webp"
    else:
        encoded = image_base64

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": PROMPT},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": encoded
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1
        }
    }

    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read().decode('utf-8')
            resp_json = json.loads(resp_body)
            candidates = resp_json.get('candidates', [])
            if not candidates:
                return {'success': False, 'error': 'Gemini 未返回辨識結果'}

            raw_text = candidates[0]['content']['parts'][0]['text']
            parsed = json.loads(raw_text)

            tiles = parsed.get('tiles', [])
            COLOR_NAMES = {'R': '紅', 'B': '藍', 'Y': '黃', 'K': '黑', 'J': '百搭'}
            for idx, t in enumerate(tiles):
                t['id'] = f'gemini_tile_{idx}'
                c = t.get('color', 'K')
                v = t.get('value', 0)
                t['display'] = COLOR_NAMES.get(c, c) + (str(v) if not t.get('is_joker') else '')

            return {
                'success': True,
                'tiles': tiles,
                'melds_description': parsed.get('melds_description', ''),
                'source': 'gemini_vision'
            }

    except urllib.error.HTTPError as e:
        error_msg = e.read().decode('utf-8')
        return {'success': False, 'error': f'Gemini API 請求錯誤: {e.code} - {error_msg}'}
    except Exception as e:
        return {'success': False, 'error': f'辨識異常: {str(e)}'}
