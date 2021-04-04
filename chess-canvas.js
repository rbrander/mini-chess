// app.js -- a mini chess game

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

// Constants
const PIECE_SET = 1
const BLACK = 'black'
const WHITE = 'white'
const EMPTY = ' '
const TILE_SIZE = 100 // 100x100 pixels for each grid square

// Images
const whiteSquare = document.getElementById('img-square-white')
const blackSquare = document.getElementById('img-square-black')
const PAWNS = {
  [WHITE]: [
    document.getElementById('img-pawn-w1'),
    document.getElementById('img-pawn-w2'),
    document.getElementById('img-pawn-w3')
  ],
  [BLACK]: [
    document.getElementById('img-pawn-b1'),
    document.getElementById('img-pawn-b2'),
    document.getElementById('img-pawn-b3')
  ]
}

// Utility functions
const isDefined = (x) => x !== undefined
const hasXY = (obj) => typeof obj === 'object' && isDefined(obj.x) && isDefined(obj.y)
const forEachBoardPiece = callback => {
  state.board.forEach((row, y) => {
    row.forEach((piece, x) => {
      callback(x, y, piece)
    })
  })
}

// Application state
const state = {
  playerTurn: WHITE,
  board: [
    [BLACK, BLACK, BLACK],
    [EMPTY, EMPTY, EMPTY],
    [WHITE, WHITE, WHITE]
  ],
  click: {
    x: undefined,
    y: undefined
  },
  prevClick: {
    x: undefined,
    y: undefined
  }
}

const movePiece = (start, end) => {
  // This will move the piece from start to end, clobbering whatever was there
  // and replacing the start position with an empty space
  state.board[end.y][end.x] = state.board[start.y][start.x]
  state.board[start.y][start.x] = EMPTY
}

let prevTick = 0
const update = (tick) => {
  if (state.playerTurn === WHITE) {
    // If there is a click; check if there is a prevClick
    const hasClick = hasXY(state.click)
    const hasPrevClick = hasXY(state.prevClick)
    if (hasClick) {
      // If there is no previous click, set that to what the current click is
      // else if there is a previous click, consider this a move from previous click to current click
      if (hasPrevClick) {
        const hasSameX = (state.prevClick.x === state.click.x)
        const hasYAbove = (state.prevClick.y = state.click.y + 1)
        const desinationIsEmpty = state.board[state.click.y][state.click.x] === EMPTY
        const isMoveForward = hasYAbove && desinationIsEmpty && hasSameX
        const isMoveAttack = hasYAbove && !desinationIsEmpty
          // X is to the left or right by 1
          && (Math.abs(state.prevClick.x - state.click.x) === 1)
        const isValidMove = isMoveForward || isMoveAttack
        if (isValidMove) {
          movePiece(state.prevClick, state.click)
          // end the turn for the white player
          state.playerTurn = BLACK
        }
        // clear previous click
        state.prevClick = { x: undefined, y: undefined }
      } else {
        // clone the click object into prevClick
        state.prevClick = { ...state.click }
      }
      // now that click has been handled, clear it for the next click
      state.click = { x: undefined, y: undefined }
    }
  } else {
    // Black player moves

    // Get all the black piece positions
    const positions = []
    forEachBoardPiece((x, y, piece) => {
      if (piece === BLACK) {
        positions.push({ x, y })
      }
    })

    // Grab a random piece and try to move it
    const randomPiece = positions[~~(Math.random() * positions.length)]
    // has room to move ahead and has empty piece ahead
    const hasRoomToMoveAhead = randomPiece.y + 1 < state.board.length
    const hasEmptySpaceAhead = hasRoomToMoveAhead
      && state.board[randomPiece.y + 1][randomPiece.x] === EMPTY
    const canMove = hasRoomToMove && hasEmptySpaceAhead

    const hasWhiteToRightDiagonally = hasRoomToMoveAhead && (randomPiece.x + 1 < state.board.length &&  state.board[randomPiece.y + 1][randomPiece.x + 1] === WHITE)
    const hasWhiteToLeftDiagonally = hasRoomToMoveAhead && (randomPiece.x - 1 >= 0 && state.board[randomPiece.y + 1][randomPiece.x - 1] === WHITE)
    const hasWhitePieceDiagonally = hasWhiteToRightDiagonally || hasWhiteToLeftDiagonally
    const canAttack = hasRoomToMoveAhead && hasWhitePieceDiagonally

    if (canAttack) {
      // attack!
      // randomly chose a left or right offset
      let offset = (Math.random() < 0.5 ? -1 : 1)
      if (hasWhiteToRightDiagonally && !hasWhiteToLeftDiagonally) {
        offset = 1
      } else if (!hasWhiteToRightDiagonally && hasWhiteToLeftDiagonally) {
        offset = -1
      }
      movePiece(randomPiece, { x: randomPiece.x + offset, y: randomPiece.y + 1 })
    } else if (canMove) {
      movePiece(randomPiece, { x: randomPiece.x, y: randomPiece.y + 1 })
      // end the turn for the black player
      state.playerTurn = WHITE
    }
  }
}

const draw = (tick) => {
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const image = (x + y) % 2 === 0 ? blackSquare : whiteSquare
      ctx.drawImage(image, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }

  // Draw the pieces
  forEachBoardPiece((x, y, piece) => {
    if (piece !== EMPTY) {
      ctx.drawImage(
        PAWNS[piece === BLACK ? 'black' : 'white'][PIECE_SET],
        x * TILE_SIZE,
        y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      )
    }
  })
}

const loop = (tick) => {
  update(tick)
  draw(tick)
  requestAnimationFrame(loop)
}

function onClick(event) {
  const { offsetX: x, offsetY: y } = event
  const gridX = ~~(x / TILE_SIZE)
  const gridY = ~~(y / TILE_SIZE)
  state.click = { x: gridX, y: gridY }
}

function init() {
  console.log('Mini Chess')
  canvas.addEventListener('click', onClick)
  requestAnimationFrame(loop)
}
init()