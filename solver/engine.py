"""
Rummikub Solver Engine using Integer Linear Programming (MILP / HiGHS via SciPy).
Provides mathematically exact, optimal play calculation and board re-organization.
"""

from collections import Counter
from itertools import combinations
from typing import List, Dict, Tuple, Optional, Any
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds

COLORS = ['R', 'B', 'Y', 'K']  # Red, Blue, Yellow, Black
COLOR_NAMES = {
    'R': '紅',
    'B': '藍',
    'Y': '黃',
    'K': '黑',
    'J': '百搭'
}

def tile_display(tile: str) -> str:
    """Friendly Chinese display name for a tile (e.g. 'R7' -> '紅7', 'J' -> '百搭')"""
    if tile == 'J':
        return '百搭'
    if len(tile) >= 2 and tile[0] in COLOR_NAMES:
        return f"{COLOR_NAMES[tile[0]]}{tile[1:]}"
    return tile

def tile_value(tile: str) -> int:
    """Point value of a tile"""
    if tile == 'J':
        return 0  # Dynamic, replaced by context
    return int(tile[1:])

class MeldCandidate:
    def __init__(self, meld_type: str, canonical_tiles: List[str], required_tiles: Counter, 
                 joker_replacements: Dict[str, str], points: int):
        self.meld_type = meld_type  # 'run' or 'set'
        self.canonical_tiles = canonical_tiles  # e.g. ['R1', 'R2', 'R3']
        self.required_tiles = required_tiles    # e.g. Counter({'R1': 1, 'J': 1, 'R3': 1})
        self.joker_replacements = joker_replacements  # e.g. {'R2': 'J'}
        self.points = points  # Sum of face values in this meld

    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': self.meld_type,
            'canonical_tiles': self.canonical_tiles,
            'required_tiles': dict(self.required_tiles),
            'joker_replacements': self.joker_replacements,
            'points': self.points
        }

