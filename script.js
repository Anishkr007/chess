document.addEventListener('DOMContentLoaded', () => {

    const PIECES = {
        white: {
            king: '♔', rook: '♖', bishop: '♗', queen: '♕', knight: '♘', pawn: '♙'
        },
        black: {
            king: '♚', rook: '♜', bishop: '♝', queen: '♛', knight: '♞', pawn: '♟︎'
        }
    };

    const INITIAL_BOARD = [
        // 0    1      2      3      4      5      6      7
        ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'], // 0
        ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'], // 1
        [null, null, null, null, null, null, null, null], // 2
        [null, null, null, null, null, null, null, null], // 3
        [null, null, null, null, null, null, null, null], // 4
        [null, null, null, null, null, null, null, null], // 5
        ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'], // 6
        ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']  // 7
    ];

    // DOM Elements
    const chessboardEl = document.getElementById('chessboard');
    const turnIndicatorEl = document.getElementById('turn-indicator');
    const messageEl = document.getElementById('message-display');
    const resetButton = document.getElementById('reset-button');
    const promotionModalEl = document.getElementById('promotion-modal');
    const promotionChoicesEl = document.getElementById('promotion-choices');
    const themeToggleEl = document.getElementById('theme-toggle');

    // Game State
    let board = [];
    let currentPlayer = 'w';
    let selectedPiece = null;
    let validMoves = [];
    let isGameOver = false;
    let kingPositions = { w: { row: 7, col: 4 }, b: { row: 0, col: 4 } };
    let castlingRights = { w: [true, true], b: [true, true] };
    let enPassantTarget = null;
    let promotionState = null;
    let isAnimating = false; // Prevents clicks during animation
    let lastMove = null;
    let capturedPieces = { w: [], b: [] };

    function initGame() {
        board = INITIAL_BOARD.map(row => [...row]);
        currentPlayer = 'w';
        selectedPiece = null;
        validMoves = [];
        isGameOver = false;
        isAnimating = false;
        kingPositions = { w: { row: 7, col: 4 }, b: { row: 0, col: 4 } };
        castlingRights = { w: [true, true], b: [true, true] };
        enPassantTarget = null;
        promotionState = null;
        lastMove = null;
        capturedPieces = { w: [], b: [] };
        messageEl.textContent = '\u00A0';
        turnIndicatorEl.textContent = "White's Turn";
        promotionModalEl.classList.add('hidden');
        renderBoard();
    }

    function renderBoard() {
        chessboardEl.innerHTML = '';
        let inCheckPos = getKingInCheckPos(currentPlayer);

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell', (r + c) % 2 === 0 ? 'light' : 'dark');
                cell.dataset.row = r;
                cell.dataset.col = c;

                cell.innerHTML = ''; // Clear cell for fresh render

                // Add valid move indicators first
                const move = validMoves.find(m => m.row === r && m.col === c);
                if (move) {
                    const indicatorClass = move.isCapture ? 'valid-capture-indicator' : 'valid-move-indicator';
                    cell.innerHTML = `<div class="${indicatorClass}"></div>`;
                }

                // Add piece (if any) on top
                const pieceCode = board[r][c];
                if (pieceCode) {
                    const color = pieceCode.charAt(0) === 'w' ? 'white' : 'black';
                    const type = getPieceType(pieceCode.charAt(1));
                    cell.innerHTML += `<div class="piece ${color}-piece">${PIECES[color][type]}</div>`;
                }

                if (selectedPiece && selectedPiece.row === r && selectedPiece.col === c) {
                    cell.classList.add('selected');
                }
                
                if (inCheckPos && inCheckPos.row === r && inCheckPos.col === c) {
                     cell.classList.add('in-check');
                }
                
                if (lastMove) {
                    if ((lastMove.fromRow === r && lastMove.fromCol === c) || (lastMove.toRow === r && lastMove.toCol === c)) {
                        cell.classList.add('last-move');
                    }
                }

                cell.addEventListener('click', handleCellClick);
                chessboardEl.appendChild(cell);
            }
        }
        
        renderCapturedPieces();
    }
    
    function renderCapturedPieces() {
        const whiteGrid = document.getElementById('captured-white-grid');
        const blackGrid = document.getElementById('captured-black-grid');
        
        whiteGrid.innerHTML = '';
        blackGrid.innerHTML = '';
        
        // Sort pieces by value for a tidy display
        const pieceValue = { 'q': 9, 'r': 5, 'b': 3, 'n': 3, 'p': 1, 'k': 0 };
        
        capturedPieces.w.sort((a, b) => (pieceValue[b.charAt(1)] || 0) - (pieceValue[a.charAt(1)] || 0));
        capturedPieces.b.sort((a, b) => (pieceValue[b.charAt(1)] || 0) - (pieceValue[a.charAt(1)] || 0));

        for (const pieceCode of capturedPieces.w) {
            const pieceEl = document.createElement('div');
            pieceEl.textContent = PIECES.black[getPieceType(pieceCode.charAt(1))];
            pieceEl.classList.add('black-piece', 'piece');
            whiteGrid.appendChild(pieceEl);
        }
        
        for (const pieceCode of capturedPieces.b) {
            const pieceEl = document.createElement('div');
            pieceEl.textContent = PIECES.white[getPieceType(pieceCode.charAt(1))];
            pieceEl.classList.add('white-piece', 'piece');
            blackGrid.appendChild(pieceEl);
        }
    }
    
    function handleCellClick(e) {
        // Block clicks during animation, game over, or promotion
        if (isGameOver || promotionState || isAnimating) return;

        const cell = e.currentTarget;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const pieceCode = board[row][col];

        if (selectedPiece) {
            const move = validMoves.find(m => m.row === row && m.col === col);
            if (move) {
                animateAndMakeMove(selectedPiece.row, selectedPiece.col, row, col, move);
            }
            
            selectedPiece = null;
            validMoves = [];
            renderBoard(); // Re-render to clear highlights
            
        } else if (pieceCode) {
            const pieceColor = pieceCode.charAt(0);
            if (pieceColor === currentPlayer) {
                selectedPiece = { row, col, piece: pieceCode };
                validMoves = getValidMoves(row, col, pieceCode);
                renderBoard();
            }
        }
    }

    resetButton.addEventListener('click', initGame);
    
    themeToggleEl.addEventListener('change', () => {
        if (themeToggleEl.checked) {
            chessboardEl.classList.add('dark-theme');
        } else {
            chessboardEl.classList.remove('dark-theme');
        }
    });
    
    promotionChoicesEl.addEventListener('click', (e) => {
        const choiceEl = e.target.closest('[data-piece]');
        if (choiceEl && promotionState) {
            handlePromotion(choiceEl.dataset.piece);
        }
    });
    
    
    function animateAndMakeMove(fromRow, fromCol, toRow, toCol, move) {
        isAnimating = true;
        
        const fromCell = chessboardEl.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toCell = chessboardEl.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const pieceEl = fromCell.querySelector('.piece');
        const capturedPieceEl = toCell.querySelector('.piece');
        
        if (!pieceEl) {
            isAnimating = false;
            return;
        }

        // Get positions relative to the chessboard for accurate animation
        const boardRect = chessboardEl.getBoundingClientRect();
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        
        // Clone the piece to animate it without disturbing the grid
        const movingPieceClone = pieceEl.cloneNode(true);
        movingPieceClone.style.position = 'absolute';
        movingPieceClone.style.zIndex = '1000';
        movingPieceClone.style.pointerEvents = 'none';
        chessboardEl.appendChild(movingPieceClone);

        gsap.set(movingPieceClone, {
            left: fromRect.left - boardRect.left,
            top: fromRect.top - boardRect.top,
            width: fromRect.width,
            height: fromRect.height
        });

        // Hide original piece during animation
        pieceEl.style.opacity = '0';
        
        if (capturedPieceEl) {
            gsap.to(capturedPieceEl, { opacity: 0, scale: 0.5, duration: 0.2, ease: 'power1.in' });
        }
        
        gsap.to(movingPieceClone, {
            left: toRect.left - boardRect.left,
            top: toRect.top - boardRect.top,
            duration: 0.4,
            ease: 'power2.inOut',
            onComplete: () => {
                movingPieceClone.remove();
                
                const capturedPiece = board[toRow][toCol];
                
                executeMoveLogic(fromRow, fromCol, toRow, toCol, move.isEnPassant, move.isCastle, capturedPiece);
                
                const piece = board[toRow][toCol];
                const pieceType = piece.charAt(1);
                
                // Check for promotion
                if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
                    promotionState = { fromRow, fromCol, toRow, toCol, piece, capturedPiece };
                    showPromotionModal();
                } else {
                    checkGameStatusAndSwitchPlayer();
                }
                
                isAnimating = false;
            }
        });
    }

    // This function updates the board state *only*
    function executeMoveLogic(fromRow, fromCol, toRow, toCol, isEnPassant, isCastle, capturedPiece) {
        const piece = board[fromRow][fromCol];
        const pieceType = piece.charAt(1);

        if (capturedPiece) {
            // When white (current player) captures, it's a black piece.
            // Add the captured piece to the *current* player's capture list.
            capturedPieces[currentPlayer].push(capturedPiece);
        }
        
        lastMove = { fromRow, fromCol, toRow, toCol };
        
        board[toRow][toCol] = piece;
        board[fromRow][fromCol] = null;
        
        if (pieceType === 'k') {
            kingPositions[currentPlayer] = { row: toRow, col: toCol };
            castlingRights[currentPlayer] = [false, false];
        }

        if (isEnPassant) {
            const captureRow = (currentPlayer === 'w') ? toRow + 1 : toRow - 1;
            const capturedPawn = board[captureRow][toCol];
            // The en passant-captured pawn belongs to the *opponent*
            capturedPieces[getOpponent(currentPlayer)].push(capturedPawn);
            board[captureRow][toCol] = null;
        }
        
        if (isCastle) {
            if (toCol === 6) { // Kingside
                board[fromRow][5] = board[fromRow][7];
                board[fromRow][7] = null;
            } else if (toCol === 2) { // Queenside
                board[fromRow][3] = board[fromRow][0];
                board[fromRow][0] = null;
            }
        }
        
        if (pieceType === 'r') {
            if (fromCol === 0) castlingRights[currentPlayer][1] = false; // Queenside
            if (fromCol === 7) castlingRights[currentPlayer][0] = false; // Kingside
        }
        
        if (pieceType === 'p' && Math.abs(fromRow - toRow) === 2) {
            enPassantTarget = { row: (fromRow + toRow) / 2, col: toCol };
        } else {
            enPassantTarget = null;
        }
    }
    
    function handlePromotion(chosenPiece) {
        if (!promotionState) return;
        const { toRow, toCol, piece } = promotionState;
        
        board[toRow][toCol] = piece.charAt(0) + chosenPiece;
        
        promotionState = null;
        promotionModalEl.classList.add('hidden');
        
        checkGameStatusAndSwitchPlayer();
    }

    // Checks for check/checkmate/stalemate and switches player
    function checkGameStatusAndSwitchPlayer() {
        const opponent = getOpponent(currentPlayer);
        if (isKingInCheck(opponent)) {
            if (isCheckmate(opponent)) {
                endGame(currentPlayer, 'Checkmate');
            } else {
                showMessage('Check!');
            }
        } else if (isStalemate(opponent)) {
            endGame(null, 'Stalemate');
        } else {
            clearMessage();
        }

        if (!isGameOver) {
            switchPlayer();
        } else {
            renderBoard(); // Final render
        }
    }
    
    function switchPlayer() {
        currentPlayer = getOpponent(currentPlayer);
        turnIndicatorEl.textContent = (currentPlayer === 'w' ? 'White' : 'Black') + "'s Turn";
        selectedPiece = null;
        validMoves = [];
        renderBoard();
    }
    
    function endGame(winner, reason) {
        isGameOver = true;
        const winnerName = winner === 'w' ? 'White' : 'Black';
        if (reason === 'Checkmate') {
            showMessage(`Checkmate! ${winnerName} wins!`, true);
        } else if (reason === 'Stalemate') {
            showMessage('Stalemate! It\'s a draw.', true);
        }
    }

    function getValidMoves(row, col, piece) {
        const pieceType = piece.charAt(1);
        let moves = [];

        switch (pieceType) {
            case 'p': moves = getPawnMoves(row, col, currentPlayer); break;
            case 'r': moves = getRookMoves(row, col, currentPlayer); break;
            case 'n': moves = getKnightMoves(row, col, currentPlayer); break;
            case 'b': moves = getBishopMoves(row, col, currentPlayer); break;
            case 'q': moves = getQueenMoves(row, col, currentPlayer); break;
            case 'k': moves = getKingMoves(row, col, currentPlayer); break;
        }
        
        // Filter out moves that would put the player in check
        const legalMoves = moves.filter(move => {
            // Special check for en passant
            if (move.isEnPassant) {
                return !movePutsKingInCheck(row, col, move.row, move.col, currentPlayer, move.isEnPassant);
            }
            return !movePutsKingInCheck(row, col, move.row, move.col, currentPlayer);
        });

        return legalMoves;
    }
    
    // Simulates a move to see if it results in check
    function movePutsKingInCheck(fromRow, fromCol, toRow, toCol, player, isEnPassant = false) {
        // Temporarily apply the move
        const originalPiece = board[toRow][toCol];
        const movingPiece = board[fromRow][fromCol];
        board[toRow][toCol] = movingPiece;
        board[fromRow][fromCol] = null;
        
        let enPassantPawn = null;
        let enPassantPawnPos = null;
        if (isEnPassant) {
            const captureRow = (player === 'w') ? toRow + 1 : toRow - 1;
            enPassantPawnPos = { row: captureRow, col: toCol };
            enPassantPawn = board[enPassantPawnPos.row][enPassantPawnPos.col];
            board[enPassantPawnPos.row][enPassantPawnPos.col] = null;
        }
        
        let originalKingPos = null;
        if (movingPiece.charAt(1) === 'k') {
            originalKingPos = { ...kingPositions[player] };
            kingPositions[player] = { row: toRow, col: toCol };
        }

        const inCheck = isKingInCheck(player);

        // Undo the move
        board[fromRow][fromCol] = movingPiece;
        board[toRow][toCol] = originalPiece;
        
        if (originalKingPos) {
            kingPositions[player] = originalKingPos;
        }
        
        if (isEnPassant) {
            board[enPassantPawnPos.row][enPassantPawnPos.col] = enPassantPawn;
        }
        
        return inCheck;
    }

    function isKingInCheck(player) {
        const kingPos = kingPositions[player];
        return isSquareAttacked(kingPos.row, kingPos.col, getOpponent(player));
    }
    
    function getKingInCheckPos(player) {
         if (isKingInCheck(player)) {
            return kingPositions[player];
         }
         return null;
    }
    
    function isCheckmate(player) {
        if (!isKingInCheck(player)) return false;
        
        // Check if any move can get the king out of check
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece && piece.charAt(0) === player) {
                    const moves = getValidMoves(r, c, piece);
                    if (moves.length > 0) {
                        return false; // Found a legal move
                    }
                }
            }
        }
        return true;
    }

    function isStalemate(player) {
        if (isKingInCheck(player)) return false;
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece && piece.charAt(0) === player) {
                    const moves = getValidMoves(r, c, piece);
                    if (moves.length > 0) {
                        return false; // Found a legal move
                    }
                }
            }
        }
        return true;
    }

    // --- Piece-Specific Move Generation ---
    
    function getPawnMoves(row, col, player) {
        const moves = [];
        const dir = (player === 'w') ? -1 : 1;
        const startRow = (player === 'w') ? 6 : 1;
        const opponent = getOpponent(player);

        // 1. Move one step forward
        let r = row + dir;
        if (r >= 0 && r < 8 && !board[r][col]) {
            moves.push({ row: r, col: col, isCapture: false });
            
            // 2. Move two steps forward (from start)
            if (row === startRow && !board[r + dir][col]) {
                moves.push({ row: r + dir, col: col, isCapture: false });
            }
        }
        
        // 3. Captures
        const captureCols = [col - 1, col + 1];
        for (const c of captureCols) {
            if (c >= 0 && c < 8) {
                const targetPiece = board[r][c];
                if (targetPiece && targetPiece.charAt(0) === opponent) {
                    moves.push({ row: r, col: c, isCapture: true });
                }
                
                // 4. En Passant
                if (enPassantTarget && enPassantTarget.row === r && enPassantTarget.col === c) {
                    moves.push({ row: r, col: c, isCapture: true, isEnPassant: true });
                }
            }
        }
        return moves;
    }
    
    function getRookMoves(row, col, player) {
        return getSlidingMoves(row, col, player, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
    }
    
    function getBishopMoves(row, col, player) {
        return getSlidingMoves(row, col, player, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    }
    
    function getQueenMoves(row, col, player) {
        return getSlidingMoves(row, col, player, [
            [-1, 0], [1, 0], [0, -1], [0, 1], // Rook
            [-1, -1], [-1, 1], [1, -1], [1, 1]  // Bishop
        ]);
    }
    
    function getSlidingMoves(row, col, player, directions) {
        const moves = [];
        const opponent = getOpponent(player);
        
        for (const [dr, dc] of directions) {
            for (let i = 1; i < 8; i++) {
                const r = row + dr * i;
                const c = col + dc * i;
                
                if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                
                const targetPiece = board[r][c];
                if (targetPiece) {
                    if (targetPiece.charAt(0) === opponent) {
                        moves.push({ row: r, col: c, isCapture: true });
                    }
                    break; // Blocked
                } else {
                    moves.push({ row: r, col: c, isCapture: false });
                }
            }
        }
        return moves;
    }
    
    function getKnightMoves(row, col, player) {
        const moves = [];
        const opponent = getOpponent(player);
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        for (const [dr, dc] of knightMoves) {
            const r = row + dr;
            const c = col + dc;
            
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const targetPiece = board[r][c];
                if (!targetPiece) {
                    moves.push({ row: r, col: c, isCapture: false });
                } else if (targetPiece.charAt(0) === opponent) {
                    moves.push({ row: r, col: c, isCapture: true });
                }
            }
        }
        return moves;
    }
    
    function getKingMoves(row, col, player) {
        const moves = [];
        const opponent = getOpponent(player);
        const kingMoves = [
            [-1, -1], [-1, 0], [-1, 1], [0, -1],
            [0, 1], [1, -1], [1, 0], [1, 1]
        ];
        
        for (const [dr, dc] of kingMoves) {
            const r = row + dr;
            const c = col + dc;
            
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const targetPiece = board[r][c];
                if (!targetPiece) {
                    moves.push({ row: r, col: c, isCapture: false });
                } else if (targetPiece.charAt(0) === opponent) {
                    moves.push({ row: r, col: c, isCapture: true });
                }
            }
        }
        
        // Castling
        if (!isKingInCheck(player)) {
            // Kingside
            if (castlingRights[player][0] && !board[row][col+1] && !board[row][col+2]) {
                if (!isSquareAttacked(row, col+1, opponent) && !isSquareAttacked(row, col+2, opponent)) {
                    moves.push({ row: row, col: col+2, isCapture: false, isCastle: true });
                }
            }
            // Queenside
            if (castlingRights[player][1] && !board[row][col-1] && !board[row][col-2] && !board[row][col-3]) {
                if (!isSquareAttacked(row, col-1, opponent) && !isSquareAttacked(row, col-2, opponent)) {
                    moves.push({ row: row, col: col-2, isCapture: false, isCastle: true });
                }
            }
        }
        
        return moves;
    }
    
    
    function isSquareAttacked(row, col, attacker) {
        const opponent = getOpponent(attacker);
        
        // Check for Pawns
        const pawnDir = (attacker === 'w') ? 1 : -1;
        const pawnCaptureCols = [col - 1, col + 1];
        for (const c of pawnCaptureCols) {
            if (c >= 0 && c < 8) {
                const r = row + pawnDir;
                if (r >= 0 && r < 8) {
                    if (board[r][c] === attacker + 'p') return true;
                }
            }
        }
        
        // Check for Knights
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightMoves) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                if (board[r][c] === attacker + 'n') return true;
            }
        }
        
        // Check for Sliding Pieces
        const slidingDirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1], // Rook
            [-1, -1], [-1, 1], [1, -1], [1, 1]  // Bishop
        ];
        for (const [dr, dc] of slidingDirs) {
            for (let i = 1; i < 8; i++) {
                const r = row + dr * i;
                const c = col + dc * i;
                
                if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                
                const piece = board[r][c];
                if (piece) {
                    if (piece.charAt(0) === attacker) {
                        const pieceType = piece.charAt(1);
                        const isRookMove = (dr === 0 || dc === 0);
                        const isBishopMove = (dr !== 0 && dc !== 0);
                        
                        if (pieceType === 'q') return true;
                        if (pieceType === 'r' && isRookMove) return true;
                        if (pieceType === 'b' && isBishopMove) return true;
                    }
                    break; // Blocked
                }
            }
        }
        
        // Check for King
        const kingMoves = [
            [-1, -1], [-1, 0], [-1, 1], [0, -1],
            [0, 1], [1, -1], [1, 0], [1, 1]
        ];
        for (const [dr, dc] of kingMoves) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                if (board[r][c] === attacker + 'k') return true;
            }
        }
        
        return false;
    }

    // --- Helper Functions ---

    function getPieceType(char) {
        switch (char) {
            case 'k': return 'king';
            case 'q': return 'queen';
            case 'r': return 'rook';
            case 'b': return 'bishop';
            case 'n': return 'knight';
            case 'p': return 'pawn';
            default: return '';
        }
    }
    
    function getOpponent(player) {
        return (player === 'w') ? 'b' : 'w';
    }
    
    function showMessage(msg, isPermanent = false) {
        messageEl.textContent = msg;
        messageEl.classList.add('blinking');
        if (!isPermanent) {
            setTimeout(() => {
                if(messageEl.textContent === msg) {
                   clearMessage();
                }
            }, 3000);
        }
    }

    function clearMessage() {
        messageEl.textContent = '\u00A0'; // Non-breaking space to maintain height
        messageEl.classList.remove('blinking');
    }
    
    function showPromotionModal() {
        renderBoard(); // Render board to show pawn in new position
        promotionChoicesEl.innerHTML = '';
        const color = (currentPlayer === 'w') ? 'white' : 'black';
        const pieces = ['q', 'r', 'b', 'n'];
        
        pieces.forEach(p => {
            const choice = document.createElement('div');
            choice.innerHTML = `<div class="piece ${color}-piece">${PIECES[color][getPieceType(p)]}</div>`;
            choice.dataset.piece = p;
            choice.classList.add('p-2', 'rounded-md', 'hover:bg-gray-200');
            promotionChoicesEl.appendChild(choice);
        });
        
        promotionModalEl.classList.remove('hidden');
    }

    initGame();
});