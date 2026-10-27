/**
 * Rummikub Tile Rendering, Validation, and Utility Functions.
 */

const RK_COLORS = {
    'R': { name: '紅', en: 'Red', class: 'red' },
    'B': { name: '藍', en: 'Blue', class: 'blue' },
    'Y': { name: '黃', en: 'Yellow', class: 'yellow' },
    'K': { name: '黑', en: 'Black', class: 'black' },
    'J': { name: '百搭', en: 'Joker', class: 'joker' }
};

/**
 * 16px Monochromatic Linear Micro Icons (Replaces all colorful emojis)
 */
const RK_ICONS = {
    sort: `<svg class="rk-icon" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>`,
    trash: `<svg class="rk-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    plus: `<svg class="rk-icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    check: `<svg class="rk-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    sparkles: `<svg class="rk-icon" viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"></path></svg>`,
    reset: `<svg class="rk-icon" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`,
    target: `<svg class="rk-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle></svg>`,
    arrowRight: `<svg class="rk-icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
    trophy: `<svg class="rk-icon" viewBox="0 0 24 24"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"></path><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"></path><path d="M4 3h16v6a8 8 0 0 1-16 0V3z"></path><path d="M12 17v4M8 21h8"></path></svg>`,
    rocket: `<svg class="rk-icon" viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>`,
    statusSuccess: `<svg class="rk-icon" viewBox="0 0 24 24" style="color:var(--accent-green);"><circle cx="12" cy="12" r="9"></circle><polyline points="16 9 10 15 7 12"></polyline></svg>`,
    statusWarn: `<svg class="rk-icon" viewBox="0 0 24 24" style="color:var(--accent-yellow);"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    statusError: `<svg class="rk-icon" viewBox="0 0 24 24" style="color:var(--accent-red);"><circle cx="12" cy="12" r="9"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    statusInfo: `<svg class="rk-icon" viewBox="0 0 24 24" style="color:var(--accent-blue);"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
};

// Maximum allowed copies of each tile in a standard 106-tile Rummikub set
const STANDARD_TILE_LIMIT = 2; // Exactly 2 of each number & color
const STANDARD_JOKER_LIMIT = 2; // Exactly 2 Jokers in entire game

/**
 * Parses tile string or object into a standardized tile object.
 */
function parseTile(tileInput) {
    if (!tileInput) return { code: '', color: 'K', value: 0, isJoker: false, origin: 'board' };
    
    let tileCode = typeof tileInput === 'object' ? tileInput.code : tileInput;
    let origin = typeof tileInput === 'object' ? (tileInput.origin || 'board') : 'board';

    if (tileCode === 'J' || (typeof tileCode === 'string' && tileCode.startsWith('J'))) {
        return { code: 'J', color: 'J', value: 0, isJoker: true, origin: origin };
    }
    const color = tileCode[0];
    const value = parseInt(tileCode.slice(1), 10);
    return {
        code: tileCode,
        color: color,
        value: isNaN(value) ? 0 : value,
        isJoker: false,
        origin: origin
    };
}

/**
 * Friendly display string for a tile (e.g. 'R7' -> '紅7', 'J' -> '百搭')
 */
function tile_display(tileInput) {
    const p = parseTile(tileInput);
    if (p.isJoker) return '百搭 (Joker)';
    const colorName = RK_COLORS[p.color] ? RK_COLORS[p.color].name : p.color;
    return `${colorName}${p.value}`;
}

/**
 * Check if a list of tiles forms a valid Rummikub Run (順組).
 * 3+ consecutive numbers of the same color, supporting Jokers.
 */
