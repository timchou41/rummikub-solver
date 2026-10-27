"""
Key Tiles Analysis for Rummikub.
Computes:
1. Winning Key Tiles (一進聽/胡牌關鍵牌): Tiles that enable emptying all hand tiles immediately.
2. Breakthrough Draw Tiles (出牌突破關鍵牌): Tiles that unlock playing the most hand tiles.
3. Hand Waiting Melds (手牌成組聽牌分析): Local 2-tile or 3-tile meld combinations waiting for specific cards.
"""

from collections import Counter
from typing import List, Dict, Any, Tuple
from .engine import RummikubEngine, COLORS, COLOR_NAMES, tile_display, tile_value

ALL_53_TILES = [f'{c}{v}' for c in COLORS for v in range(1, 14)] + ['J']

def analyze_key_tiles(engine: RummikubEngine, board: List[str], hand: List[str], 
                      initial_meld: bool = False) -> Dict[str, Any]:
    """
    Comprehensive analysis of key tiles to win or advance the game.
    """
    hand_counter = Counter(hand)
    board_counter = Counter(board)
    pool_counter = hand_counter + board_counter

    # 1. Check if player can already win right now
    can_win_now, win_sol = engine.can_win_immediately(board, hand, initial_meld=initial_meld)
    if can_win_now and len(hand) > 0:
        return {
            'can_win_now': True,
            'message': '🔥 當前手牌已經可以全部出完獲勝！',
            'winning_tiles': [],
            'breakthrough_tiles': [],
            'hand_waiting_melds': find_hand_waiting_melds(hand)
        }

    # 2. Winning Key Tiles (1-tile away / 一進聽)
    # Test every possible card t in the game
    winning_tiles = []
    breakthrough_candidates = []

    # Solve current turn without drawing to know baseline
    current_solve = engine.solve(board, hand, initial_meld=initial_meld)
    baseline_played_count = len(current_solve['played_tiles']) if current_solve['can_play'] else 0

    for t in ALL_53_TILES:
        # Check standard deck tile limits: standard game has max 2 of each tile, max 2 jokers
        limit = 2
        if pool_counter[t] >= limit:
            continue

        test_hand = hand + [t]
        
        # Test direct win with t
        win_possible, win_detail = engine.can_win_immediately(board, test_hand, initial_meld=initial_meld)
        if win_possible:
            winning_tiles.append({
                'tile': t,
                'display': tile_display(t),
                'color': t[0] if t != 'J' else 'J',
                'value': tile_value(t),
                'melds_summary': [m['canonical_tiles'] for m in win_detail['melds']] if win_detail else []
            })
            continue  # It's already a winning tile

        # If not direct win, test breakthrough capability
        # How many original hand tiles can be played if drawing t?
        t_solve = engine.solve(board, test_hand, initial_meld=initial_meld)
        if t_solve['can_play']:
            # Count played tiles excluding the drawn tile t
            played_counter = Counter(t_solve['played_tiles'])
            # Reduce 1 copy of t from played count if t was played
            if played_counter[t] > 0:
                played_counter[t] -= 1
            
            orig_hand_played = sum(played_counter.values())
            net_gain = orig_hand_played - baseline_played_count

            if net_gain > 0 or (baseline_played_count == 0 and orig_hand_played > 0):
                breakthrough_candidates.append({
                    'tile': t,
                    'display': tile_display(t),
                    'color': t[0] if t != 'J' else 'J',
                    'value': tile_value(t),
                    'orig_hand_played': orig_hand_played,
                    'net_gain': net_gain,
                    'played_tiles': [tile_display(x) for x in t_solve['played_tiles']]
                })

    # Sort breakthrough tiles by net gain descending, then orig_hand_played descending
    breakthrough_candidates.sort(key=lambda x: (x['net_gain'], x['orig_hand_played']), reverse=True)

    # 3. Hand waiting meld analysis (independent of board)
    hand_waiting = find_hand_waiting_melds(hand)

    return {
        'can_win_now': False,
        'winning_tiles': winning_tiles,
        'winning_count': len(winning_tiles),
        'breakthrough_tiles': breakthrough_candidates[:10],  # Top 10 breakthrough tiles
        'hand_waiting_melds': hand_waiting
    }

def find_hand_waiting_melds(hand: List[str]) -> List[Dict[str, Any]]:
    """
    Analyze incomplete melds inside hand tiles (e.g. 2 consecutive cards, gap cards, pairs of same number).
    """
    hand_counter = Counter(hand)
    results = []

    # 1. Runs (順組搭子)
    for c in COLORS:
        present_values = sorted([int(t[1:]) for t in hand if t.startswith(c)])
        val_set = set(present_values)

        # Consecutive pairs: [v, v+1]
        for v in present_values:
            if (v + 1) in val_set:
                needed = []
                if v - 1 >= 1:
                    needed.append(f'{c}{v-1}')
                if v + 2 <= 13:
                    needed.append(f'{c}{v+2}')
                if needed:
                    results.append({
                        'type': 'run',
                        'type_cn': '雙向順組搭子' if len(needed) == 2 else '邊張順組搭子',
                        'current_tiles': [f'{c}{v}', f'{c}{v+1}'],
                        'current_display': f"{tile_display(f'{c}{v}')} - {tile_display(f'{c}{v+1}')}",
                        'needed_tiles': needed,
                        'needed_display': [tile_display(x) for x in needed],
                        'description': f"缺少 {' 或 '.join([tile_display(x) for x in needed])} 即可成 3 張順組"
                    })

            # Gaps: [v, v+2]
            if (v + 2) in val_set and (v + 1) not in val_set:
                needed = [f'{c}{v+1}']
                results.append({
                    'type': 'run_gap',
                    'type_cn': '中洞順組搭子',
                    'current_tiles': [f'{c}{v}', f'{c}{v+2}'],
                    'current_display': f"{tile_display(f'{c}{v}')} 與 {tile_display(f'{c}{v+2}')}",
                    'needed_tiles': needed,
                    'needed_display': [tile_display(x) for x in needed],
                    'description': f"缺少中間的 {tile_display(needed[0])} 即可成順組"
                })

    # 2. Sets (群組搭子 - 相同數字不同顏色)
    num_to_colors: Dict[int, List[str]] = {}
    for t in hand:
        if t != 'J':
            c, v = t[0], int(t[1:])
            num_to_colors.setdefault(v, []).append(c)

    for v, colors_list in num_to_colors.items():
        unique_colors = sorted(list(set(colors_list)))
        if len(unique_colors) == 2:
            needed = [f'{c}{v}' for c in COLORS if c not in unique_colors]
            results.append({
                'type': 'set',
                'type_cn': '對子群組搭子',
                'current_tiles': [f'{c}{v}' for c in unique_colors],
                'current_display': ' + '.join([tile_display(f'{c}{v}') for c in unique_colors]),
                'needed_tiles': needed,
                'needed_display': [tile_display(x) for x in needed],
                'description': f"缺少 {' 或 '.join([tile_display(x) for x in needed])} 即可成 3 張群組"
            })
        elif len(unique_colors) == 3:
            needed = [f'{c}{v}' for c in COLORS if c not in unique_colors]
            results.append({
                'type': 'set_extend',
                'type_cn': '成組待擴充 (3張群組)',
                'current_tiles': [f'{c}{v}' for c in unique_colors],
                'current_display': ' + '.join([tile_display(f'{c}{v}') for c in unique_colors]),
                'needed_tiles': needed,
                'needed_display': [tile_display(x) for x in needed],
                'description': f"已成 3 張群組，可補 {tile_display(needed[0])} 成 4 張群組"
            })

    return results
