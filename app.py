"""
Rummikub Solver & Table Vision Web Application.
Built with aiohttp for high performance and zero external web framework dependencies.
"""

import os
import sys
import json
import base64
import logging
from aiohttp import web

# Set up paths
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from solver.engine import RummikubEngine, tile_display, tile_value
from solver.key_tiles import analyze_key_tiles, find_hand_waiting_melds
from vision.detector import TileDetector
from vision.gemini_vision import call_gemini_vision

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Initialize singletons
engine = RummikubEngine()
detector = TileDetector()

PRESETS = [
    {
        'id': 'sets_to_runs_reorg',
        'title': '三色同刻轉順組大挪移 (777 888 999 ＋ 6)',
        'description': '桌面有紅藍黃777、888、999三組同刻，加一張紅6後，系統自動大挪移重組為6789、789、789三組順組！',
        'board': ['R7', 'B7', 'Y7', 'R8', 'B8', 'Y8', 'R9', 'B9', 'Y9'],
        'hand': ['R6']
    },
    {
        'id': 'table_reorganize',
        'title': '經典拆組大挪移 (手牌出完獲勝)',
        'description': '桌面有紅1-5順組與三色5群組，手牌有紅4與紅5，看拉密如何巧妙重組全部出完！',
        'board': ['R1', 'R2', 'R3', 'R4', 'R5', 'B5', 'Y5', 'K5'],
        'hand': ['R4', 'R5']
    },
    {
        'id': 'win_one_step',
        'title': '一進聽聽牌局 (差一張牌胡牌)',
        'description': '手牌差一張關鍵牌即可全數打出獲勝，系統會為你精準算出所有聽牌牌！',
        'board': ['B1', 'B2', 'B3', 'Y7', 'Y8', 'Y9', 'K10', 'K11', 'K12'],
        'hand': ['R5', 'R6', 'B8', 'Y8', 'K8']
    },
    {
        'id': 'icebreak_test',
        'title': '首出破冰限制 (>= 30 分測試)',
        'description': '測試首出需滿 30 分且完全不能觸碰或借用桌面牌的規則。',
        'board': ['B1', 'B2', 'B3', 'B4'],
        'hand': ['R10', 'B10', 'Y10', 'K2']
    },
    {
        'id': 'joker_magic',
        'title': '百搭鬼牌 (Joker) 妙用',
        'description': '利用百搭牌作為關鍵橋樑，快速將難出的單張手牌打出。',
        'board': ['Y4', 'Y5', 'Y6', 'B7', 'Y7', 'K7'],
        'hand': ['Y3', 'J', 'R7']
    }
]

async def handle_index(request):
    """Serve the single-page application index.html"""
    html_path = os.path.join(CURRENT_DIR, 'static', 'index.html')
    return web.FileResponse(html_path)

async def handle_presets(request):
    """Return preset scenarios for quick testing"""
    return web.json_response(PRESETS)

async def handle_solve(request):
    """
    Solve turn calculation endpoint:
    Body: {
        "board": ["R1", "R2", ...],
        "hand": ["R4", "R5", ...],
        "initial_meld": false
    }
    """
    try:
        data = await request.json()
        board = data.get('board', [])
        hand = data.get('hand', [])
        initial_meld = bool(data.get('initial_meld', False))

        logger.info(f"Solve request: Board({len(board)} tiles), Hand({len(hand)} tiles), InitialMeld={initial_meld}")

        # 1. Run main turn solver
        solve_result = engine.solve(board, hand, initial_meld=initial_meld)

        # 2. Run key tiles & waiting melds analysis
        key_tiles_result = analyze_key_tiles(engine, board, hand, initial_meld=initial_meld)

        response_data = {
            'success': True,
            'can_play': solve_result['can_play'],
            'is_win': solve_result['is_win'],
            'played_tiles': solve_result['played_tiles'],
            'played_tiles_display': [tile_display(t) for t in solve_result['played_tiles']],
            'remaining_hand': solve_result['remaining_hand'],
            'remaining_hand_display': [tile_display(t) for t in solve_result['remaining_hand']],
            'melds': solve_result['melds'],
            'points_played': solve_result['points_played'],
            'message': solve_result['message'],
            'analysis': key_tiles_result
        }

        return web.json_response(response_data)

    except Exception as e:
        logger.exception("Error in handle_solve")
        return web.json_response({'success': False, 'error': f"計算錯誤: {str(e)}"}, status=500)

async def handle_reorganize(request):
    """
    Board reorganization endpoint (拉密智能大挪移):
    Finds optimal legal partitioning of board tiles into valid runs and sets.
    Body: { "board": ["R7", "B7", "Y7", "R8", "B8", "Y8", "R9", "B9", "Y9", "R6"] }
    """
    try:
        data = await request.json()
        board = data.get('board', [])
        logger.info(f"Reorganize request for {len(board)} tiles")
        
        result = engine.reorganize_board(board)
        return web.json_response({'success': True, **result})
    except Exception as e:
        logger.exception("Error in handle_reorganize")
        return web.json_response({'success': False, 'error': f"理牌錯誤: {str(e)}"}, status=500)

async def handle_recognize(request):
    """
    Image recognition endpoint:
    Body: {
        "image": "data:image/jpeg;base64,...",
        "method": "opencv" or "gemini",
        "api_key": "..." (optional for Gemini)
    }
    """
    try:
        data = await request.json()
        image_data = data.get('image', '')
        method = data.get('method', 'opencv')
        api_key = data.get('api_key', '').strip()

        if not image_data:
            return web.json_response({'success': False, 'error': '請提供圖片數據'}, status=400)

        logger.info(f"Recognize request using method: {method}")

        if method == 'gemini':
            if not api_key:
                # Try environment variable
                api_key = os.environ.get('GEMINI_API_KEY', '')
            if not api_key:
                return web.json_response({
                    'success': False, 
                    'error': '使用 Gemini AI 辨識請輸入 Gemini API Key，或切換為本機 OpenCV 快速辨識。'
                }, status=400)

            result = call_gemini_vision(image_data, api_key)
            return web.json_response(result)

        else:
            # Local OpenCV detector
            result = detector.detect_tiles(image_data)
            return web.json_response(result)

    except Exception as e:
        logger.exception("Error in handle_recognize")
        return web.json_response({'success': False, 'error': f"辨識錯誤: {str(e)}"}, status=500)

def create_app():
    app = web.Application()
    app.router.add_get('/', handle_index)
    app.router.add_get('/api/presets', handle_presets)
    app.router.add_post('/api/solve', handle_solve)
    app.router.add_post('/api/reorganize', handle_reorganize)
    app.router.add_post('/api/recognize', handle_recognize)

    # Static assets directory
    static_dir = os.path.join(CURRENT_DIR, 'static')
    app.router.add_static('/static/', path=static_dir, name='static')

    return app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"==================================================")
    print(f"  拉密計算神助手 (Rummikub AI Solver)")
    print(f"  服務已啟動！請在瀏覽器打開: http://localhost:{port}")
    print(f"==================================================")
    app = create_app()
    web.run_app(app, host='127.0.0.1', port=port)