function isValidRun(tiles) {
    if (!tiles || tiles.length < 3) return false;
    const parsed = tiles.map(t => parseTile(t));
    const realTiles = parsed.filter(t => !t.isJoker);
    if (realTiles.length === 0) return false;

    // All real tiles must share the same color
    const color = realTiles[0].color;
    if (!realTiles.every(t => t.color === color)) return false;

    // Check consecutive sequence
    const values = realTiles.map(t => t.value);
    // Cannot have duplicates
    if (new Set(values).size !== values.length) return false;

    // Real tiles must be in strictly increasing order
    for (let i = 1; i < values.length; i++) {
        if (values[i] <= values[i - 1]) return false;
    }

    // Jokers at the start/end must not push values < 1 or > 13
    const firstRealIdx = parsed.findIndex(t => !t.isJoker);
    const lastRealIdx = parsed.length - 1 - [...parsed].reverse().findIndex(t => !t.isJoker);
    const jokersBefore = firstRealIdx;
    const jokersAfter = parsed.length - 1 - lastRealIdx;

    const minVal = values[0] - jokersBefore;
    const maxVal = values[values.length - 1] + jokersAfter;

    if (maxVal - minVal + 1 > tiles.length) return false; // Gap is too large
    if (minVal < 1 || maxVal > 13) return false;

    return true;
}

/**
 * Check if a list of tiles forms a valid Rummikub Set (群組).
 * 3 or 4 tiles of identical value with all different colors, supporting Jokers.
 */
function isValidSet(tiles) {
    if (!tiles || tiles.length < 3 || tiles.length > 4) return false;
    const realTiles = tiles.map(t => parseTile(t)).filter(t => !t.isJoker);
    if (realTiles.length === 0) return false;

    // All real tiles must have the same value
    const value = realTiles[0].value;
    if (!realTiles.every(t => t.value === value)) return false;

    // All real tiles must have distinct colors
    const colors = realTiles.map(t => t.color);
    if (new Set(colors).size !== colors.length) return false;

    return true;
}

/**
 * Check whether a group of tiles is a valid Rummikub meld.
 * Returns { valid: boolean, type: 'run' | 'set' | 'incomplete' | 'invalid', message: string, points: number }
 */
function checkMeldValidity(tiles) {
    if (!tiles || tiles.length === 0) {
        return { valid: false, type: 'empty', message: '空牌組', points: 0 };
    }
    if (tiles.length < 3) {
        return { valid: false, type: 'incomplete', message: `未成組 (${tiles.length}張，至少需3張)`, points: calculateTilesPoints(tiles) };
    }

    if (isValidRun(tiles)) {
        return { valid: true, type: 'run', message: `合法順組 (${tiles.length}張)`, points: calculateTilesPoints(tiles) };
    }
    if (isValidSet(tiles)) {
        return { valid: true, type: 'set', message: `合法群組 (${tiles.length}張)`, points: calculateTilesPoints(tiles) };
    }

    return { valid: false, type: 'invalid', message: '不合法 (非同色連號或同號異色)', points: calculateTilesPoints(tiles) };
}

/**
 * Automatically sorts and arranges a group of tiles according to Rummikub rules:
 * - If tiles share the same color (potential Run): sorts in consecutive order, placing Jokers into gaps.
 * - If tiles share the same value (potential Set): sorts colors in standard R, B, Y, K order.
 * Preserves tile objects { code, origin }.
 */
