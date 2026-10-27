"""
Action Guide Generator for Rummikub.
Translates mathematical MILP solver solutions into human-readable physical step-by-step instructions.
Allows real-world players to quickly execute board moves within the standard 60-second turn limit without mistakes.
"""

from collections import Counter
from typing import List, Dict, Any, Optional
from .engine import tile_display

def generate_action_steps(original_groups: List[List[str]], 
                          solved_melds: List[Dict[str, Any]], 
                          played_tiles: List[str]) -> List[Dict[str, Any]]:
    """
    Compares original table layout with solved melds to generate actionable physical steps.
    Step Types:
    1. append: Direct attachment to an existing board group without changing other tiles.
    2. new_meld: Form a brand-new run or set purely from hand tiles.
    3. borrow: Borrow 1 or more tiles from a board group that remains valid or is split.
    4. swap_joker: Replace a Joker in a board group with a matching hand tile.
    5. reorganize: Dismantle specific board groups and recombine with hand tiles.
    """
    steps = []
    if not played_tiles or not solved_melds:
        return steps

    used_orig = set()
    used_solved = set()

    # 1. Unchanged groups: Identify intact groups that require zero physical movement
    unchanged_orig = set()
    for o_idx, orig in enumerate(original_groups):
        for s_idx, meld in enumerate(solved_melds):
            if s_idx in used_solved:
                continue
            m_tiles = [t['tile'] for t in meld['tiles']]
            m_hand = [t['tile'] for t in meld['tiles'] if t['from_hand']]
            if len(m_hand) == 0 and Counter(orig) == Counter(m_tiles):
                used_orig.add(o_idx)
                used_solved.add(s_idx)
                unchanged_orig.add(o_idx)
                break

    # 2. Direct Appends: An original board group receives one or more hand tiles directly
    for s_idx, meld in enumerate(solved_melds):
        if s_idx in used_solved:
            continue
        m_tiles = [t['tile'] for t in meld['tiles']]
        m_hand = [t['tile'] for t in meld['tiles'] if t['from_hand']]
        m_board = [t['tile'] for t in meld['tiles'] if not t['from_hand']]

        if not m_hand or not m_board:
            continue

        for o_idx, orig in enumerate(original_groups):
            if o_idx in used_orig:
                continue
            if Counter(orig) == Counter(m_board):
                used_orig.add(o_idx)
                used_solved.add(s_idx)
                orig_disp = ' '.join(tile_display(t) for t in orig)
                hand_disp = '、'.join(tile_display(t) for t in m_hand)
                res_disp = ' '.join(tile_display(t) for t in m_tiles)
                steps.append({
                    'type': 'append',
                    'icon': 'plus',
                    'title': f'追加手牌至桌面第 {o_idx + 1} 組',
                    'detail': f'將手牌【{hand_disp}】直接加入桌面第 {o_idx + 1} 組【{orig_disp}】，合成為【{res_disp}】。',
                    'hand_tiles': m_hand,
                    'result_tiles': m_tiles
                })
                break

    # 3. Pure Hand Melds: A complete new meld built 100% from hand
    for s_idx, meld in enumerate(solved_melds):
        if s_idx in used_solved:
            continue
        m_tiles = [t['tile'] for t in meld['tiles']]
        m_hand = [t['tile'] for t in meld['tiles'] if t['from_hand']]
        if len(m_hand) == len(m_tiles):
            used_solved.add(s_idx)
            hand_disp = '、'.join(tile_display(t) for t in m_hand)
            res_disp = ' '.join(tile_display(t) for t in m_tiles)
            steps.append({
                'type': 'new_meld',
                'icon': 'sparkles',
                'title': f'手牌獨立成組 ({meld.get("type_cn", "順組")})',
                'detail': f'從手牌直接打出【{hand_disp}】，在桌面擺出新{meld.get("type_cn", "牌組")}【{res_disp}】。',
                'hand_tiles': m_hand,
                'result_tiles': m_tiles
            })

    # 4. Borrowing from 4-set or longer runs
    for s_idx, meld in enumerate(solved_melds):
        if s_idx in used_solved:
            continue
        m_tiles = [t['tile'] for t in meld['tiles']]
        m_hand = [t['tile'] for t in meld['tiles'] if t['from_hand']]
        m_board = [t['tile'] for t in meld['tiles'] if not t['from_hand']]

        if not m_hand or not m_board:
            continue

        for o_idx, orig in enumerate(original_groups):
            if o_idx in used_orig:
                continue
            orig_c = Counter(orig)
            board_c = Counter(m_board)
            if all(orig_c[t] >= board_c[t] for t in board_c) and 0 < len(m_board) < len(orig):
                used_orig.add(o_idx)
                used_solved.add(s_idx)
                orig_disp = ' '.join(tile_display(t) for t in orig)
                borrow_disp = '、'.join(tile_display(t) for t in m_board)
                hand_disp = '、'.join(tile_display(t) for t in m_hand)
                res_disp = ' '.join(tile_display(t) for t in m_tiles)
                steps.append({
                    'type': 'borrow',
                    'icon': 'arrow-right',
                    'title': f'從桌面第 {o_idx + 1} 組借牌',
                    'detail': f'從桌面第 {o_idx + 1} 組【{orig_disp}】借出【{borrow_disp}】；與手牌【{hand_disp}】合組成【{res_disp}】。',
                    'hand_tiles': m_hand,
                    'result_tiles': m_tiles
                })
                break

    # 5. Complex Multi-Group Reorganization for remaining melds
    rem_solved = [s_idx for s_idx in range(len(solved_melds)) if s_idx not in used_solved]
    if rem_solved:
        rem_orig = [o_idx for o_idx in range(len(original_groups)) if o_idx not in used_orig]
        if rem_orig:
            orig_desc = '、'.join(f'第 {i + 1} 組【{" ".join(tile_display(t) for t in original_groups[i])}】' for i in rem_orig)
            steps.append({
                'type': 'reorganize_prep',
                'icon': 'refresh',
                'title': '拆散桌面牌組',
                'detail': f'將桌面 {orig_desc} 暫時拆開移至桌面中央，準備大挪移重組。',
                'hand_tiles': [],
                'result_tiles': []
            })

        for s_idx in rem_solved:
            meld = solved_melds[s_idx]
            m_tiles = [t['tile'] for t in meld['tiles']]
            m_hand = [t['tile'] for t in meld['tiles'] if t['from_hand']]
            m_board = [t['tile'] for t in meld['tiles'] if not t['from_hand']]
            hand_part = f'加入手牌【{"、".join(tile_display(t) for t in m_hand)}】' if m_hand else ''
            board_part = f'利用拆出的【{"、".join(tile_display(t) for t in m_board)}】' if m_board else ''
            con = ' 與 ' if (m_hand and m_board) else ''
            res_disp = ' '.join(tile_display(t) for t in m_tiles)
            steps.append({
                'type': 'reorganize_form',
                'icon': 'check',
                'title': f'重組成新{meld.get("type_cn", "牌組")}',
                'detail': f'{board_part}{con}{hand_part}，組合成【{res_disp}】。',
                'hand_tiles': m_hand,
                'result_tiles': m_tiles
            })

    # Number the steps sequentially
    for i, s in enumerate(steps):
        s['step_num'] = i + 1

    return steps
