"""
Unit tests for Rummikub solver engine and key tile analyzer.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
from solver.engine import RummikubEngine
from solver.key_tiles import analyze_key_tiles

class TestRummikubEngine(unittest.TestCase):
    def setUp(self):
        self.engine = RummikubEngine()

    def test_simple_meld_from_hand(self):
        """Test playing a pure run from hand on empty board"""
        board = []
        hand = ['R7', 'R8', 'R9', 'B1']
        res = self.engine.solve(board, hand)
        self.assertTrue(res['can_play'])
        self.assertFalse(res['is_win'])
        self.assertEqual(sorted(res['played_tiles']), ['R7', 'R8', 'R9'])
        self.assertEqual(res['remaining_hand'], ['B1'])

    def test_immediate_win(self):
        """Test hand that completely empties (Win!)"""
        board = ['B1', 'B2', 'B3']
        hand = ['R5', 'B5', 'Y5', 'K5']
        res = self.engine.solve(board, hand)
        self.assertTrue(res['can_play'])
        self.assertTrue(res['is_win'])
        self.assertEqual(len(res['remaining_hand']), 0)

    def test_board_rearrangement(self):
        """Test sophisticated table splitting and manipulation"""
        # Board has: R1-R2-R3-R4-R5 (run of 5)
        # Hand has: R3
        # Valid play: Split R1-R2-R3 and R3-R4-R5 (wait, R3-R4-R5 is length 3, R1-R2-R3 is length 3!)
        board = ['R1', 'R2', 'R3', 'R4', 'R5']
        hand = ['R3']
        res = self.engine.solve(board, hand)
        self.assertTrue(res['can_play'])
        self.assertEqual(res['played_tiles'], ['R3'])
        # Table should now have two runs of 3: R1-R2-R3 and R3-R4-R5
        self.assertEqual(len(res['melds']), 2)

    def test_joker_play(self):
        """Test playing with a Joker"""
        board = ['Y10', 'Y11', 'Y12']
        hand = ['R2', 'J', 'R4']
        res = self.engine.solve(board, hand)
        self.assertTrue(res['can_play'])
        self.assertTrue(res['is_win'])

    def test_key_tiles_winning(self):
        """Test finding key tile that wins the game (一進聽)"""
        # Hand has: R5, R6 (missing R4 or R7 or J to win, assuming board is empty)
        board = ['B1', 'B2', 'B3']
        hand = ['R5', 'R6']
        analysis = analyze_key_tiles(self.engine, board, hand)
        self.assertFalse(analysis['can_win_now'])
        win_tiles = [x['tile'] for x in analysis['winning_tiles']]
        self.assertIn('R4', win_tiles)
        self.assertIn('R7', win_tiles)
        self.assertIn('J', win_tiles)

    def test_initial_meld_rule(self):
        """Test the >= 30 points initial meld rule"""
        board = ['R1', 'R2', 'R3']
        # Hand has [R10, B10, Y10] (points = 30) -> should succeed
        hand1 = ['R10', 'B10', 'Y10']
        res1 = self.engine.solve(board, hand1, initial_meld=True)
        self.assertTrue(res1['can_play'])

        # Hand has [R1, B1, Y1] (points = 3 < 30) -> should fail
        hand2 = ['R1', 'B1', 'Y1']
        res2 = self.engine.solve(board, hand2, initial_meld=True)
        self.assertFalse(res2['can_play'])

    def test_reorganize_777_888_999_plus_6(self):
        """Test board reorganization: 777 888 999 + 6 automatically becomes 6789 789 789"""
        board = ['R7', 'B7', 'Y7', 'R8', 'B8', 'Y8', 'R9', 'B9', 'Y9', 'R6']
        res = self.engine.reorganize_board(board)
        self.assertTrue(res['can_reorganize'])
        self.assertTrue(res['all_valid'])
        self.assertEqual(len(res['unmatched']), 0)
        self.assertEqual(len(res['melds']), 3)
        
        # Verify formed melds are runs
        meld_tuples = [tuple(m['canonical_tiles']) for m in res['melds']]
        self.assertIn(('R6', 'R7', 'R8', 'R9'), meld_tuples)
        self.assertIn(('B7', 'B8', 'B9'), meld_tuples)
        self.assertIn(('Y7', 'Y8', 'Y9'), meld_tuples)

if __name__ == '__main__':
    unittest.main()