function autoArrangeMeld(tiles) {
    if (!tiles || tiles.length <= 1) return tiles;

    const parsedList = tiles.map(t => parseTile(t));
    const realTiles = parsedList.filter(t => !t.isJoker);
    const jokers = parsedList.filter(t => t.isJoker);

    // 1. Check if all real tiles share the same color -> Potential Run (順組)
    if (realTiles.length >= 1 && realTiles.every(t => t.color === realTiles[0].color)) {
        const sortedReal = [...realTiles].sort((a, b) => a.value - b.value);
        const vals = sortedReal.map(t => t.value);

        // Cannot have duplicate numbers in a single run
        if (new Set(vals).size === vals.length) {
            // Reconstruct sequence, placing jokers into numerical gaps
            const result = [];
            const availableJokers = [...jokers];

            for (let i = 0; i < sortedReal.length; i++) {
                result.push(sortedReal[i]);
                if (i < sortedReal.length - 1) {
                    let gap = sortedReal[i + 1].value - sortedReal[i].value;
                    while (gap > 1 && availableJokers.length > 0) {
                        result.push(availableJokers.shift());
                        gap--;
                    }
                }
            }

            // Intelligently place remaining jokers:
            // If highest value reached 13, remaining jokers must precede the lowest tile
            while (availableJokers.length > 0 && result[result.length - 1].value === 13) {
                result.unshift(availableJokers.pop());
            }
            // If lowest value is 1, remaining jokers must append to the end
            while (availableJokers.length > 0 && result[0].value === 1) {
                result.push(availableJokers.shift());
            }
            // Any other jokers append to end
            result.push(...availableJokers);

            return result.map(item => ({ code: item.code, origin: item.origin }));
        }
    }

    // 2. Check if all real tiles share the same value -> Potential Set (群組)
    if (realTiles.length >= 1 && realTiles.every(t => t.value === realTiles[0].value)) {
        const colorOrder = { 'R': 1, 'B': 2, 'Y': 3, 'K': 4 };
        const sortedReal = [...realTiles].sort((a, b) => colorOrder[a.color] - colorOrder[b.color]);
        const result = [...sortedReal, ...jokers];
        return result.map(item => ({ code: item.code, origin: item.origin }));
    }

    // 3. Otherwise, sort by value then color
    return sortTilesByValue(tiles.map(t => parseTile(t).code)).map(code => {
        const match = parsedList.find(p => p.code === code);
        return { code: code, origin: match ? match.origin : 'board' };
    });
}

/**
 * Evaluates the board groups to find the best matching group for a newly dragged/added tile.
 * Priorities:
 * 1. An incomplete group (<3 tiles) that BECOMES VALID when this tile is added.
 * 2. An already valid group that can be legally extended by this tile.
 * 3. Two incomplete groups that merge together with this tile into a valid meld.
 * 4. An incomplete group (1-2 tiles) that matches color/value to build towards a meld.
 */
function findBestGroupForTile(tileObj, boardGroups) {
    if (!tileObj || !boardGroups || boardGroups.length === 0) return null;
    const p = parseTile(tileObj);

    // 1. Incomplete group that becomes valid
    for (let i = 0; i < boardGroups.length; i++) {
        const g = boardGroups[i];
        const oldVal = checkMeldValidity(g.map(t => parseTile(t).code));
        if (!oldVal.valid) {
            const tested = autoArrangeMeld([...g, tileObj]);
            const testVal = checkMeldValidity(tested.map(t => parseTile(t).code));
            if (testVal.valid) {
                return { type: 'single', groupIdx: i, meldType: testVal.type, becomesValid: true };
            }
        }
    }

    // 2. Already valid group that can be legally extended
    for (let i = 0; i < boardGroups.length; i++) {
        const g = boardGroups[i];
        const oldVal = checkMeldValidity(g.map(t => parseTile(t).code));
        if (oldVal.valid) {
            const tested = autoArrangeMeld([...g, tileObj]);
            const testVal = checkMeldValidity(tested.map(t => parseTile(t).code));
            if (testVal.valid) {
                return { type: 'single', groupIdx: i, meldType: testVal.type, becomesValid: false };
            }
        }
    }

    // 3. Two incomplete groups that together become valid with this tile
    for (let i = 0; i < boardGroups.length; i++) {
        const gA = boardGroups[i];
        if (checkMeldValidity(gA.map(t => parseTile(t).code)).valid) continue;
        for (let j = i + 1; j < boardGroups.length; j++) {
            const gB = boardGroups[j];
            if (checkMeldValidity(gB.map(t => parseTile(t).code)).valid) continue;
            const tested = autoArrangeMeld([...gA, ...gB, tileObj]);
            const testVal = checkMeldValidity(tested.map(t => parseTile(t).code));
            if (testVal.valid) {
                return { type: 'merge-two', groupA: i, groupB: j, meldType: testVal.type, becomesValid: true };
            }
        }
    }

    // 4. Incomplete run / set extension (building towards a meld)
    for (let i = 0; i < boardGroups.length; i++) {
        const g = boardGroups[i];
        if (g.length >= 3) continue; // Only attach to incomplete
        const gParsed = g.map(t => parseTile(t));
        // Check same color run potential (within span of 3)
        if (p.color !== 'J' && gParsed.every(t => t.color === p.color)) {
            const vals = gParsed.map(t => t.value);
            if (!vals.includes(p.value)) {
                const allVals = [...vals, p.value].sort((a, b) => a - b);
                if (allVals[allVals.length - 1] - allVals[0] <= 3) {
                    return { type: 'single', groupIdx: i, meldType: 'incomplete-run', becomesValid: false };
                }
            }
        }
        // Check same value set potential
        if (p.color !== 'J' && gParsed.every(t => t.value === p.value)) {
            const colors = new Set(gParsed.map(t => t.color));
            if (!colors.has(p.color) && g.length < 3) {
                return { type: 'single', groupIdx: i, meldType: 'incomplete-set', becomesValid: false };
            }
        }
    }

    return null;
}

