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

    // --- DOM Elements ---
    const chessboardEl = document.getElementById('chessboard');
    const turnIndicatorEl = document.getElementById('turn-indicator');
    const messageEl = document.getElementById('message-display');
    const resetButton = document.getElementById('reset-button');
    const promotionModalEl = document.getElementById('promotion-modal');
    const promotionChoicesEl = document.getElementById('promotion-choices');

    // --- Game State ---
    let board = [];
    let currentPlayer = 'w';
    let selectedPiece = null; // { row, col, piece }
    let validMoves = [];
    let isGameOver = false;
    let kingPositions = { w: { row: 7, col: 4 }, b: { row: 0, col: 4 } };
    // Castling rights: [kingside, queenside]
    let castlingRights = { w: [true, true], b: [true, true] };
    let enPassantTarget = null; // { row, col }
    let promotionState = null; // { fromRow, fromCol, toRow, toCol }
    
    // New state for advanced features
    let lastMove = null; // { fromRow, fromCol, toRow, toCol }
    let capturedPieces = { w: [], b: [] }; // w: [black pieces], b: [white pieces]

    // --- Initialization ---
    function initGame() {
        // Deep copy the initial board
        board = INITIAL_BOARD.map(row => [...row]);
        currentPlayer = 'w';
        selectedPiece = null;
        validMoves = [];
        isGameOver = false;
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

    // --- Rendering ---
    function renderBoard() {
        chessboardEl.innerHTML = '';
        let inCheckPos = getKingInCheckPos(currentPlayer);

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell', (r + c) % 2 === 0 ? 'light' : 'dark');
                cell.dataset.row = r;
                cell.dataset.col = c;

                const pieceCode = board[r][c];
                if (pieceCode) {
                    const color = pieceCode.charAt(0) === 'w' ? 'white' : 'black';
                    const type = getPieceType(pieceCode.charAt(1));
                    cell.textContent = PIECES[color][type];
                    cell.classList.add(color === 'white' ? 'white-piece' : 'black-piece');
                }

                // Highlight selected
                if (selectedPiece && selectedPiece.row === r && selectedPiece.col === c) {
                    cell.classList.add('selected');
                }
                
                // Highlight king in check
                if (inCheckPos && inCheckPos.row === r && inCheckPos.col === c) {
                     cell.classList.add('in-check');
                }
                
                // Highlight last move
                if (lastMove) {
                    if ((lastMove.fromRow === r && lastMove.fromCol === c) || (lastMove.toRow === r && lastMove.toCol === c)) {
                        cell.classList.add('last-move');
                    }
                }

                // Highlight valid moves
                const move = validMoves.find(m => m.row === r && m.col === c);
                if (move) {
                    cell.classList.add(move.isCapture ? 'valid-capture' : 'valid-move');
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
        
        // Sort pieces by value (optional but nice)
        const pieceValue = { 'q': 9, 'r': 5, 'b': 3, 'n': 3, 'p': 1, 'k': 0 };
        
        capturedPieces.w.sort((a, b) => (pieceValue[b.charAt(1)] || 0) - (pieceValue[a.charAt(1)] || 0));
        capturedPieces.b.sort((a, b) => (pieceValue[b.charAt(1)] || 0) - (pieceValue[a.charAt(1)] || 0));

        // Render black pieces captured by white
        for (const pieceCode of capturedPieces.w) {
            const pieceEl = document.createElement('div');
            pieceEl.textContent = PIECES.black[getPieceType(pieceCode.charAt(1))];
            pieceEl.classList.add('black-piece');
            whiteGrid.appendChild(pieceEl);
        }
        
        // Render white pieces captured by black
        for (const pieceCode of capturedPieces.b) {
            const pieceEl = document.createElement('div');
            pieceEl.textContent = PIECES.white[getPieceType(pieceCode.charAt(1))];
            pieceEl.classList.add('white-piece');
            blackGrid.appendChild(pieceEl);
        }
    }
    
    // --- Event Handlers ---
    function handleCellClick(e) {
        if (isGameOver || promotionState) return;

        // Use currentTarget to get the cell, even if piece is clicked
        const cell = e.currentTarget;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const pieceCode = board[row][col];

        if (selectedPiece) {
            const move = validMoves.find(m => m.row === row && m.col === col);
            if (move) {
                // Get captured piece *before* making the move
                const capturedPiece = board[row][col];
                // Make the move
                makeMove(selectedPiece.row, selectedPiece.col, row, col, move.isEnPassant, move.isCastle, capturedPiece);
            }
            
            // Deselect
            selectedPiece = null;
            validMoves = [];
            renderBoard(); // Re-render to clear highlights
            
        } else if (pieceCode) {
            const pieceColor = pieceCode.charAt(0);
            if (pieceColor === currentPlayer) {
                // Select the piece
                selectedPiece = { row, col, piece: pieceCode };
                validMoves = getValidMoves(row, col, pieceCode);
                renderBoard(); // Re-render to show highlights
            }
        }
    }

    resetButton.addEventListener('click', initGame);
    
    promotionChoicesEl.addEventListener('click', (e) => {
        const choice = e.target.dataset.piece;
        if (choice && promotionState) {
            handlePromotion(choice);
        }
    });

    // --- Move Logic ---
    function makeMove(fromRow, fromCol, toRow, toCol, isEnPassant = false, isCastle = false, capturedPiece = null) {
        const piece = board[fromRow][fromCol];
        const pieceType = piece.charAt(1);

        // --- Handle Pawn Promotion ---
        if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
            // Don't switch player yet, wait for promotion choice
            board[toRow][toCol] = board[fromRow][fromCol];
            board[fromRow][fromCol] = null;
            promotionState = { fromRow, fromCol, toRow, toCol, piece, capturedPiece };
            showPromotionModal();
            renderBoard();
            return; // Stop execution until choice is made
        }
        
        // --- Complete The Move ---
        // This function is called either directly or after promotion
        completeMove(fromRow, fromCol, toRow, toCol, piece, isEnPassant, isCastle, capturedPiece);
    }
    
    function handlePromotion(chosenPiece) {
        if (!promotionState) return;
        const { fromRow, fromCol, toRow, toCol, piece, capturedPiece } = promotionState;
        
        // Add captured piece (if any)
        if (capturedPiece) {
            capturedPieces[getOpponent(currentPlayer)].push(capturedPiece);
        }
        
        // Set last move
        lastMove = { fromRow, fromCol, toRow, toCol };
        
        board[toRow][toCol] = piece.charAt(0) + chosenPiece; // e.g., 'wq'
        
        promotionState = null;
        promotionModalEl.classList.add('hidden');
        
        // Now, complete the turn
        const opponent = getOpponent(currentPlayer);
        if (isKingInCheck(opponent)) {
            if (isCheckmate(opponent)) {
                endGame(currentPlayer, 'Checkmate');
            } else {
                showMessage('Check!');
            }
        } else if (isStalemate(opponent)) {
            endGame(null, 'Stalemate');
        }
        
        switchPlayer();
    }

    function completeMove(fromRow, fromCol, toRow, toCol, piece, isEnPassant, isCastle, capturedPiece) {
        const pieceType = piece.charAt(1);
        
        // Add captured piece (if not promotion)
        if (capturedPiece) {
            capturedPieces[getOpponent(currentPlayer)].push(capturedPiece);
        }
        
        // Set last move
        lastMove = { fromRow, fromCol, toRow, toCol };
        
        // Move the piece
        board[toRow][toCol] = piece;
        board[fromRow][fromCol] = null;
        
        // Update king position if moved
        if (pieceType === 'k') {
            kingPositions[currentPlayer] = { row: toRow, col: toCol };
            // Invalidate castling rights
            castlingRights[currentPlayer] = [false, false];
        }

        // Handle En Passant capture
        if (isEnPassant) {
            const captureRow = (currentPlayer === 'w') ? toRow + 1 : toRow - 1;
            const capturedPawn = board[captureRow][toCol];
            capturedPieces[getOpponent(currentPlayer)].push(capturedPawn);
            board[captureRow][toCol] = null;
        }
        
        // Handle Castling rook move
        if (isCastle) {
            if (toCol === 6) { // Kingside
                board[fromRow][5] = board[fromRow][7];
                board[fromRow][7] = null;
            } else if (toCol === 2) { // Queenside
                board[fromRow][3] = board[fromRow][0];
                board[fromRow][0] = null;
            }
        }
        
        // Update castling rights if rooks move
        if (pieceType === 'r') {
            if (fromCol === 0) castlingRights[currentPlayer][1] = false; // Queenside
            if (fromCol === 7) castlingRights[currentPlayer][0] = false; // Kingside
        }
        
        // Set new en passant target (if pawn moves 2)
        if (pieceType === 'p' && Math.abs(fromRow - toRow) === 2) {
            enPassantTarget = { row: (fromRow + toRow) / 2, col: toCol };
        } else {
            enPassantTarget = null;
        }

        // --- Check for Game End ---
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
            renderBoard(); // Final render for checkmate
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

    // --- Move Validation ---

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
        
        // Filter out moves that put the king in check
        const legalMoves = moves.filter(move => {
            return !movePutsKingInCheck(row, col, move.row, move.col, currentPlayer);
        });

        return legalMoves;
    }
    
    function movePutsKingInCheck(fromRow, fromCol, toRow, toCol, player) {
        // Simulate the move
        const originalPiece = board[toRow][toCol];
        const movingPiece = board[fromRow][fromCol];
        board[toRow][toCol] = movingPiece;
        board[fromRow][fromCol] = null;
        
        // Update king position temporarily if king moved
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
        return true; // No legal moves
    }

    function isStalemate(player) {
        if (isKingInCheck(player)) return false;
        
        // Check if player has any legal moves
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
        return true; // No legal moves
    }

    // --- Piece-Specific Move Generation ---
    
    function getPawnMoves(row, col, player) {
        const moves = [];
        const dir = (player === 'w') ? -1 : 1; // Direction of movement
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
                
                if (r < 0 || r >= 8 || c < 0 || c >= 8) break; // Off board
                
                const targetPiece = board[r][c];
                if (targetPiece) {
                    if (targetPiece.charAt(0) === opponent) {
                        moves.push({ row: r, col: c, isCapture: true }); // Capture
                    }
                    break; // Blocked by own or enemy piece
                } else {
                    moves.push({ row: r, col: c, isCapture: false }); // Empty square
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
    
    // --- Attack Checking ---
    
    function isSquareAttacked(row, col, attacker) {
        const opponent = getOpponent(attacker);
        
        // 1. Check for Pawns
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
        
        // 2. Check for Knights
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
        
        // 3. Check for Sliding Pieces (Rook, Bishop, Queen)
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
        
        // 4. Check for King
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

    // --- UI & Helper Functions ---

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
                if(messageEl.textContent === msg) { // Only clear if it's the same message
                   clearMessage();
                }
            }, 3000);
        }
    }

    function clearMessage() {
        messageEl.textContent = '\u00A0'; // Non-breaking space
        messageEl.classList.remove('blinking');
    }
    
    function showPromotionModal() {
        promotionChoicesEl.innerHTML = '';
        const color = (currentPlayer === 'w') ? 'white' : 'black';
        const pieces = ['q', 'r', 'b', 'n'];
        
        pieces.forEach(p => {
            const choice = document.createElement('div');
            choice.textContent = PIECES[color][getPieceType(p)];
            choice.dataset.piece = p;
            choice.classList.add(color === 'white' ? 'white-piece' : 'black-piece', 'p-2', 'rounded-md', 'hover:bg-gray-200');
            promotionChoicesEl.appendChild(choice);
        });
        
        promotionModalEl.classList.remove('hidden');
    }

    // --- Start Game ---
    initGame();
});