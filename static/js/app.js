/**
 * Rummikub AI Solver - Interactive Drag & Drop Application Logic.
 * Features:
 * 1. Staging selection box with real-time deck quota checks
 * 2. Smart auto-merging of added tiles into board melds
 * 3. Trash Can dropzone for deleting wrong tiles from hand or board
 * 4. Origin tracking (board vs hand) and turn reset (重置本回合)
 */

document.addEventListener('DOMContentLoaded', () => {
    // App State
    const state = {
        boardGroups: [],   // Array of tile arrays: [ [ { code: 'R1', origin: 'board' }, ... ], ... ]
        hand: [],          // Array of tile strings: [ 'R4', 'R5', ... ]
        initialMeld: false,
        selectorTarget: 'hand', // 'hand', 'board-new', or group index
        targetGroupIdx: null,
        stagedTiles: [],   // Tiles currently selected inside the palette modal before confirming
        detectedTiles: [],
        selectedTile: null, // For click-to-move { source, groupIdx, tileIdx, tileCode, origin }
        draggedItem: null,  // Currently dragged tile info
        turnSnapshot: null, // Snapshot at turn start: { boardGroups, hand }
        lastCalculationData: null, // Full data from last calculate
        currentStrategy: 'optimal' // 'optimal' or 'keep_joker'
    };

    // DOM Elements
    const boardTilesContainer = document.getElementById('boardTilesContainer');
    const boardCountBadge = document.getElementById('boardCountBadge');
    const handContainer = document.getElementById('handTilesContainer');
    const handCountBadge = document.getElementById('handCountBadge');
    const handPointsBadge = document.getElementById('handPointsBadge');
    const initialMeldToggle = document.getElementById('initialMeldToggle');
    const dockHandSection = document.querySelector('.dock-hand-section');
    const dockTrashCan = document.getElementById('dockTrashCan');
    const toastContainer = document.getElementById('toastContainer');

    // Action buttons
    const btnCalculate = document.getElementById('btnCalculate');
    const btnAddHandTile = document.getElementById('btnAddHandTile');
    const btnAddBoardTile = document.getElementById('btnAddBoardTile');
    const btnResetBoard = document.getElementById('btnResetBoard');
    const btnConfirmTurn = document.getElementById('btnConfirmTurn');
    const btnAutoMeld = document.getElementById('btnAutoMeld');
    const btnRecallHandTiles = document.getElementById('btnRecallHandTiles');
    const btnClearBoard = document.getElementById('btnClearBoard');
    const btnClearHand = document.getElementById('btnClearHand');
    const btnSortHandColor = document.getElementById('btnSortHandColor');
    const btnSortHandValue = document.getElementById('btnSortHandValue');
    const btnUploadImage = document.getElementById('btnUploadImage');
    const btnPreset = document.getElementById('presetBtn');

    // Modals
    const tileSelectorModal = document.getElementById('tileSelectorModal');
    const btnCloseSelector = document.getElementById('btnCloseSelector');
    const btnCancelSelector = document.getElementById('btnCancelSelector');
    const btnDoneSelector = document.getElementById('btnDoneSelector');
    const selectorTargetLabel = document.getElementById('selectorTargetLabel');
    const stagingCountText = document.getElementById('stagingCountText');
    const stagingTilesContainer = document.getElementById('stagingTilesContainer');
    const btnClearStaging = document.getElementById('btnClearStaging');

    const imageModal = document.getElementById('imageModal');
    const btnCloseImageModal = document.getElementById('btnCloseImageModal');
    const btnCancelImage = document.getElementById('btnCancelImage');
    const btnApplyDetected = document.getElementById('btnApplyDetected');
    const imageDropzone = document.getElementById('imageDropzone');
    const fileInput = document.getElementById('fileInput');
    const previewWrapper = document.getElementById('previewWrapper');
    const imagePreview = document.getElementById('imagePreview');
    const dropzonePrompt = document.getElementById('dropzonePrompt');
    const visionLoading = document.getElementById('visionLoading');
    const recognitionReview = document.getElementById('recognitionReview');
    const detectedTilesGrid = document.getElementById('detectedTilesGrid');
    const detectedCountText = document.getElementById('detectedCountText');
    const btnAddMissedTile = document.getElementById('btnAddMissedTile');
    const geminiKeyField = document.getElementById('geminiKeyField');

    const presetModal = document.getElementById('presetModal');
    const btnClosePreset = document.getElementById('btnClosePreset');
    const presetsList = document.getElementById('presetsList');

    // Board View Tabs & Panels
    const boardViewTabs = document.querySelectorAll('.board-tab-btn');
    const viewPanels = {
        'table': document.getElementById('viewTable'),
        'key-tiles': document.getElementById('viewKeyTiles'),
        'synergy': document.getElementById('viewSynergy')
    };
    const keyTileBadge = document.getElementById('keyTileBadge');

    // Status Bar Elements
    const boardStatusBar = document.getElementById('boardStatusBar');
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusDesc = document.getElementById('statusDesc');
    const statPlayedCount = document.getElementById('statPlayedCount');
    const statRemainingCount = document.getElementById('statRemainingCount');
    const btnQuickViewKey = document.getElementById('btnQuickViewKey');

    // Results Grids
    const winningTilesGrid = document.getElementById('winningTilesGrid');
    const breakthroughList = document.getElementById('breakthroughList');
    const synergyGrid = document.getElementById('synergyGrid');

    // Quick Code Input Elements
    const quickCodeInput = document.getElementById('quickCodeInput');
    const btnQuickAddToBoard = document.getElementById('btnQuickAddToBoard');
    const btnQuickAddToHand = document.getElementById('btnQuickAddToHand');
    const quickPreviewRow = document.getElementById('quickPreviewRow');
    const quickPreviewChips = document.getElementById('quickPreviewChips');
    const quickPreviewCount = document.getElementById('quickPreviewCount');

    // Strategy Switcher Elements
    const strategySwitcherBar = document.getElementById('strategySwitcherBar');
    const btnStrategyOptimal = document.getElementById('btnStrategyOptimal');
    const btnStrategyKeepJoker = document.getElementById('btnStrategyKeepJoker');
    const statOptimalCount = document.getElementById('statOptimalCount');
    const statKeepJokerCount = document.getElementById('statKeepJokerCount');

    // Step-by-Step Action Guide Elements
    const actionGuidePanel = document.getElementById('actionGuidePanel');
    const guideSummaryTitle = document.getElementById('guideSummaryTitle');
    const guideStepCounter = document.getElementById('guideStepCounter');
    const btnToggleGuide = document.getElementById('btnToggleGuide');
    const actionStepsContainer = document.getElementById('actionStepsContainer');

    // Helper: Toast Notifications with 16px monochrome linear icon badges
    function showToast(message, type = 'warning') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let iconHtml = RK_ICONS.statusWarn;
        if (type === 'success') iconHtml = RK_ICONS.statusSuccess;
        else if (type === 'error') iconHtml = RK_ICONS.statusError;
        else if (type === 'info') iconHtml = RK_ICONS.statusInfo;

        const cleanMsg = message.replace(/^[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B50}-\u{2B55}\u{203C}-\u{2049}\u{25AA}-\u{25FE}]+\s*/u, '');

        toast.innerHTML = `<span class="toast-icon">${iconHtml}</span><span class="toast-text">${cleanMsg}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s, transform 0.3s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-6px)';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // Helper: Deep copy turn state snapshot
    function saveTurnSnapshot() {
        state.turnSnapshot = {
            boardGroups: JSON.parse(JSON.stringify(state.boardGroups)),
            hand: [...state.hand]
        };
    }

    // Helper: Total flat board codes
    function getFlatBoardCodes() {
        return state.boardGroups.flat().map(t => parseTile(t).code);
    }

    // Helper: Map tile origins from existing board & newly added tiles
    function getTileOriginPool(newTileObjs = []) {
        const pool = {};
        function add(code, origin) {
            if (!pool[code]) pool[code] = [];
            pool[code].push(origin);
        }
        state.boardGroups.flat().forEach(t => {
            const p = parseTile(t);
            add(p.code, p.origin);
        });
        newTileObjs.forEach(t => {
            const p = parseTile(t);
            add(p.code, p.origin || 'board');
        });
        return pool;
    }

    function takeOrigin(pool, code) {
        if (pool && pool[code] && pool[code].length > 0) {
            return pool[code].shift();
        }
        if (pool && code === 'J' && pool['J'] && pool['J'].length > 0) {
            return pool['J'].shift();
        }
        return 'board';
    }

    async function tryReorganizeBoardTiles(allTileCodes) {
        if (!allTileCodes || allTileCodes.length < 3) return null;
        try {
            const resp = await fetch('/api/reorganize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ board: allTileCodes })
            });
            return await resp.json();
        } catch (err) {
            console.error('Reorganize error:', err);
            return null;
        }
    }

    function applyReorganizedMelds(melds, unmatchedCodes = [], originPool = null) {
        if (!originPool) {
            originPool = getTileOriginPool();
        }

        const newGroups = [];
        melds.forEach(m => {
            const groupTiles = m.tiles.map(tInfo => {
                const code = tInfo.tile;
                const origin = takeOrigin(originPool, code);
                return { code: code, origin: origin };
            });
            newGroups.push(groupTiles);
        });

        // Add unmatched loose tiles as individual groups
        if (unmatchedCodes && unmatchedCodes.length > 0) {
            unmatchedCodes.forEach(code => {
                const origin = takeOrigin(originPool, code);
                newGroups.push([{ code: code, origin: origin }]);
            });
        }

        state.boardGroups = newGroups;
        updateBoardUI();

        // Trigger green success pulse animation on reorganized groups
        setTimeout(() => {
            document.querySelectorAll('.meld-rack-group').forEach(el => {
                el.classList.add('just-organized');
            });
        }, 50);
    }

    // Helper: Deck quota calculations (Max 2 of each tile, 2 jokers)
    // Counts in-play tiles + staged tiles
    function getTileCountInPlay(tileCode) {
        let count = 0;
        // In Hand
        state.hand.forEach(t => {
            if (parseTile(t).code === tileCode) count++;
        });
        // On Board
        state.boardGroups.flat().forEach(t => {
            if (parseTile(t).code === tileCode) count++;
        });
        // Currently Staged in Modal
        state.stagedTiles.forEach(t => {
            if (parseTile(t).code === tileCode) count++;
        });
        return count;
    }

    function getTileRemainingQuota(tileCode) {
        const limit = (tileCode === 'J') ? STANDARD_JOKER_LIMIT : STANDARD_TILE_LIMIT;
        const inPlay = getTileCountInPlay(tileCode);
        return Math.max(0, limit - inPlay);
    }

    // ================= Board UI & Drag & Drop =================

    function updateBoardUI() {
        boardTilesContainer.innerHTML = '';
        const flatBoard = state.boardGroups.flat();
        boardCountBadge.textContent = `${flatBoard.length} 張 (${state.boardGroups.length} 組)`;

        const groupsGrid = document.createElement('div');
        groupsGrid.className = 'board-groups-grid';

        // Render each Meld Group
        state.boardGroups.forEach((groupTiles, groupIdx) => {
            if (groupTiles.length === 0) return;

            const tileCodes = groupTiles.map(t => parseTile(t).code);
            const validity = checkMeldValidity(tileCodes);

            const groupCard = document.createElement('div');
            groupCard.className = `meld-rack-group ${validity.type === 'run' ? 'valid-run' : (validity.type === 'set' ? 'valid-set' : (validity.type === 'incomplete' ? 'incomplete' : 'invalid'))}`;
            groupCard.setAttribute('data-group-idx', groupIdx);

            // Group Header with validation badge and quick tools
            const headerDiv = document.createElement('div');
            headerDiv.className = 'meld-group-header';

            const tagSpan = document.createElement('span');
            tagSpan.className = `meld-valid-tag tag-${validity.type}`;
            tagSpan.textContent = validity.message;

            const toolsDiv = document.createElement('div');
            toolsDiv.className = 'meld-group-tools';

            // Sort button on group (16px micro linear icon)
            const sortBtn = document.createElement('button');
            sortBtn.className = 'btn-group-micro';
            sortBtn.innerHTML = RK_ICONS.sort;
            sortBtn.title = '自動排序此組';
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.boardGroups[groupIdx] = sortGroupTiles(state.boardGroups[groupIdx]);
                updateBoardUI();
            });

            // Disband / Clear group button (16px micro linear icon)
            // Disband / Split group button
            const splitBtn = document.createElement('button');
            splitBtn.className = 'btn-group-micro';
            splitBtn.title = '拆散此組牌為散牌以利自由改組';
            splitBtn.innerHTML = `<svg class="rk-icon-sm" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`;
            splitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tiles = state.boardGroups[groupIdx];
                if (tiles && tiles.length > 1) {
                    state.boardGroups.splice(groupIdx, 1);
                    tiles.forEach(t => {
                        state.boardGroups.push([t]);
                    });
                    updateBoardUI();
                    showToast('已將該組牌拆散至桌面，所有牌均可自由拿出重組！', 'info');
                }
            });

            // Disband / Clear group button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-group-micro';
            deleteBtn.innerHTML = RK_ICONS.trash;
            deleteBtn.title = '解散此組牌';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tiles = state.boardGroups[groupIdx];
                if (!tiles || tiles.length === 0) return;

                const hasBoardTiles = tiles.some(t => parseTile(t).origin === 'board');
                if (hasBoardTiles) {
                    // Disband into individual loose tiles on table so player can freely reorganize
                    state.boardGroups.splice(groupIdx, 1);
                    tiles.forEach(t => {
                        state.boardGroups.push([t]);
                    });
                    updateBoardUI();
                    showToast('已將該組牌拆散至桌面，牌張未被鎖定，可自由拿出另創新組合！', 'info');
                    return;
                }

                // If purely hand tiles: return them to hand
                tiles.forEach(t => {
                    if (parseTile(t).origin === 'hand') {
                        state.hand.push(parseTile(t).code);
                    }
                });
                state.boardGroups.splice(groupIdx, 1);
                updateBoardUI();
                updateHandUI();
                showToast('已將手牌收回手中！', 'info');
            });

            toolsDiv.appendChild(sortBtn);
            toolsDiv.appendChild(splitBtn);
            toolsDiv.appendChild(deleteBtn);

            headerDiv.appendChild(tagSpan);
            headerDiv.appendChild(toolsDiv);
            groupCard.appendChild(headerDiv);

            // Tiles row (connected touching tiles)
            const tilesRow = document.createElement('div');
            tilesRow.className = 'meld-tiles-touching';

            groupTiles.forEach((tileItem, tileIdx) => {
                const parsed = parseTile(tileItem);
                const isSelected = state.selectedTile && 
                    state.selectedTile.source === 'board' && 
                    state.selectedTile.groupIdx === groupIdx && 
                    state.selectedTile.tileIdx === tileIdx;

                const tileEl = createTileElement(parsed, {
                    draggable: true,
                    selected: isSelected,
                    removable: true,
                    onClick: () => handleTileClick('board', groupIdx, tileIdx, parsed.code, parsed.origin)
                });

                // Tile Drag Events
                tileEl.addEventListener('dragstart', (e) => {
                    handleDragStart(e, { source: 'board', groupIdx, tileIdx, tileCode: parsed.code, origin: parsed.origin });
                    tileEl.classList.add('dragging');
                });
                tileEl.addEventListener('dragend', () => {
                    tileEl.classList.remove('dragging');
                    handleDragEnd();
                });

                // Allow dropping onto or before a specific tile
                tileEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = tileEl.getBoundingClientRect();
                    const isRight = (e.clientX - rect.left) > (rect.width / 2);
                    tileEl.style.borderLeft = !isRight ? '3px solid #38bdf8' : '';
                    tileEl.style.borderRight = isRight ? '3px solid #38bdf8' : '';
                });

                tileEl.addEventListener('dragleave', () => {
                    tileEl.style.borderLeft = '';
                    tileEl.style.borderRight = '';
                });

                tileEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    tileEl.style.borderLeft = '';
                    tileEl.style.borderRight = '';
                    const rect = tileEl.getBoundingClientRect();
                    const insertAfter = (e.clientX - rect.left) > (rect.width / 2);
                    handleDropInsert(groupIdx, insertAfter ? tileIdx + 1 : tileIdx);
                });

                tilesRow.appendChild(tileEl);
            });

            // Group-level drop (appends to end of group and auto-arranges)
            groupCard.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                groupCard.style.outline = '2px dashed var(--accent-green)';
            });
            groupCard.addEventListener('dragleave', () => {
                groupCard.style.outline = '';
            });
            groupCard.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                groupCard.style.outline = '';
                handleDropAppendToGroup(groupIdx);
            });

            // Click group to move selected tile into it
            groupCard.addEventListener('click', () => {
                if (state.selectedTile) {
                    moveSelectedTileToGroup(groupIdx);
                }
            });

            groupCard.appendChild(tilesRow);
            groupsGrid.appendChild(groupCard);
        });

        // Dropzone for Creating New Group (Always visible)
        const newGroupDropzone = document.createElement('div');
        newGroupDropzone.className = 'new-group-dropzone';
        newGroupDropzone.innerHTML = `
            <span class="new-group-icon">${RK_ICONS.plus}</span>
            <strong>拖曳牌至此成立新組</strong>
            <span style="font-size:0.7rem; color:var(--text-muted);">或點擊此處加入</span>
        `;

        newGroupDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            newGroupDropzone.classList.add('drag-over');
        });
        newGroupDropzone.addEventListener('dragleave', () => {
            newGroupDropzone.classList.remove('drag-over');
        });
        newGroupDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            newGroupDropzone.classList.remove('drag-over');
            handleDropToNewGroupZone();
        });
        newGroupDropzone.addEventListener('click', () => {
            if (state.selectedTile) {
                moveSelectedTileToNewGroup();
            } else {
                openPalette('board-new');
            }
        });

        groupsGrid.appendChild(newGroupDropzone);

        // General table background drop listeners
        groupsGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            boardTilesContainer.classList.add('board-drag-over');
        });
        groupsGrid.addEventListener('dragleave', (e) => {
            boardTilesContainer.classList.remove('board-drag-over');
        });
        groupsGrid.addEventListener('drop', (e) => {
            e.preventDefault();
            boardTilesContainer.classList.remove('board-drag-over');
            handleDropToBoardArea(e);
        });

        boardTilesContainer.appendChild(groupsGrid);
    }

    boardTilesContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        boardTilesContainer.classList.add('board-drag-over');
    });
    boardTilesContainer.addEventListener('dragleave', () => {
        boardTilesContainer.classList.remove('board-drag-over');
    });
    boardTilesContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        boardTilesContainer.classList.remove('board-drag-over');
        handleDropToBoardArea(e);
    });

    // ================= Hand UI & Drag Events =================

    function updateHandUI() {
        handContainer.querySelectorAll('.rk-tile').forEach(t => t.remove());
        const emptyState = document.getElementById('handEmptyState');

        handCountBadge.textContent = `${state.hand.length} 張`;
        handPointsBadge.textContent = `${calculateTilesPoints(state.hand)} 分`;

        if (state.hand.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
        } else {
            if (emptyState) emptyState.style.display = 'none';

            state.hand.forEach((tileCode, idx) => {
                const isSelected = state.selectedTile && 
                    state.selectedTile.source === 'hand' && 
                    state.selectedTile.tileIdx === idx;

                const tileEl = createTileElement({ code: tileCode, origin: 'hand' }, {
                    draggable: true,
                    selected: isSelected,
                    removable: true,
                    onClick: () => handleTileClick('hand', null, idx, tileCode, 'hand')
                });

                tileEl.addEventListener('dragstart', (e) => {
                    handleDragStart(e, { source: 'hand', tileIdx: idx, tileCode, origin: 'hand' });
                    tileEl.classList.add('dragging');
                });
                tileEl.addEventListener('dragend', () => {
                    tileEl.classList.remove('dragging');
                    handleDragEnd();
                });

                // Hand tile reorder drop
                tileEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    tileEl.style.transform = 'scale(1.1)';
                });
                tileEl.addEventListener('dragleave', () => {
                    tileEl.style.transform = '';
                });
                tileEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    tileEl.style.transform = '';
                    handleDropIntoHand(idx);
                });

                handContainer.appendChild(tileEl);
            });
        }
    }

    // Drop on Hand rack
    dockHandSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        dockHandSection.classList.add('drag-over');
    });
    dockHandSection.addEventListener('dragleave', () => {
        dockHandSection.classList.remove('drag-over');
    });
    dockHandSection.addEventListener('drop', (e) => {
        e.preventDefault();
        dockHandSection.classList.remove('drag-over');
        handleDropIntoHand(state.hand.length);
    });

    // ================= Trash Can Dropzone Logic (️ 丟入垃圾桶刪除) =================

    dockTrashCan.addEventListener('dragover', (e) => {
        e.preventDefault();
        dockTrashCan.classList.add('drag-over');
    });

    dockTrashCan.addEventListener('dragleave', () => {
        dockTrashCan.classList.remove('drag-over');
    });

    dockTrashCan.addEventListener('drop', (e) => {
        e.preventDefault();
        dockTrashCan.classList.remove('drag-over');
        handleDropIntoTrash();
    });

    // Click trash can to delete selected tile
    dockTrashCan.addEventListener('click', () => {
        if (state.selectedTile) {
            deleteSelectedTile();
        } else {
            showToast('請將要刪除的錯牌直接拖曳到垃圾桶，或先點選牌後再點垃圾桶！', 'warning');
        }
    });

    function handleDropIntoTrash() {
        const item = state.draggedItem;
        if (!item) return;

        const tileName = tile_display(item.tileCode);

        if (item.source === 'hand') {
            state.hand.splice(item.tileIdx, 1);
            updateHandUI();
            showToast(`️ 已將手牌中的 [${tileName}] 丟入垃圾桶刪除！`, 'warning');
        } else if (item.source === 'board') {
            if (state.boardGroups[item.groupIdx]) {
                state.boardGroups[item.groupIdx].splice(item.tileIdx, 1);
                cleanupEmptyGroups();
                updateBoardUI();
                showToast(`️ 已將桌面上的 [${tileName}] 丟入垃圾桶刪除！`, 'warning');
            }
        }

        state.draggedItem = null;
    }

    function deleteSelectedTile() {
        const sel = state.selectedTile;
        if (!sel) return;

        const tileName = tile_display(sel.tileCode);

        if (sel.source === 'hand') {
            state.hand.splice(sel.tileIdx, 1);
            state.selectedTile = null;
            updateHandUI();
            showToast(`️ 已將手牌中的 [${tileName}] 丟入垃圾桶刪除！`, 'warning');
        } else if (sel.source === 'board') {
            if (state.boardGroups[sel.groupIdx]) {
                state.boardGroups[sel.groupIdx].splice(sel.tileIdx, 1);
                cleanupEmptyGroups();
                state.selectedTile = null;
                updateBoardUI();
                showToast(`️ 已將桌面上的 [${tileName}] 丟入垃圾桶刪除！`, 'warning');
            }
        }
    }

    // ================= Drag & Drop Processing Logic =================

    function handleDragStart(e, itemData) {
        state.draggedItem = itemData;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemData.tileCode);

        // Activate Trash Can indicator
        dockTrashCan.classList.add('drag-active');
    }

    function handleDragEnd() {
        state.draggedItem = null;
        dockTrashCan.classList.remove('drag-active');
        dockTrashCan.classList.remove('drag-over');
    }

    // Insert tile at specific index in an existing meld group
    async function handleDropInsert(groupIdx, targetTileIdx) {
        const item = state.draggedItem;
        if (!item) return;

        const tileObj = extractDraggedTile(item);
        if (!tileObj) return;

        if (!state.boardGroups[groupIdx]) {
            state.boardGroups[groupIdx] = [];
        }

        // Test if inserting into target group directly forms a valid meld
        const testTarget = autoArrangeMeld([...state.boardGroups[groupIdx], tileObj]);
        const testTargetVal = checkMeldValidity(testTarget.map(t => parseTile(t).code));

        if (!testTargetVal.valid) {
            // Target group would NOT be valid! But check if global reorganization CAN make the board 100% valid!
            const oldFlat = getFlatBoardCodes();
            const allCodes = [...oldFlat, tileObj.code];
            const originPool = getTileOriginPool([tileObj]);
            if (allCodes.length >= 3) {
                const reorgResult = await tryReorganizeBoardTiles(allCodes);
                if (reorgResult && reorgResult.success && reorgResult.all_valid) {
                    if (item.source === 'board' && state.boardGroups[item.groupIdx]) {
                        state.boardGroups[item.groupIdx] = autoArrangeMeld(state.boardGroups[item.groupIdx]);
                    }
                    applyReorganizedMelds(reorgResult.melds, [], originPool);
                    updateHandUI();
                    showToast(`✨ 智能大挪移：偵測到出牌意圖，已自動將桌面重組為合法牌組！`, 'success');
                    return;
                }
            }
        }

        state.boardGroups[groupIdx].splice(targetTileIdx, 0, tileObj);
        state.boardGroups[groupIdx] = autoArrangeMeld(state.boardGroups[groupIdx]);

        // If dragged from another board group, also auto-arrange the source group
        if (item.source === 'board' && item.groupIdx !== groupIdx && state.boardGroups[item.groupIdx]) {
            state.boardGroups[item.groupIdx] = autoArrangeMeld(state.boardGroups[item.groupIdx]);
        }

        cleanupEmptyGroups();
        updateBoardUI();
        updateHandUI();

        // Real-time validity notification
        const targetGroup = state.boardGroups[groupIdx];
        if (targetGroup) {
            const val = checkMeldValidity(targetGroup.map(t => parseTile(t).code));
            if (val.valid) {
                showToast(` [${tile_display(tileObj.code)}] 已融入牌組並自動理順 (${val.message})！`, 'success');
            } else {
                showToast(`[${tile_display(tileObj.code)}] 已放入牌組 (${val.message})。`, 'info');
            }
        }
    }

    // Append tile to existing meld group and auto-arrange
    async function handleDropAppendToGroup(groupIdx) {
        const item = state.draggedItem;
        if (!item) return;

        if (item.source === 'board' && item.groupIdx === groupIdx && item.tileIdx === state.boardGroups[groupIdx].length - 1) {
            return;
        }

        const tileObj = extractDraggedTile(item);
        if (!tileObj) return;

        if (!state.boardGroups[groupIdx]) {
            state.boardGroups[groupIdx] = [];
        }

        // Test if appending to target group directly forms a valid meld
        const testTarget = autoArrangeMeld([...state.boardGroups[groupIdx], tileObj]);
        const testTargetVal = checkMeldValidity(testTarget.map(t => parseTile(t).code));

        if (!testTargetVal.valid) {
            // Target group would NOT be valid! But check if global reorganization CAN make the board 100% valid!
            const oldFlat = getFlatBoardCodes();
            const allCodes = [...oldFlat, tileObj.code];
            const originPool = getTileOriginPool([tileObj]);
            if (allCodes.length >= 3) {
                const reorgResult = await tryReorganizeBoardTiles(allCodes);
                if (reorgResult && reorgResult.success && reorgResult.all_valid) {
                    if (item.source === 'board' && state.boardGroups[item.groupIdx]) {
                        state.boardGroups[item.groupIdx] = autoArrangeMeld(state.boardGroups[item.groupIdx]);
                    }
                    applyReorganizedMelds(reorgResult.melds, [], originPool);
                    updateHandUI();
                    showToast(`✨ 智能大挪移：偵測到出牌意圖，已自動將桌面重組為合法牌組！`, 'success');
                    return;
                }
            }
        }

        state.boardGroups[groupIdx].push(tileObj);
        state.boardGroups[groupIdx] = autoArrangeMeld(state.boardGroups[groupIdx]);

        // If dragged from another board group, also auto-arrange source group
        if (item.source === 'board' && item.groupIdx !== groupIdx && state.boardGroups[item.groupIdx]) {
            state.boardGroups[item.groupIdx] = autoArrangeMeld(state.boardGroups[item.groupIdx]);
        }

        cleanupEmptyGroups();
        updateBoardUI();
        updateHandUI();

        const targetGroup = state.boardGroups[groupIdx];
        if (targetGroup) {
            const val = checkMeldValidity(targetGroup.map(t => parseTile(t).code));
            if (val.valid) {
                showToast(` [${tile_display(tileObj.code)}] 已加入並自動理順 (${val.message})！`, 'success');
            } else {
                showToast(`[${tile_display(tileObj.code)}] 已加入牌組 (${val.message})。`, 'info');
            }
        }
    }

    // Drop onto general board felt area (Drag tile out to table freely)
    async function handleDropToBoardArea(e) {
        const item = state.draggedItem;
        if (!item) return;

        const tileObj = extractDraggedTile(item);
        if (!tileObj) return;

        // Auto-arrange source group if dragged from another board group
        if (item.source === 'board' && state.boardGroups[item.groupIdx]) {
            state.boardGroups[item.groupIdx] = autoArrangeMeld(state.boardGroups[item.groupIdx]);
        }
        cleanupEmptyGroups();

        // If dragged from board: player deliberately took this tile out to form a new combination
        if (item.source === 'board') {
            state.boardGroups.push([tileObj]);
            showToast(`牌張 [${tile_display(tileObj.code)}] 已拿出置於桌面，可自由組合！`, 'info');
            cleanupEmptyGroups();
            updateBoardUI();
            updateHandUI();
            return;
        }

        // If dragged from hand: check if global reorganization can make entire table valid!
        const oldFlat = getFlatBoardCodes();
        const allCodes = [...oldFlat, tileObj.code];
        const originPool = getTileOriginPool([tileObj]);

        if (allCodes.length >= 3) {
            const reorgResult = await tryReorganizeBoardTiles(allCodes);
            if (reorgResult && reorgResult.success && reorgResult.all_valid) {
                applyReorganizedMelds(reorgResult.melds, [], originPool);
                updateHandUI();
                showToast(`✨ 智能大挪移：加入 [${tile_display(tileObj.code)}] 後，桌面已自動重組為合法牌組！`, 'success');
                return;
            }
        }

        // Otherwise place as free new group on table so player can freely manipulate
        state.boardGroups.push([tileObj]);
        showToast(`牌張 [${tile_display(tileObj.code)}] 已放置於桌面新組。`, 'info');

        cleanupEmptyGroups();
        updateBoardUI();
        updateHandUI();
    }

    // Drop onto "成立新組" Box (Unconditionally forms a new group)
    function handleDropToNewGroupZone() {
        const item = state.draggedItem;
        if (!item) return;

        const tileObj = extractDraggedTile(item);
        if (!tileObj) return;

        if (item.source === 'board' && state.boardGroups[item.groupIdx]) {
            state.boardGroups[item.groupIdx] = autoArrangeMeld(state.boardGroups[item.groupIdx]);
        }

        state.boardGroups.push([tileObj]);
        showToast(`牌張 [${tile_display(tileObj.code)}] 已拿出成立新牌組！`, 'info');

        cleanupEmptyGroups();
        updateBoardUI();
        updateHandUI();
    }

    // Create a new meld group on the board (fallback)
    function handleDropCreateNewGroup() {
        handleDropToNewGroupZone();
    }

    // Drop into hand rack (STRICT RULE ENFORCEMENT)
    function handleDropIntoHand(insertIdx) {
        const item = state.draggedItem;
        if (!item) return;

        if (item.source === 'hand') {
            // Reorder inside hand
            const tile = state.hand.splice(item.tileIdx, 1)[0];
            const dest = insertIdx > item.tileIdx ? insertIdx - 1 : insertIdx;
            state.hand.splice(dest, 0, tile);
        } else if (item.source === 'board') {
            // Check origin: Is this a permanent board tile?
            if (item.origin === 'board') {
                showToast('️ 原桌面牌不可收回手中！只有本回合打出的手牌才能收回。', 'warning');
                return;
            }

            // Move tile from board back to hand
            const tileObj = extractDraggedTile(item);
            if (tileObj) {
                state.hand.splice(insertIdx, 0, tileObj.code);
            }
        }

        cleanupEmptyGroups();
        updateBoardUI();
        updateHandUI();
    }

    function extractDraggedTile(item) {
        if (item.source === 'hand') {
            if (item.tileIdx >= 0 && item.tileIdx < state.hand.length) {
                const code = state.hand.splice(item.tileIdx, 1)[0];
                return { code: code, origin: 'hand' };
            }
        } else if (item.source === 'board') {
            if (state.boardGroups[item.groupIdx] && item.tileIdx < state.boardGroups[item.groupIdx].length) {
                const raw = state.boardGroups[item.groupIdx].splice(item.tileIdx, 1)[0];
                return { code: parseTile(raw).code, origin: parseTile(raw).origin };
            }
        }
        return null;
    }

    function cleanupEmptyGroups() {
        state.boardGroups = state.boardGroups.filter(g => g && g.length > 0);
    }

    function sortGroupTiles(tiles) {
        return autoArrangeMeld(tiles);
    }

    // ================= Click-to-Move Fallback Interaction =================

    function handleTileClick(source, groupIdx, tileIdx, tileCode, origin) {
        if (state.selectedTile) {
            // Deselect if clicking the same tile
            if (state.selectedTile.source === source && 
                state.selectedTile.groupIdx === groupIdx && 
                state.selectedTile.tileIdx === tileIdx) {
                state.selectedTile = null;
                updateBoardUI();
                updateHandUI();
                return;
            }

            // Move from hand to board group
            if (state.selectedTile.source === 'hand' && source === 'board') {
                const tile = state.hand.splice(state.selectedTile.tileIdx, 1)[0];
                state.boardGroups[groupIdx].splice(tileIdx + 1, 0, { code: tile, origin: 'hand' });
                state.boardGroups[groupIdx] = autoArrangeMeld(state.boardGroups[groupIdx]);
                state.selectedTile = null;
                cleanupEmptyGroups();
                updateBoardUI();
                updateHandUI();
                return;
            }

            // Move from board to hand rack (Strict origin check)
            if (state.selectedTile.source === 'board' && source === 'hand') {
                if (state.selectedTile.origin === 'board') {
                    showToast('️ 原桌面牌不可收回手中！只有本回合打出的手牌才能收回。', 'warning');
                    return;
                }
                const tileObj = state.boardGroups[state.selectedTile.groupIdx].splice(state.selectedTile.tileIdx, 1)[0];
                state.hand.splice(tileIdx, 0, parseTile(tileObj).code);
                state.selectedTile = null;
                cleanupEmptyGroups();
                updateBoardUI();
                updateHandUI();
                return;
            }

            // Move from board group to another board group (桌面組間點選挪移)
            if (state.selectedTile.source === 'board' && source === 'board' && state.selectedTile.groupIdx !== groupIdx) {
                const sourceGroupIdx = state.selectedTile.groupIdx;
                const tileObj = state.boardGroups[sourceGroupIdx].splice(state.selectedTile.tileIdx, 1)[0];
                state.boardGroups[groupIdx].splice(tileIdx + 1, 0, tileObj);
                state.boardGroups[groupIdx] = autoArrangeMeld(state.boardGroups[groupIdx]);
                if (state.boardGroups[sourceGroupIdx]) {
                    state.boardGroups[sourceGroupIdx] = autoArrangeMeld(state.boardGroups[sourceGroupIdx]);
                }
                state.selectedTile = null;
                cleanupEmptyGroups();
                updateBoardUI();
                showToast(`已將 [${tile_display(parseTile(tileObj).code)}] 移動至目標牌組！`, 'info');
                return;
            }
        }

        // Otherwise select this tile
        state.selectedTile = { source, groupIdx, tileIdx, tileCode, origin };
        updateBoardUI();
        updateHandUI();
    }

    function moveSelectedTileToGroup(groupIdx) {
        if (!state.selectedTile) return;
        const tileObj = extractSelectedTile();
        if (tileObj) {
            state.boardGroups[groupIdx].push(tileObj);
            state.boardGroups[groupIdx] = autoArrangeMeld(state.boardGroups[groupIdx]);
            const val = checkMeldValidity(state.boardGroups[groupIdx].map(t => parseTile(t).code));
            state.selectedTile = null;
            cleanupEmptyGroups();
            updateBoardUI();
            updateHandUI();
            if (val.valid) {
                showToast(` [${tile_display(tileObj.code)}] 已移入並自動理順 (${val.message})！`, 'success');
            }
        }
    }

    function moveSelectedTileToNewGroup() {
        if (!state.selectedTile) return;
        const tileObj = extractSelectedTile();
        if (tileObj) {
            state.boardGroups.push([tileObj]);
            state.selectedTile = null;
            cleanupEmptyGroups();
            updateBoardUI();
            updateHandUI();
            showToast(`牌張 [${tile_display(tileObj.code)}] 已移至新組，可自由擺放或點擊「自動理牌」！`, 'info');
        }
    }

    function extractSelectedTile() {
        const sel = state.selectedTile;
        if (!sel) return null;
        if (sel.source === 'hand') {
            const code = state.hand.splice(sel.tileIdx, 1)[0];
            return { code: code, origin: 'hand' };
        } else if (sel.source === 'board') {
            const raw = state.boardGroups[sel.groupIdx].splice(sel.tileIdx, 1)[0];
            return { code: parseTile(raw).code, origin: parseTile(raw).origin };
        }
        return null;
    }

    // ================= Reset & Confirm Turn Actions =================

    // Reset Board to turn start snapshot (重置本回合)
    btnResetBoard.addEventListener('click', () => {
        if (!state.turnSnapshot) {
            showToast('目前沒有可還原的回合快照。', 'warning');
            return;
        }

        state.boardGroups = JSON.parse(JSON.stringify(state.turnSnapshot.boardGroups));
        state.hand = [...state.turnSnapshot.hand];
        state.selectedTile = null;
        updateBoardUI();
        updateHandUI();
        showToast(' 已還原至本回合開始時的原本牌型！', 'success');
    });

    // Recall Hand Tiles (撤回本回合手牌)
    btnRecallHandTiles.addEventListener('click', () => {
        let recalledCount = 0;
        state.boardGroups.forEach(group => {
            for (let i = group.length - 1; i >= 0; i--) {
                if (parseTile(group[i]).origin === 'hand') {
                    const tile = group.splice(i, 1)[0];
                    state.hand.push(parseTile(tile).code);
                    recalledCount++;
                }
            }
        });

        cleanupEmptyGroups();
        updateBoardUI();
        updateHandUI();

        if (recalledCount > 0) {
            showToast(`已成功將本回合放出的 ${recalledCount} 張手牌收回手中！`, 'success');
        } else {
            showToast('桌面上沒有本回合打出的手牌可收回。', 'warning');
        }
    });

    // Confirm Turn & Validate Melds (確認出牌)
    btnConfirmTurn.addEventListener('click', () => {
        if (state.boardGroups.length === 0) {
            showToast('桌面目前無牌！', 'warning');
            return;
        }

        for (let i = 0; i < state.boardGroups.length; i++) {
            const group = state.boardGroups[i];
            const codes = group.map(t => parseTile(t).code);
            const val = checkMeldValidity(codes);
            if (!val.valid) {
                showToast(`牌組 #${i + 1} 不合法 (${val.message})！桌面所有牌組均需形成至少 3 張的合法順組或同刻，請手動調整或點擊「自動理牌」協助組合！`, 'error');
                return;
            }
        }

        const playedFromHand = [];
        state.boardGroups.flat().forEach(t => {
            if (parseTile(t).origin === 'hand') {
                playedFromHand.push(parseTile(t).code);
            }
        });

        if (playedFromHand.length === 0) {
            showToast('本回合尚未打出任何手牌！若無法出牌請直接摸牌。', 'warning');
            return;
        }

        if (state.initialMeld) {
            const pts = calculateTilesPoints(playedFromHand);
            if (pts < 30) {
                showToast(`破冰失敗：首次出牌總分需 ≥ 30 分！目前打出手牌僅 ${pts} 分。`, 'error');
                return;
            }
        }

        // All Valid: Promote all hand tiles to permanent board tiles!
        state.boardGroups.forEach(group => {
            group.forEach(t => {
                t.origin = 'board';
            });
        });

        saveTurnSnapshot();
        updateBoardUI();
        updateHandUI();

        if (state.hand.length === 0) {
            showToast('恭喜！手牌全數清空獲勝 (Rummikub)！', 'success');
        } else {
            showToast(`出牌確認成功！本回合打出 ${playedFromHand.length} 張牌，進入下一回合。`, 'success');
        }
    });

    // Auto-Meld Loose Tiles (一鍵理牌 / 智能大挪移)
    btnAutoMeld.addEventListener('click', async () => {
        const flatBoard = getFlatBoardCodes();
        if (flatBoard.length < 3) {
            showToast('桌面牌數少於 3 張，無法自動組成合法牌組！', 'warning');
            return;
        }

        const originPool = getTileOriginPool();
        const data = await tryReorganizeBoardTiles(flatBoard);
        if (data && data.success && data.can_reorganize) {
            applyReorganizedMelds(data.melds, data.unmatched, originPool);
            if (data.all_valid) {
                showToast(`✨ 智能大挪移：已自動將桌面 ${data.total_tiles} 張牌重組為 ${data.melds.length} 組合法牌組！`, 'success');
            } else {
                showToast(`已將 ${data.matched_tiles_count} 張牌重組為合法牌組，剩餘 ${data.unmatched.length} 張未成組牌。`, 'info');
            }
        } else {
            showToast('桌面牌無法重組成合法牌組，請手動調整或搭配手牌！', 'warning');
        }
    });

    // ================= Palette Picker Modal with Staging Box & Deck Quotas =================

    function initPalette() {
        const colors = [
            { id: 'R', rowEl: document.getElementById('paletteRowR') },
            { id: 'B', rowEl: document.getElementById('paletteRowB') },
            { id: 'Y', rowEl: document.getElementById('paletteRowY') },
            { id: 'K', rowEl: document.getElementById('paletteRowK') }
        ];

        colors.forEach(({ id, rowEl }) => {
            rowEl.innerHTML = '';
            for (let v = 1; v <= 13; v++) {
                const tileCode = `${id}${v}`;
                const wrapper = createPaletteTileWrapper(tileCode);
                rowEl.appendChild(wrapper);
            }
        });

        // Joker row: Exactly 1 tile button with quota badge '2' (standard deck has exactly 2 Jokers)
        const jokerRow = document.getElementById('paletteRowJ');
        jokerRow.innerHTML = '';
        const wrapper = createPaletteTileWrapper('J');
        jokerRow.appendChild(wrapper);
    }

    function createPaletteTileWrapper(tileCode) {
        const wrapper = document.createElement('div');
        wrapper.className = 'palette-tile-wrapper';
        wrapper.setAttribute('data-palette-tile', tileCode);

        const tileEl = createTileElement(tileCode, {
            size: 'sm',
            onClick: () => addTileToStaging(tileCode)
        });

        const quotaBadge = document.createElement('span');
        quotaBadge.className = 'quota-badge';
        quotaBadge.textContent = '2';

        wrapper.appendChild(tileEl);
        wrapper.appendChild(quotaBadge);
        return wrapper;
    }

    function updatePaletteQuotas() {
        document.querySelectorAll('.palette-tile-wrapper').forEach(wrapper => {
            const tileCode = wrapper.getAttribute('data-palette-tile');
            const remaining = getTileRemainingQuota(tileCode);
            const badge = wrapper.querySelector('.quota-badge');

            if (badge) {
                badge.textContent = remaining;
                badge.className = 'quota-badge';
                if (remaining === 1) badge.classList.add('quota-one');
                if (remaining === 0) badge.classList.add('quota-zero');
            }

            if (remaining <= 0) {
                wrapper.classList.add('exhausted');
                wrapper.title = '該牌在整副拉密牌中只有 2 張，已全部用完！';
            } else {
                wrapper.classList.remove('exhausted');
                wrapper.title = `剩餘可用：${remaining} 張`;
            }
        });
    }

    // Staging Selection Logic (選擇時在框內即時顯示)
    function addTileToStaging(tileCode) {
        const remaining = getTileRemainingQuota(tileCode);
        if (remaining <= 0) {
            showToast(`️ [${tile_display(tileCode)}] 在整副拉密牌中只有 2 張，已全部選完或在場上！`, 'error');
            return;
        }

        state.stagedTiles.push(tileCode);
        renderStagingBox();
        updatePaletteQuotas();
    }

    function removeTileFromStaging(index) {
        state.stagedTiles.splice(index, 1);
        renderStagingBox();
        updatePaletteQuotas();
    }

    function renderStagingBox() {
        stagingTilesContainer.innerHTML = '';
        stagingCountText.textContent = state.stagedTiles.length;

        if (state.stagedTiles.length === 0) {
            stagingTilesContainer.innerHTML = '<span class="staging-empty-hint">點選下方牌張加入選取清單...</span>';
            return;
        }

        state.stagedTiles.forEach((tileCode, idx) => {
            const tileEl = createTileElement(tileCode, {
                size: 'sm',
                removable: true,
                onClick: () => removeTileFromStaging(idx)
            });
            tileEl.title = '點擊從選取清單中移除';
            stagingTilesContainer.appendChild(tileEl);
        });
    }

    btnClearStaging.addEventListener('click', () => {
        state.stagedTiles = [];
        renderStagingBox();
        updatePaletteQuotas();
    });

    function openPalette(target, groupIdx = null) {
        state.selectorTarget = target;
        state.targetGroupIdx = groupIdx;
        state.stagedTiles = []; // Reset staged tiles

        selectorTargetLabel.textContent = target === 'hand' ? '我的手牌' : '桌面牌';
        renderStagingBox();
        updatePaletteQuotas();
        tileSelectorModal.style.display = 'flex';
    }

    btnCancelSelector.addEventListener('click', () => {
        state.stagedTiles = [];
        tileSelectorModal.style.display = 'none';
    });
    btnCloseSelector.addEventListener('click', () => {
        state.stagedTiles = [];
        tileSelectorModal.style.display = 'none';
    });

    // Confirm adding staged tiles (批次確認加入)
    btnDoneSelector.addEventListener('click', async () => {
        if (state.stagedTiles.length === 0) {
            tileSelectorModal.style.display = 'none';
            return;
        }

        const count = state.stagedTiles.length;

        if (state.selectorTarget === 'hand') {
            state.hand.push(...state.stagedTiles);
            updateHandUI();
            showToast(`成功將 ${count} 張牌加入手牌！`, 'success');
        } else if (state.selectorTarget === 'board-new' || state.selectorTarget === 'board') {
            // Smart auto-merging into existing table melds!
            await smartMergeTilesIntoBoard(state.stagedTiles);
            updateBoardUI();
        }

        state.stagedTiles = [];
        tileSelectorModal.style.display = 'none';
    });

    // ================= Smart Auto-Merge Into Board Melds =================
    // Intelligently attaches new tiles to existing board runs/sets,
    // or groups new tiles into runs/sets among themselves!
    async function smartMergeTilesIntoBoard(newTileCodes) {
        if (!newTileCodes || newTileCodes.length === 0) return;

        const newTileObjs = newTileCodes.map(c => ({ code: c, origin: 'board' }));
        const oldFlat = getFlatBoardCodes();
        const allCodes = [...oldFlat, ...newTileCodes];
        const originPool = getTileOriginPool(newTileObjs);

        // 1. First Priority: Global table reorganization (拉密智能大挪移)
        // If adding these tiles allows the entire table to form 100% legal melds (like 777 888 999 + 6 -> 6789 789 789)
        if (allCodes.length >= 3) {
            const reorgResult = await tryReorganizeBoardTiles(allCodes);
            if (reorgResult && reorgResult.success && reorgResult.all_valid) {
                applyReorganizedMelds(reorgResult.melds, [], originPool);
                showToast(`✨ 智能大挪移：成功融入牌張，並自動將桌面重組為 ${reorgResult.melds.length} 組合法牌組！`, 'success');
                return;
            }
        }

        // 2. Single tile case: Try attaching to best group on table
        if (newTileCodes.length === 1) {
            const t = newTileCodes[0];
            const tileObj = { code: t, origin: 'board' };
            const match = findBestGroupForTile(tileObj, state.boardGroups);
            if (match) {
                if (match.type === 'single') {
                    state.boardGroups[match.groupIdx].push(tileObj);
                    state.boardGroups[match.groupIdx] = autoArrangeMeld(state.boardGroups[match.groupIdx]);
                } else if (match.type === 'merge-two') {
                    const combined = [...state.boardGroups[match.groupA], ...state.boardGroups[match.groupB], tileObj];
                    state.boardGroups[match.groupA] = autoArrangeMeld(combined);
                    state.boardGroups.splice(match.groupB, 1);
                }
            } else {
                state.boardGroups.push([tileObj]);
            }
            updateBoardUI();
            return;
        }

        // 2. Multiple tiles selected in one batch:
        // Check if all selected tiles have the SAME value -> Group as a Set!
        const valMap = {};
        newTileCodes.forEach(code => {
            const v = parseTile(code).value;
            if (!valMap[v]) valMap[v] = [];
            valMap[v].push(code);
        });

        // Check if all selected tiles have the SAME color -> Group as a Run!
        const colorMap = {};
        newTileCodes.forEach(code => {
            const c = parseTile(code).color;
            if (!colorMap[c]) colorMap[c] = [];
            colorMap[c].push(code);
        });

        // If all selected tiles share the same value (e.g. B5, Y5, K5)
        if (Object.keys(valMap).length === 1) {
            const grp = newTileCodes.map(code => ({ code: code, origin: 'board' }));
            state.boardGroups.push(autoArrangeMeld(grp));
            return;
        }

        // If all selected tiles share the same color (e.g. R1, R2, R3)
        if (Object.keys(colorMap).length === 1) {
            const grp = newTileCodes.map(code => ({ code: code, origin: 'board' }));
            state.boardGroups.push(autoArrangeMeld(grp));
            return;
        }

        // 3. Mixed selection: extract sets and runs
        let rem = [...newTileCodes];
        const formedGroups = [];

        // Extract same-value sets of length >= 2
        Object.entries(valMap).forEach(([v, list]) => {
            const colors = new Set(list.map(c => parseTile(c).color));
            if (list.length >= 2 && colors.size === list.length) {
                formedGroups.push(list);
                list.forEach(c => {
                    const idx = rem.indexOf(c);
                    if (idx !== -1) rem.splice(idx, 1);
                });
            }
        });

        // Extract same-color runs of length >= 2 from remaining
        const remColorMap = {};
        rem.forEach(code => {
            const c = parseTile(code).color;
            if (!remColorMap[c]) remColorMap[c] = [];
            remColorMap[c].push(code);
        });

        Object.entries(remColorMap).forEach(([color, list]) => {
            if (list.length >= 2) {
                const sorted = sortTilesByValue(list);
                const vals = sorted.map(c => parseTile(c).value);
                if (vals[vals.length - 1] - vals[0] === vals.length - 1) {
                    formedGroups.push(sorted);
                    sorted.forEach(c => {
                        const idx = rem.indexOf(c);
                        if (idx !== -1) rem.splice(idx, 1);
                    });
                }
            }
        });

        // Leftovers: if any remaining tiles, keep them together in one group
        if (rem.length > 0) {
            formedGroups.push(rem);
        }

        // Add all formed groups to boardGroups and auto-arrange
        formedGroups.forEach(grp => {
            const tiles = grp.map(code => ({ code: code, origin: 'board' }));
            state.boardGroups.push(autoArrangeMeld(tiles));
        });
    }

    // Modal Events
    btnAddHandTile.addEventListener('click', () => openPalette('hand'));
    btnAddBoardTile.addEventListener('click', () => openPalette('board-new'));

    btnClearBoard.addEventListener('click', () => {
        if (getFlatBoardCodes().length > 0 && confirm('確定要清空桌面上的所有牌嗎？')) {
            state.boardGroups = [];
            updateBoardUI();
        }
    });
    btnClearHand.addEventListener('click', () => {
        if (state.hand.length > 0 && confirm('確定要清空手牌嗎？')) {
            state.hand = [];
            updateHandUI();
        }
    });

    btnSortHandColor.addEventListener('click', () => {
        state.hand = sortTilesByColor(state.hand);
        updateHandUI();
    });

    btnSortHandValue.addEventListener('click', () => {
        state.hand = sortTilesByValue(state.hand);
        updateHandUI();
    });

    initialMeldToggle.addEventListener('change', (e) => {
        state.initialMeld = e.target.checked;
    });

    // ================= Calculation & Solve API =================

    btnCalculate.addEventListener('click', executeCalculation);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target === document.body) {
            e.preventDefault();
            executeCalculation();
        }
    });

    async function executeCalculation() {
        if (state.hand.length === 0) {
            showToast('請先在手牌區加入至少一張牌！', 'warning');
            return;
        }

        btnCalculate.disabled = true;
        btnCalculate.classList.add('loading');

        try {
            const flatBoard = getFlatBoardCodes();
            const boardGroupsCodes = state.boardGroups.map(g => g.map(t => parseTile(t).code));
            const resp = await fetch('/api/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    board: flatBoard,
                    board_groups: boardGroupsCodes,
                    hand: state.hand,
                    initial_meld: state.initialMeld
                })
            });

            const data = await resp.json();
            if (!data.success) {
                showToast(`計算失敗: ${data.error || data.message}`, 'error');
                return;
            }

            state.lastCalculationData = data;
            state.currentStrategy = 'optimal';
            renderCalculationResults(data);
        } catch (err) {
            showToast(`網路或伺服器錯誤: ${err.message}`, 'error');
        } finally {
            btnCalculate.disabled = false;
            btnCalculate.classList.remove('loading');
        }
    }

    function renderCalculationResults(data) {
        boardStatusBar.style.display = 'flex';

        // Strategy Switcher Setup
        if (data.keep_joker_solution && data.keep_joker_solution.available) {
            strategySwitcherBar.style.display = 'flex';
            btnStrategyOptimal.classList.add('active');
            btnStrategyKeepJoker.classList.remove('active');
            statOptimalCount.textContent = data.played_tiles ? data.played_tiles.length : 0;
            statKeepJokerCount.textContent = data.keep_joker_solution.played_tiles ? data.keep_joker_solution.played_tiles.length : 0;
        } else {
            strategySwitcherBar.style.display = 'none';
        }

        // Apply Optimal Strategy initially
        applyCalculationSolution(data);

        // Populate Key Winning Tiles View
        const analysis = data.analysis;
        winningTilesGrid.innerHTML = '';
        breakthroughList.innerHTML = '';
        synergyGrid.innerHTML = '';

        if (analysis) {
            const winCount = analysis.winning_tiles ? analysis.winning_tiles.length : 0;
            if (winCount > 0) {
                keyTileBadge.textContent = winCount;
                keyTileBadge.style.display = 'inline-block';
            } else {
                keyTileBadge.style.display = 'none';
            }

            // Winning Tiles
            if (analysis.can_win_now) {
                winningTilesGrid.innerHTML = `
                    <div style="padding: 10px; color: var(--accent-yellow); font-weight: 700;">
                        當前手牌已經可以全部出完，直接獲勝！不需要額外關鍵牌！
                    </div>
                `;
            } else if (analysis.winning_tiles && analysis.winning_tiles.length > 0) {
                analysis.winning_tiles.forEach(wt => {
                    const card = document.createElement('div');
                    card.className = 'key-tile-card';

                    const tEl = createTileElement(wt.tile, { size: 'sm' });
                    const infoDiv = document.createElement('div');
                    infoDiv.innerHTML = `
                        <strong style="color: #fff; font-size: 0.95rem;">摸進 ${wt.display}</strong>
                        <p style="color: var(--accent-yellow); font-size: 0.75rem;">
                            一進聽！摸到直接清空手牌獲勝
                        </p>
                    `;

                    card.appendChild(tEl);
                    card.appendChild(infoDiv);
                    winningTilesGrid.appendChild(card);
                });
            } else {
                winningTilesGrid.innerHTML = `
                    <div style="color: var(--text-muted); font-size: 0.85rem; padding: 6px;">
                        目前暫無單張摸到即可直接全出獲勝的「一進聽」牌。請參考下方摸牌突破推薦：
                    </div>
                `;
            }

            // Breakthrough Tiles
            if (analysis.breakthrough_tiles && analysis.breakthrough_tiles.length > 0) {
                analysis.breakthrough_tiles.forEach(bt => {
                    const card = document.createElement('div');
                    card.className = 'breakthrough-card';

                    const tEl = createTileElement(bt.tile, { size: 'sm' });
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'breakthrough-info';
                    infoDiv.innerHTML = `
                        <strong style="color:#fff;">摸進 ${bt.display}</strong>
                        <p style="color:var(--text-secondary); font-size:0.75rem;">解鎖打出原本手牌 <strong>${bt.orig_hand_played}</strong> 張！</p>
                    `;

                    card.appendChild(tEl);
                    card.appendChild(infoDiv);
                    breakthroughList.appendChild(card);
                });
            } else {
                breakthroughList.innerHTML = `
                    <div style="color: var(--text-muted); font-size: 0.85rem;">
                        暫無推薦的突破牌。
                    </div>
                `;
            }

            // Synergy Melds
            if (analysis.hand_waiting_melds && analysis.hand_waiting_melds.length > 0) {
                analysis.hand_waiting_melds.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'synergy-card';

                    const currentTilesHtml = item.current_tiles.map(t => createTileElement(t, { size: 'sm' }).outerHTML).join('');
                    const neededTilesHtml = item.needed_tiles.map(t => createTileElement(t, { size: 'sm' }).outerHTML).join('');

                    card.innerHTML = `
                        <div class="synergy-header">
                            <strong>${item.type_cn}</strong>
                            <span style="color: var(--text-muted);">${item.description}</span>
                        </div>
                        <div class="synergy-tiles-row">
                            <div style="display:flex; gap:2px;">${currentTilesHtml}</div>
                            <span class="synergy-arrow">${RK_ICONS.arrowRight} 缺</span>
                            <div style="display:flex; gap:2px;">${neededTilesHtml}</div>
                        </div>
                    `;
                    synergyGrid.appendChild(card);
                });
            } else {
                synergyGrid.innerHTML = `
                    <div style="color: var(--text-muted); font-size: 0.85rem;">
                        手牌中未偵測到明顯的搭子組合。
                    </div>
                `;
            }
        }
    }

    function applyCalculationSolution(sol) {
        if (!sol) return;

        // Update boardGroups with melds from solution
        if (sol.can_play && sol.melds && sol.melds.length > 0) {
            state.boardGroups = sol.melds.map(m => m.tiles.map(t => ({
                code: t.tile,
                origin: t.from_hand ? 'hand' : 'board'
            })));

            state.hand = [...sol.remaining_hand];
            updateHandUI();
            updateBoardUI();
        }

        // Status Feedback Bar
        boardStatusBar.className = 'board-status-bar';
        if (sol.is_win) {
            boardStatusBar.classList.add('win');
            statusIcon.innerHTML = RK_ICONS.trophy;
            statusTitle.textContent = '全部手牌打出獲勝 (Rummikub)！';
            statusDesc.textContent = `成功打出 ${sol.played_tiles.length} 張手牌，一次清空手牌贏得勝利！`;
        } else if (sol.can_play) {
            statusIcon.innerHTML = RK_ICONS.statusSuccess;
            statusTitle.textContent = `手牌可出！已自動在桌面重組打出 ${sol.played_tiles.length} 張牌`;
            statusDesc.textContent = `打出手牌獲得 ${sol.points_played} 分。點擊「確認出牌」可鎖定回合。`;
        } else {
            statusIcon.innerHTML = RK_ICONS.statusWarn;
            statusTitle.textContent = '目前手牌無法出牌，請摸牌 (Draw)';
            statusDesc.textContent = state.initialMeld 
                ? '首出破冰限制：手牌目前無法在不借用桌面牌的情況下組出大於等於 30 分的牌組。'
                : '現有手牌與桌面牌暫無法組合出合法新牌型。請查看「關鍵牌聽牌預測」進牌方向！';
        }

        statPlayedCount.textContent = sol.played_tiles ? sol.played_tiles.length : 0;
        statRemainingCount.textContent = sol.remaining_hand ? sol.remaining_hand.length : state.hand.length;

        // Render Action Steps
        renderActionSteps(sol.steps, sol.played_tiles);
    }

    function renderActionSteps(steps, playedTiles) {
        if (!actionGuidePanel || !actionStepsContainer) return;

        if (!steps || steps.length === 0 || !playedTiles || playedTiles.length === 0) {
            actionGuidePanel.style.display = 'none';
            actionStepsContainer.innerHTML = '';
            return;
        }

        actionGuidePanel.style.display = 'block';
        guideStepCounter.textContent = `共 ${steps.length} 步`;
        guideSummaryTitle.textContent = `本回合打出 ${playedTiles.length} 張手牌，請依序執行以下實體操作：`;
        actionStepsContainer.innerHTML = '';
        actionStepsContainer.style.display = 'flex';
        if (btnToggleGuide) btnToggleGuide.textContent = '收起';

        steps.forEach(step => {
            const card = document.createElement('div');
            card.className = 'action-step-card';
            card.innerHTML = `
                <div class="step-number-badge">${step.step_num}</div>
                <div class="step-card-content">
                    <div class="step-card-title">${step.title}</div>
                    <div class="step-card-detail">${step.detail}</div>
                </div>
            `;
            actionStepsContainer.appendChild(card);
        });
    }

    if (btnToggleGuide) {
        btnToggleGuide.addEventListener('click', () => {
            if (actionStepsContainer.style.display === 'none') {
                actionStepsContainer.style.display = 'flex';
                btnToggleGuide.textContent = '收起';
            } else {
                actionStepsContainer.style.display = 'none';
                btnToggleGuide.textContent = '展開';
            }
        });
    }

    if (btnStrategyOptimal) {
        btnStrategyOptimal.addEventListener('click', () => {
            if (!state.lastCalculationData) return;
            state.currentStrategy = 'optimal';
            btnStrategyOptimal.classList.add('active');
            btnStrategyKeepJoker.classList.remove('active');
            applyCalculationSolution(state.lastCalculationData);
            showToast('已切換為【極致出牌】方案！', 'info');
        });
    }

    if (btnStrategyKeepJoker) {
        btnStrategyKeepJoker.addEventListener('click', () => {
            if (!state.lastCalculationData || !state.lastCalculationData.keep_joker_solution) return;
            state.currentStrategy = 'keep_joker';
            btnStrategyOptimal.classList.remove('active');
            btnStrategyKeepJoker.classList.add('active');
            applyCalculationSolution(state.lastCalculationData.keep_joker_solution);
            showToast('已切換為【保留百搭】方案！', 'info');
        });
    }

    // ================= Quick Code Input (極速代碼加牌) =================
    function parseQuickTileInput(str) {
        if (!str || !str.trim()) return [];
        const tokens = str.trim().split(/[\s,，+]+/);
        const result = [];

        tokens.forEach(tok => {
            tok = tok.trim();
            if (!tok) return;

            // 1. Joker: j, joker
            if (/^j(oker)?$/i.test(tok)) {
                result.push('J');
                return;
            }

            // 2. Color Range: e.g. R7-9, b10-13, Y1-3, R1-R3
            const rangeMatch = tok.match(/^([rbykRBYK])(\d{1,2})-[rbykRBYK]?(\d{1,2})$/i);
            if (rangeMatch) {
                const color = rangeMatch[1].toUpperCase();
                const start = parseInt(rangeMatch[2], 10);
                const end = parseInt(rangeMatch[3], 10);
                if (start >= 1 && end <= 13 && start <= end) {
                    for (let v = start; v <= end; v++) {
                        result.push(color + v);
                    }
                    return;
                }
            }

            // 3. Multi-color same value: e.g. 7rby, 10rbk, 13rbyk
            const multiColorMatch = tok.match(/^(\d{1,2})([rbykRBYK]{1,4})$/i);
            if (multiColorMatch) {
                const val = parseInt(multiColorMatch[1], 10);
                const colors = multiColorMatch[2].toUpperCase().split('');
                if (val >= 1 && val <= 13) {
                    const uniqueColors = Array.from(new Set(colors));
                    uniqueColors.forEach(c => result.push(c + val));
                    return;
                }
            }

            // 4. Single tile: e.g. R7, b10, y1, k13
            const singleMatch = tok.match(/^([rbykRBYK])(\d{1,2})$/i);
            if (singleMatch) {
                const color = singleMatch[1].toUpperCase();
                const val = parseInt(singleMatch[2], 10);
                if (val >= 1 && val <= 13) {
                    result.push(color + val);
                    return;
                }
            }
        });
        return result;
    }

    function updateQuickPreview() {
        if (!quickCodeInput || !quickPreviewRow) return;
        const val = quickCodeInput.value;
        const parsed = parseQuickTileInput(val);
        if (parsed.length === 0) {
            quickPreviewRow.style.display = 'none';
            quickPreviewChips.innerHTML = '';
            quickPreviewCount.textContent = '0 張';
            return;
        }

        quickPreviewRow.style.display = 'flex';
        quickPreviewChips.innerHTML = '';
        quickPreviewCount.textContent = `${parsed.length} 張`;

        parsed.forEach(code => {
            const chip = document.createElement('span');
            const p = parseTile(code);
            chip.className = `quick-chip ${p.class}`;
            chip.textContent = tile_display(code);
            quickPreviewChips.appendChild(chip);
        });
    }

    if (quickCodeInput) {
        quickCodeInput.addEventListener('input', updateQuickPreview);
        quickCodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    executeQuickAddToHand();
                } else {
                    executeQuickAddToBoard();
                }
            }
        });
    }

    if (btnQuickAddToBoard) {
        btnQuickAddToBoard.addEventListener('click', executeQuickAddToBoard);
    }
    if (btnQuickAddToHand) {
        btnQuickAddToHand.addEventListener('click', executeQuickAddToHand);
    }

    function executeQuickAddToBoard() {
        if (!quickCodeInput) return;
        const tiles = parseQuickTileInput(quickCodeInput.value);
        if (tiles.length === 0) {
            showToast('請先輸入有效牌張代碼 (如 R7-9, 7rby, J)！', 'warning');
            return;
        }
        smartMergeTilesIntoBoard(tiles);
        quickCodeInput.value = '';
        updateQuickPreview();
        updateBoardUI();
        showToast(`已成功將 ${tiles.length} 張牌加入桌面！`, 'success');
    }

    function executeQuickAddToHand() {
        if (!quickCodeInput) return;
        const tiles = parseQuickTileInput(quickCodeInput.value);
        if (tiles.length === 0) {
            showToast('請先輸入有效牌張代碼 (如 R7-9, 7rby, J)！', 'warning');
            return;
        }
        tiles.forEach(t => state.hand.push(t));
        quickCodeInput.value = '';
        updateQuickPreview();
        updateHandUI();
        showToast(`已成功將 ${tiles.length} 張牌加入手牌！`, 'success');
    }

    // View Switcher Tabs
    boardViewTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            boardViewTabs.forEach(b => b.classList.remove('active'));
            Object.values(viewPanels).forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetView = btn.dataset.view;
            if (viewPanels[targetView]) {
                viewPanels[targetView].classList.add('active');
            }
        });
    });

    btnQuickViewKey.addEventListener('click', () => {
        const keyTab = document.querySelector('[data-view="key-tiles"]');
        if (keyTab) keyTab.click();
    });

    // ================= Image Recognition Modal =================

    btnUploadImage.addEventListener('click', () => {
        imageModal.style.display = 'flex';
        resetVisionModal();
    });

    btnCloseImageModal.addEventListener('click', () => imageModal.style.display = 'none');
    btnCancelImage.addEventListener('click', () => imageModal.style.display = 'none');

    document.querySelectorAll('input[name="visionMethod"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('active'));
            e.target.closest('.radio-option').classList.add('active');
            if (e.target.value === 'gemini') {
                geminiKeyField.style.display = 'flex';
            } else {
                geminiKeyField.style.display = 'none';
            }
        });
    });

    function resetVisionModal() {
        previewWrapper.style.display = 'none';
        dropzonePrompt.style.display = 'flex';
        visionLoading.style.display = 'none';
        recognitionReview.style.display = 'none';
        btnApplyDetected.disabled = true;
        state.detectedTiles = [];
        fileInput.value = '';
    }

    imageDropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processImageFile(e.target.files[0]);
        }
    });

    imageDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageDropzone.style.borderColor = 'var(--accent-green)';
    });

    imageDropzone.addEventListener('dragleave', () => {
        imageDropzone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    imageDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        imageDropzone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processImageFile(e.dataTransfer.files[0]);
        }
    });

    window.addEventListener('paste', (e) => {
        if (imageModal.style.display === 'flex') {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    processImageFile(blob);
                    break;
                }
            }
        }
    });

    function processImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Data = e.target.result;
            imagePreview.src = base64Data;
            previewWrapper.style.display = 'flex';
            dropzonePrompt.style.display = 'none';
            triggerRecognition(base64Data);
        };
        reader.readAsDataURL(file);
    }

    async function triggerRecognition(base64Data) {
        const method = document.querySelector('input[name="visionMethod"]:checked').value;
        const apiKey = document.getElementById('geminiApiKeyInput').value.trim();

        visionLoading.style.display = 'flex';
        recognitionReview.style.display = 'none';
        btnApplyDetected.disabled = true;

        try {
            const resp = await fetch('/api/recognize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64Data,
                    method: method,
                    api_key: apiKey
                })
            });

            const result = await resp.json();
            if (!result.success) {
                showToast(`辨識失敗: ${result.error || '無法辨識桌面牌'}`, 'error');
                return;
            }

            if (result.annotated_image) {
                imagePreview.src = result.annotated_image;
            }

            state.detectedTiles = (result.tiles || []).map(t => t.tile);
            renderDetectedTiles();
        } catch (err) {
            showToast(`辨識請求錯誤: ${err.message}`, 'error');
        } finally {
            visionLoading.style.display = 'none';
        }
    }

    function renderDetectedTiles() {
        detectedTilesGrid.innerHTML = '';
        detectedCountText.textContent = state.detectedTiles.length;
        recognitionReview.style.display = 'flex';
        btnApplyDetected.disabled = state.detectedTiles.length === 0;

        state.detectedTiles.forEach((tileCode, idx) => {
            const el = createTileElement(tileCode, {
                removable: true,
                size: 'sm',
                onClick: () => {
                    state.detectedTiles.splice(idx, 1);
                    renderDetectedTiles();
                }
            });
            detectedTilesGrid.appendChild(el);
        });
    }

    btnAddMissedTile.addEventListener('click', () => {
        openPalette('review');
    });

    btnApplyDetected.addEventListener('click', async () => {
        if (state.detectedTiles.length > 0) {
            let quotaViolated = false;
            state.detectedTiles.forEach(t => {
                const inPlay = getTileCountInPlay(t);
                const limit = (t === 'J') ? STANDARD_JOKER_LIMIT : STANDARD_TILE_LIMIT;
                if (inPlay > limit) quotaViolated = true;
            });
            if (quotaViolated) {
                showToast('辨識出的牌張超過整副拉密牌庫上限 (每種數字牌最多 2 張，百搭最多 2 張)，請檢查是否有誤辨！', 'warning');
            }

            await smartMergeTilesIntoBoard(state.detectedTiles);
            saveTurnSnapshot();
            updateBoardUI();
            imageModal.style.display = 'none';
            showToast('已將辨識出的牌張智能整理並入桌面！', 'success');
        }
    });

    // ================= Preset Scenarios =================

    btnPreset.addEventListener('click', async () => {
        presetModal.style.display = 'flex';
        try {
            const resp = await fetch('/api/presets');
            const list = await resp.json();
            presetsList.innerHTML = '';
            list.forEach(item => {
                const card = document.createElement('div');
                card.className = 'preset-card';
                card.innerHTML = `
                    <h4>${item.title}</h4>
                    <p>${item.description}</p>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                        桌面: ${item.board.join(', ')} | 手牌: ${item.hand.join(', ')}
                    </div>
                `;
                card.addEventListener('click', () => {
                    state.boardGroups = chunkPresetBoard(item.board);
                    state.hand = [...item.hand];
                    if (item.id === 'icebreak_test') {
                        state.initialMeld = true;
                        initialMeldToggle.checked = true;
                    } else {
                        state.initialMeld = false;
                        initialMeldToggle.checked = false;
                    }
                    saveTurnSnapshot();
                    updateBoardUI();
                    updateHandUI();
                    presetModal.style.display = 'none';
                    executeCalculation();
                });
                presetsList.appendChild(card);
            });
        } catch (e) {
            presetsList.innerHTML = '<p>載入範例失敗</p>';
        }
    });

    function chunkPresetBoard(boardList) {
        if (boardList.length <= 4) {
            return [boardList.map(code => ({ code: code, origin: 'board' }))];
        }
        const groups = [];
        let i = 0;
        while (i < boardList.length) {
            const size = (boardList.length - i >= 4 && (boardList.length - i) % 3 !== 0) ? 4 : 3;
            groups.push(boardList.slice(i, i + size).map(code => ({ code: code, origin: 'board' })));
            i += size;
        }
        return groups;
    }

    // Default Load Preset: Table has R1-R5 & B5-Y5-K5; Hand has R4, R5
    state.boardGroups = [
        ['R1', 'R2', 'R3', 'R4', 'R5'].map(c => ({ code: c, origin: 'board' })),
        ['B5', 'Y5', 'K5'].map(c => ({ code: c, origin: 'board' }))
    ];
    state.hand = ['R4', 'R5'];
    initPalette();
    saveTurnSnapshot();
    updateBoardUI();
    updateHandUI();
});