/**
 * Creates a DOM element representing a Rummikub tile.
 * Supports Drag & Drop and origin tagging.
 */
function createTileElement(tileInput, options = {}) {
    const parsed = parseTile(tileInput);
    const tileDiv = document.createElement('div');
    tileDiv.className = 'rk-tile';
    tileDiv.setAttribute('data-color', parsed.color);
    tileDiv.setAttribute('data-tile', parsed.code);
    tileDiv.setAttribute('data-origin', parsed.origin);

    if (options.draggable) {
        tileDiv.setAttribute('draggable', 'true');
        tileDiv.classList.add('draggable');
    }

    // Tiles placed from hand during this turn can be retrieved
    if (parsed.origin === 'hand' || options.fromHand) {
        tileDiv.classList.add('from-hand');
        tileDiv.title = '本回合從手牌放出的牌 (可收回手中)';
    } else if (parsed.origin === 'board') {
        tileDiv.title = '原桌面牌 (規則限制：不可收回手中)';
    }

    if (options.selected) {
        tileDiv.classList.add('selected');
    }

    if (options.size === 'sm') {
        tileDiv.style.width = '34px';
        tileDiv.style.height = '48px';
    } else if (options.size === 'lg') {
        tileDiv.style.width = '52px';
        tileDiv.style.height = '74px';
    }

    const numberSpan = document.createElement('span');
    numberSpan.className = 'rk-tile-number';
    numberSpan.textContent = parsed.isJoker ? '★' : parsed.value;

    const dotSpan = document.createElement('span');
    dotSpan.className = 'rk-tile-dot';

    tileDiv.appendChild(numberSpan);
    tileDiv.appendChild(dotSpan);

    if (typeof options.onClick === 'function') {
        tileDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            options.onClick(parsed, tileDiv);
        });
    }

    return tileDiv;
}

/**
 * Sort tiles by color then value.
 */
function sortTilesByColor(tiles) {
    const colorOrder = { 'R': 1, 'B': 2, 'Y': 3, 'K': 4, 'J': 5 };
    return [...tiles].sort((a, b) => {
        const pa = parseTile(a);
        const pb = parseTile(b);
        if (colorOrder[pa.color] !== colorOrder[pb.color]) {
            return colorOrder[pa.color] - colorOrder[pb.color];
        }
        return pa.value - pb.value;
    });
}

/**
 * Sort tiles by value then color.
 */
function sortTilesByValue(tiles) {
    const colorOrder = { 'R': 1, 'B': 2, 'Y': 3, 'K': 4, 'J': 5 };
    return [...tiles].sort((a, b) => {
        const pa = parseTile(a);
        const pb = parseTile(b);
        if (pa.isJoker) return 1;
        if (pb.isJoker) return -1;
        if (pa.value !== pb.value) {
            return pa.value - pb.value;
        }
        return colorOrder[pa.color] - colorOrder[pb.color];
    });
}

/**
 * Calculate total points of a tile list.
 */
function calculateTilesPoints(tiles) {
    return tiles.reduce((sum, t) => {
        const p = parseTile(t);
        return sum + p.value;
    }, 0);
}
