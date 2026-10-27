"""
OpenCV-based Rummikub Tile Detector and Color/Number Classifier.
Works completely offline without external APIs or heavy dependencies.
"""

import os
import cv2
import numpy as np
import base64
from typing import List, Dict, Any, Tuple, Optional

COLOR_NAMES = {'R': '紅', 'B': '藍', 'Y': '黃', 'K': '黑', 'J': '百搭'}
COLOR_BGR = {
    'R': (40, 40, 220),    # Red
    'B': (220, 100, 30),   # Blue
    'Y': (20, 180, 240),   # Yellow / Orange
    'K': (40, 40, 40),     # Black
    'J': (180, 50, 200)    # Joker (Purple)
}

class TileDetector:
    def __init__(self, templates_dir: Optional[str] = None):
        if templates_dir is None:
            templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
        self.templates_dir = templates_dir
        self.templates: Dict[int, np.ndarray] = {}
        self._load_templates()

    def _load_templates(self):
        """Load 1-13 binary digit templates"""
        if not os.path.exists(self.templates_dir):
            return
        for num in range(1, 14):
            path = os.path.join(self.templates_dir, f'{num}.png')
            if os.path.exists(path):
                tpl = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
                if tpl is not None:
                    self.templates[num] = tpl

    def classify_color(self, ink_roi: np.ndarray, ink_mask: np.ndarray) -> Tuple[str, float]:
        """
        Classify ink color (Red, Blue, Yellow, Black) using HSV color space.
        """
        if np.count_nonzero(ink_mask) < 20:
            return 'K', 0.5

        hsv = cv2.cvtColor(ink_roi, cv2.COLOR_BGR2HSV)
        h_vals = hsv[:, :, 0][ink_mask > 0]
        s_vals = hsv[:, :, 1][ink_mask > 0]
        v_vals = hsv[:, :, 2][ink_mask > 0]

        mean_s = np.mean(s_vals)
        mean_v = np.mean(v_vals)

        # If saturation is low or brightness is very low, it's Black
        if mean_s < 45 or mean_v < 60:
            return 'K', 0.85

        # Saturation is significant -> chromatic color
        # Blue in OpenCV HSV: H in [90, 135]
        # Yellow in OpenCV HSV: H in [18, 45]
        # Red in OpenCV HSV: H in [0, 15] or [165, 180]
        blue_mask = (h_vals >= 90) & (h_vals <= 135)
        yellow_mask = (h_vals >= 16) & (h_vals <= 45)
        red_mask = (h_vals <= 12) | (h_vals >= 165)

        blue_ratio = np.mean(blue_mask)
        yellow_ratio = np.mean(yellow_mask)
        red_ratio = np.mean(red_mask)

        scores = {'B': blue_ratio, 'Y': yellow_ratio, 'R': red_ratio}
        best_color = max(scores, key=scores.get)
        confidence = float(scores[best_color])

        # If none of the colors have strong predominance, fallback to Black or highest score
        if confidence < 0.35:
            if mean_s < 70:
                return 'K', 0.7
            return best_color, 0.5

        return best_color, min(0.98, confidence + 0.3)

    def recognize_digit(self, binary_digit: np.ndarray) -> Tuple[int, float]:
        """
        Match binary digit ROI with pre-rendered templates 1-13 using TM_CCOEFF_NORMED.
        """
        if not self.templates:
            return 1, 0.5

        best_num = 1
        best_score = -1.0

        target_h, target_w = binary_digit.shape[:2]
        if target_h < 10 or target_w < 5:
            return 1, 0.3

        # Normalize target digit size to ~50px height
        scale = 50.0 / target_h
        resized_target = cv2.resize(binary_digit, (max(10, int(target_w * scale)), 50))

        for num, tpl in self.templates.items():
            # Resize template to match target height
            th, tw = tpl.shape[:2]
            scaled_tpl_w = max(5, int(tw * (50.0 / th)))
            scaled_tpl = cv2.resize(tpl, (scaled_tpl_w, 50))

            # Make canvas same width
            max_w = max(resized_target.shape[1], scaled_tpl.shape[1])
            pad_target = np.zeros((50, max_w), dtype=np.uint8)
            pad_tpl = np.zeros((50, max_w), dtype=np.uint8)

            t_x = (max_w - resized_target.shape[1]) // 2
            tpl_x = (max_w - scaled_tpl.shape[1]) // 2

            pad_target[:, t_x:t_x + resized_target.shape[1]] = resized_target
            pad_tpl[:, tpl_x:tpl_x + scaled_tpl.shape[1]] = scaled_tpl

            res = cv2.matchTemplate(pad_target, pad_tpl, cv2.TM_CCOEFF_NORMED)
            score = float(res[0][0])

            if score > best_score:
                best_score = score
                best_num = num

        return best_num, max(0.4, min(0.99, best_score))

    def detect_tiles(self, image_input: Any) -> Dict[str, Any]:
        """
        Detect tiles from image (file path, bytes, or numpy array).
        Returns detected tiles list and base64 annotated image.
        """
        # Load image
        if isinstance(image_input, str):
            if os.path.exists(image_input):
                img = cv2.imread(image_input)
            elif image_input.startswith('data:image'):
                # Base64 string
                header, encoded = image_input.split(',', 1)
                img_data = base64.b64decode(encoded)
                nparr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            else:
                img_data = base64.b64decode(image_input)
                nparr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif isinstance(image_input, bytes):
            nparr = np.frombuffer(image_input, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif isinstance(image_input, np.ndarray):
            img = image_input
        else:
            raise ValueError("Unsupported image input type")

        if img is None:
            return {'success': False, 'error': '無法讀取或解碼圖片', 'tiles': []}

        h, w = img.shape[:2]
        # Resize if overly large for fast processing
        max_dim = 1600
        scale = 1.0
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))
            h, w = img.shape[:2]

        annotated = img.copy()

        # Step 1: Preprocessing & Thresholding to find tiles
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Tiles are typically bright/white rectangular shapes on darker or colored table
        # Try adaptive threshold and Otsu
        _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Morphological close to join tile edges
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel)

        # Step 2: Find tile contours
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        img_area = h * w
        min_tile_area = img_area * 0.0008  # At least 0.08% of image
        max_tile_area = img_area * 0.15    # At most 15% of image

        detected_tiles = []

        # Sort contours roughly top-to-bottom, left-to-right
        valid_contours = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if min_tile_area <= area <= max_tile_area:
                x, y, bw, bh = cv2.boundingRect(cnt)
                aspect = float(bw) / float(bh)
                # Tiles aspect ratio is ~ 0.5 to 2.2 depending on orientation
                if 0.4 <= aspect <= 2.5:
                    valid_contours.append((cnt, x, y, bw, bh))

        # Sort by y (grid rows) then x
        valid_contours.sort(key=lambda item: (item[2] // 60, item[1]))

        for idx, (cnt, x, y, bw, bh) in enumerate(valid_contours):
            # Crop tile region
            tile_crop = img[y:y+bh, x:x+bw]
            if tile_crop.shape[0] < 15 or tile_crop.shape[1] < 10:
                continue

            # Extract ink pixels (darker than white background)
            tile_gray = cv2.cvtColor(tile_crop, cv2.COLOR_BGR2GRAY)
            tile_mean = np.mean(tile_gray)
            
            # Ink threshold: pixels significantly darker than tile background
            ink_thresh = max(40, tile_mean - 35)
            ink_mask = (tile_gray < ink_thresh).astype(np.uint8) * 255

            # Morphological clean
            ink_mask = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))

            # Find ink bounding box inside tile
            ink_contours, _ = cv2.findContours(ink_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not ink_contours:
                continue

            # Largest ink component (the number or joker)
            largest_ink = max(ink_contours, key=cv2.contourArea)
            ix, iy, iw, ih = cv2.boundingRect(largest_ink)

            if iw < 5 or ih < 10:
                continue

            # Digit binary crop
            digit_crop = ink_mask[iy:iy+ih, ix:ix+iw]

            # Color analysis
            ink_roi = tile_crop[iy:iy+ih, ix:ix+iw]
            color_code, color_conf = self.classify_color(ink_roi, digit_crop)

            # Number analysis
            num_val, num_conf = self.recognize_digit(digit_crop)

            # Check if this might be a Joker
            # Jokers often have circular face / stars / smile or multi-hue ink
            is_joker = False
            if color_conf < 0.4 and num_conf < 0.5:
                # Could be a Joker
                pass

            tile_code = 'J' if is_joker else f'{color_code}{num_val}'
            overall_conf = round(float((color_conf + num_conf) / 2.0), 2)

            detected_tiles.append({
                'id': f'tile_{idx}',
                'tile': tile_code,
                'color': color_code if not is_joker else 'J',
                'value': num_val if not is_joker else 0,
                'is_joker': is_joker,
                'confidence': overall_conf,
                'bbox': [int(x), int(y), int(bw), int(bh)],
                'display': COLOR_NAMES[color_code] + str(num_val) if not is_joker else '百搭'
            })

            # Draw visual annotation
            bgr = COLOR_BGR.get(color_code, (0, 255, 0))
            cv2.rectangle(annotated, (x, y), (x + bw, y + bh), bgr, 2)
            label = f"{COLOR_NAMES.get(color_code, color_code)}{num_val}"
            cv2.rectangle(annotated, (x, max(0, y - 24)), (x + 65, y), bgr, -1)
            cv2.putText(annotated, label, (x + 4, max(18, y - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # Convert annotated image to base64 for web display
        _, buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
        annotated_b64 = "data:image/jpeg;base64," + base64.b64encode(buf).decode('utf-8')

        return {
            'success': True,
            'tiles_count': len(detected_tiles),
            'tiles': detected_tiles,
            'annotated_image': annotated_b64
        }