class RummikubEngine:
    def __init__(self):
        self._all_pure_melds = self._generate_all_pure_melds()

    def _generate_all_pure_melds(self) -> List[Tuple[str, List[str]]]:
        """Generate all 329 possible pure melds in standard Rummikub (no jokers yet)"""
        melds = []
        # Runs: length 3 to 13
        for c in COLORS:
            for s in range(1, 14):
                for e in range(s + 2, 14):
                    melds.append(('run', [f'{c}{v}' for v in range(s, e + 1)]))
        # Sets: size 3 and 4
        for v in range(1, 14):
            for size in (3, 4):
                for combo in combinations(COLORS, size):
                    melds.append(('set', [f'{c}{v}' for c in combo]))
        return melds

    def _generate_candidate_melds_for_pool(self, pool_counter: Counter) -> List[MeldCandidate]:
        """
        Generate only candidate melds that can be constructed using available tiles in pool.
        Supports 0, 1, or 2 Jokers.
        """
        candidates = []
        has_jokers = pool_counter['J']

        for mtype, tiles in self._all_pure_melds:
            pts = sum(tile_value(t) for t in tiles)
            pure_req = Counter(tiles)

            # 0 Jokers
            if all(pool_counter[t] >= pure_req[t] for t in pure_req):
                candidates.append(MeldCandidate(mtype, tiles, pure_req, {}, pts))

            # 1 Joker
            if has_jokers >= 1:
                for rep in tiles:
                    req = Counter(pure_req)
                    req[rep] -= 1
                    if req[rep] == 0:
                        del req[rep]
                    req['J'] += 1
                    if all(pool_counter[t] >= req[t] for t in req):
                        candidates.append(MeldCandidate(mtype, tiles, req, {rep: 'J'}, pts))

            # 2 Jokers (in melds of length >= 3)
            if has_jokers >= 2 and len(tiles) >= 3:
                for rep1, rep2 in combinations(tiles, 2):
                    req = Counter(pure_req)
                    req[rep1] -= 1
                    if req[rep1] == 0:
                        del req[rep1]
                    req[rep2] -= 1
                    if req[rep2] == 0:
                        del req[rep2]
                    req['J'] += 2
                    if all(pool_counter[t] >= req[t] for t in req):
                        candidates.append(MeldCandidate(mtype, tiles, req, {rep1: 'J', rep2: 'J'}, pts))

        return candidates

    def can_win_immediately(self, board: List[str], hand: List[str], initial_meld: bool = False) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """Check if 100% of the hand tiles can be played right now (Rummikub! 獲勝)"""
        if not hand:
            return True, {'played_tiles': [], 'melds': [], 'points': 0}
        
        result = self.solve(board, hand, initial_meld=initial_meld, force_all_hand=True)
        return result['is_win'], result if result['is_win'] else None

    def solve(self, board: List[str], hand: List[str], initial_meld: bool = False, 
              force_all_hand: bool = False, min_hand_tiles: int = 1) -> Dict[str, Any]:
        """
        Solve Rummikub turn using MILP.
        - board: list of tiles already on the table
        - hand: list of tiles in player's hand
        - initial_meld: if True, requires >= 30 points from hand without touching board
        - force_all_hand: if True, checks if all hand tiles can be played (win check)
        - min_hand_tiles: minimum number of hand tiles required to be played (default 1)
        """
        if initial_meld:
            # During initial meld, board tiles cannot be touched/used
            board = []

        pool = board + hand
        pool_counter = Counter(pool)
        candidates = self._generate_candidate_melds_for_pool(pool_counter)

        if not candidates:
            return {
                'can_play': False,
                'is_win': False,
                'played_tiles': [],
                'remaining_hand': list(hand),
                'melds': [],
                'points_played': 0,
                'message': '無法出牌：沒有可組成的合法順組或群組'
            }

        M = len(candidates)
        board_counter = Counter(board)
        hand_counter = Counter(hand)
        unique_tiles = sorted(list(pool_counter.keys()))
        T = len(unique_tiles)
        tile_to_idx = {t: i for i, t in enumerate(unique_tiles)}

        # Variables:
        # x_0 ... x_{M-1}: count of candidate meld used (int >= 0)
        # y_0 ... y_{T-1}: count of hand tile t used (int 0 <= y_t <= hand_counter[t])
        num_vars = M + T

        # Objective:
        # Maximize hand tiles played: -1000 * sum(y)
        # Tie breaker: prefer fewer melds (+1 * sum(x))
        # If initial meld: also prioritize higher points
        c = np.zeros(num_vars)
        for m in range(M):
            c[m] = 1.0  # slight penalty for each meld to keep board compact
        for t_idx, t in enumerate(unique_tiles):
            c[M + t_idx] = -1000.0

        # Equality Constraints:
        # For each tile t: sum_{m} req(m, t) * x_m - y_t = board_counter[t]
        A_eq = np.zeros((T, num_vars))
        for m, cand in enumerate(candidates):
            for t, cnt in cand.required_tiles.items():
                if cnt > 0 and t in tile_to_idx:
                    A_eq[tile_to_idx[t], m] = cnt
        for t_idx, t in enumerate(unique_tiles):
            A_eq[t_idx, M + t_idx] = -1.0

        b_eq = np.array([board_counter[t] for t in unique_tiles], dtype=float)

        constraints_list = []
        constraints_list.append(LinearConstraint(A_eq, b_eq, b_eq))

        # Additional constraints:
        # If force_all_hand: y_t == hand_counter[t] for all t
        # If not force_all_hand: sum(y_t) >= min_hand_tiles (at least 1 tile played)
        if force_all_hand:
            # We enforce this via bounds on y
            pass
        elif min_hand_tiles > 0 and len(hand) > 0:
            # sum(y) >= min_hand_tiles
            A_min_hand = np.zeros((1, num_vars))
            for t_idx in range(T):
                A_min_hand[0, M + t_idx] = 1.0
            constraints_list.append(LinearConstraint(A_min_hand, [min_hand_tiles], [np.inf]))

        # If initial_meld: sum(points of melds) >= 30
        if initial_meld:
            A_pts = np.zeros((1, num_vars))
            for m, cand in enumerate(candidates):
                A_pts[0, m] = cand.points
            constraints_list.append(LinearConstraint(A_pts, [30.0], [np.inf]))

        # Bounds:
        lb = np.zeros(num_vars)
        ub = np.zeros(num_vars)
        ub[:M] = 2.0  # At most 2 of any identical meld configuration
        for t_idx, t in enumerate(unique_tiles):
            if force_all_hand:
                lb[M + t_idx] = hand_counter[t]
                ub[M + t_idx] = hand_counter[t]
            else:
                lb[M + t_idx] = 0.0
                ub[M + t_idx] = hand_counter[t]

        bounds = Bounds(lb, ub)
        integrality = np.ones(num_vars)

        # Solve MILP
        res = milp(c=c, integrality=integrality, constraints=constraints_list, bounds=bounds)

        if not res.success or res.x is None:
            return {
                'can_play': False,
                'is_win': False,
                'played_tiles': [],
                'remaining_hand': list(hand),
                'melds': [],
                'points_played': 0,
                'message': '無法出牌：目前牌面與手牌組合無法出牌' if not initial_meld else '破冰失敗：手牌無法組出大於等於30分的合法牌組'
            }

        sol = np.round(res.x).astype(int)

        # Extract played hand tiles
        played_hand_counter = Counter()
        for t_idx, t in enumerate(unique_tiles):
            used = sol[M + t_idx]
            if used > 0:
                played_hand_counter[t] = used

        played_tiles = []
        for t, cnt in played_hand_counter.items():
            played_tiles.extend([t] * cnt)

        if len(played_tiles) == 0 and len(hand) > 0:
            return {
                'can_play': False,
                'is_win': False,
                'played_tiles': [],
                'remaining_hand': list(hand),
                'melds': [],
                'points_played': 0,
                'message': '手牌無法出牌'
            }

        # Calculate remaining hand
        rem_counter = hand_counter - played_hand_counter
        remaining_hand = []
        for t, cnt in rem_counter.items():
            remaining_hand.extend([t] * cnt)

        is_win = (len(remaining_hand) == 0)

        # Reconstruct melds and annotate source (Hand vs Board)
        chosen_candidates = []
        for m in range(M):
            cnt = sol[m]
            for _ in range(cnt):
                chosen_candidates.append(candidates[m])

        # Track origins for visualization
        # We greedily match played hand tiles to tiles in chosen melds
        avail_hand_source = Counter(played_hand_counter)
        melds_output = []

        total_points = 0
        for cand in chosen_candidates:
            meld_tiles_info = []
            for t in cand.canonical_tiles:
                is_joker_here = (cand.joker_replacements.get(t) == 'J')
                actual_tile_type = 'J' if is_joker_here else t
                
                # Check origin: was it taken from hand?
                from_hand = False
                if avail_hand_source[actual_tile_type] > 0:
                    from_hand = True
                    avail_hand_source[actual_tile_type] -= 1
                    total_points += tile_value(t)

                meld_tiles_info.append({
                    'tile': actual_tile_type,
                    'represents': t if is_joker_here else actual_tile_type,
                    'is_joker': is_joker_here,
                    'from_hand': from_hand,
                    'display': tile_display(actual_tile_type) + (f" (當作{tile_display(t)})" if is_joker_here else "")
                })

            melds_output.append({
                'type': cand.meld_type,
                'type_cn': '順組' if cand.meld_type == 'run' else '群組',
                'points': cand.points,
                'canonical_tiles': cand.canonical_tiles,
                'tiles': meld_tiles_info
            })

        return {
            'can_play': True,
            'is_win': is_win,
            'played_tiles': played_tiles,
            'remaining_hand': remaining_hand,
            'melds': melds_output,
            'points_played': total_points,
            'message': '恭喜！全部手牌可一次打出獲勝 (Rummikub)！' if is_win else ('桌面牌已成功整理成合法牌組！' if len(hand) == 0 else f'成功計算出牌策略！可打出手牌 {len(played_tiles)} 張')
        }

    def reorganize_board(self, board: List[str]) -> Dict[str, Any]:
        """
        Optimal board reorganization (拉密大挪移):
        Given any set of tiles on the board, finds the optimal partitioning
        into valid runs and sets (maximizing tiles in valid melds, minimizing loose tiles).
        Supports Jokers.
        """
        if not board:
            return {
                'can_reorganize': False,
                'all_valid': True,
                'melds': [],
                'unmatched': [],
                'total_tiles': 0,
                'matched_tiles_count': 0
            }

        pool_counter = Counter(board)
        candidates = self._generate_candidate_melds_for_pool(pool_counter)
        if not candidates:
            return {
                'can_reorganize': False,
                'all_valid': False,
                'melds': [],
                'unmatched': list(board),
                'total_tiles': len(board),
                'matched_tiles_count': 0
            }

        M = len(candidates)
        unique_tiles = sorted(list(pool_counter.keys()))
        T = len(unique_tiles)
        tile_to_idx = {t: i for i, t in enumerate(unique_tiles)}

        # Variables:
        # x_0 ... x_{M-1}: count of candidate meld used (int >= 0)
        # w_0 ... w_{T-1}: count of tile t left UNMATCHED (int >= 0)
        num_vars = M + T

        # Objective:
        # Minimize unmatched tiles (penalty 1000 per unmatched tile)
        # Tie breaker: prefer longer melds (slight penalty 1.0 per meld)
        c = np.zeros(num_vars)
        for m in range(M):
            c[m] = 1.0
        for t_idx in range(T):
            c[M + t_idx] = 1000.0

        # Equality Constraints:
        # For each tile t: sum_{m} req(m, t) * x_m + w_t = pool_counter[t]
        A_eq = np.zeros((T, num_vars))
        for m, cand in enumerate(candidates):
            for t, cnt in cand.required_tiles.items():
                if cnt > 0 and t in tile_to_idx:
                    A_eq[tile_to_idx[t], m] = cnt
        for t_idx in range(T):
            A_eq[t_idx, M + t_idx] = 1.0

        b_eq = np.array([pool_counter[t] for t in unique_tiles], dtype=float)
        constraints = [LinearConstraint(A_eq, b_eq, b_eq)]

        lb = np.zeros(num_vars)
        ub = np.zeros(num_vars)
        ub[:M] = 2.0  # At most 2 of any identical meld configuration
        for t_idx, t in enumerate(unique_tiles):
            ub[M + t_idx] = pool_counter[t]

        bounds = Bounds(lb, ub)
        res = milp(c=c, integrality=np.ones(num_vars), constraints=constraints, bounds=bounds)

        if not res.success or res.x is None:
            return {
                'can_reorganize': False,
                'all_valid': False,
                'melds': [],
                'unmatched': list(board),
                'total_tiles': len(board),
                'matched_tiles_count': 0
            }

        sol = np.round(res.x).astype(int)

        # Reconstruct chosen melds
        melds_output = []
        for m in range(M):
            cnt = sol[m]
            if cnt > 0:
                for _ in range(cnt):
                    cand = candidates[m]
                    meld_tiles_info = []
                    for t in cand.canonical_tiles:
                        is_joker_here = (cand.joker_replacements.get(t) == 'J')
                        actual_tile_type = 'J' if is_joker_here else t
                        meld_tiles_info.append({
                            'tile': actual_tile_type,
                            'represents': t if is_joker_here else actual_tile_type,
                            'is_joker': is_joker_here,
                            'display': tile_display(actual_tile_type) + (f" (當作{tile_display(t)})" if is_joker_here else "")
                        })

                    melds_output.append({
                        'type': cand.meld_type,
                        'type_cn': '順組' if cand.meld_type == 'run' else '群組',
                        'points': cand.points,
                        'canonical_tiles': cand.canonical_tiles,
                        'tiles': meld_tiles_info
                    })

        unmatched = []
        for t_idx, t in enumerate(unique_tiles):
            cnt = sol[M + t_idx]
            if cnt > 0:
                unmatched.extend([t] * cnt)

        matched_count = len(board) - len(unmatched)
        all_valid = (len(unmatched) == 0 and len(melds_output) > 0)

        return {
            'can_reorganize': len(melds_output) > 0,
            'all_valid': all_valid,
            'melds': melds_output,
            'unmatched': unmatched,
            'total_tiles': len(board),
            'matched_tiles_count': matched_count
        }
