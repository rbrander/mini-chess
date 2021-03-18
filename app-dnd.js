// Mini-Chess (aka Hexapawn)
// https://en.wikipedia.org/wiki/Hexapawn

console.log('Mini-Chess Drag-n-Drop')
const gridContainer = document.querySelector('.grid-container')
const gridSquares = [...document.querySelectorAll('.grid-square')]

const WHITE_PLAYER = 'white'
const BLACK_PLAYER = 'black'
let currPlayer = WHITE_PLAYER
let draggingPiece

// utility functions
const getAllPieces = () => ([
  ...document.querySelectorAll(`.${BLACK_PLAYER}-pawn`),
  ...document.querySelectorAll(`.${WHITE_PLAYER}-pawn`)
])
// return a 3x3 array with values of WHITE_PLAYER, BLACK_PLAYER, or undefined
const getBoard = () =>
  new Array(3).fill().map((_, x) =>
    new Array(3).fill().map((__, y) => {
      const gridSquare = document.querySelector(`.grid-square[data-x="${x}"][data-y="${y}"]`)
      const hasChildren = gridSquare.childNodes.length > 0
      if (hasChildren) {
        const childImg = gridSquare.getElementsByTagName('img')[0]
        if (!childImg) return undefined
        const className = [...childImg.classList]
          .find(className => className.endsWith('-pawn'))
        const colour = className.substring(0, className.length - '-pawn'.length)
        return colour
      }
      return undefined
    })
  )

const getOpponent = () => (currPlayer === WHITE_PLAYER ? BLACK_PLAYER : WHITE_PLAYER)

// returns the player's piece at a given location, or null if there is no piece
const getPiece = (x, y) =>
  getAllPieces().filter(piece => (
    Number(piece.parentNode.dataset.x) === x &&
    Number(piece.parentNode.dataset.y) === y
  ))[0]?.dataset?.colour ?? null

// given a square on the board, return true if the draggingPiece can be placed
const isValidMove = (gridX, gridY, pieceX, pieceY, player) => {
  // check if grid and piece are on the board
  if ((gridX < 0 || gridY < 0 || pieceX < 0 || pieceY < 0) ||
      (gridX > 2 || gridY >2 || pieceX >2 || pieceY >2 )) {
    return false
  }

  // if player is white; they can only move up/down one square
  const direction = (player === WHITE_PLAYER ? -1 : 1)
  const isValidY = pieceY + direction === gridY
  if (!isValidY) {
    return false
  }

  // player should only move straight ahead unless attacking
  const diffX = (gridX - pieceX)
  const isSameX = (diffX === 0)
  const isBeside = (Math.abs(diffX) === 1)
  const pieceAtGridSquare = getPiece(gridX, gridY)
  const otherPlayer = getOpponent()
  const pieceAtGridSquareIsOpponent = pieceAtGridSquare == otherPlayer
  const pieceAtGridSquareIsEmpty = pieceAtGridSquare === null
  const isValidX = (
    (isSameX && pieceAtGridSquareIsEmpty) ||
    (isBeside && pieceAtGridSquareIsOpponent)
  )

  return isValidX
}


///////////////////////////////////////////////////////////////////
// event handler implementations

const onDragOver = (e) => {
  // allow the drop; default behaviour denies dropping
  const gridSquare = e.currentTarget
  const gridX = Number(gridSquare.dataset.x)
  const gridY = Number(gridSquare.dataset.y)
  const pieceX = Number(draggingPiece.parentNode.dataset.x)
  const pieceY = Number(draggingPiece.parentNode.dataset.y)
  const allowDrop = isValidMove(gridX, gridY, pieceX, pieceY, currPlayer)
  if (allowDrop) {
    e.preventDefault()
  }
}

const onDrop = (e) => {
  const gridSquareDroppedOn = e.currentTarget
  const opponent = getOpponent()

  // check if there is a piece currently at the grid square being dropped onto
  const { x, y } = gridSquareDroppedOn.dataset
  const hasPiece = getPiece(Number(x), Number(y)) !== null
  if (hasPiece) {
    // killed a pawn!
    console.log(`%c${currPlayer} %ctakes down a pawn of %c${opponent}`, 'color: yellow', 'color: white', 'color: red' )
    gridSquareDroppedOn.replaceChild(draggingPiece, gridSquareDroppedOn.childNodes[0])
  } else {
    gridSquareDroppedOn.appendChild(draggingPiece)
  }
  // handle end of turn

  // Check for end of game
  // - is opponent out of pawns
  // - player has a piece on opposite side
  // - opponent doesn't have any moves
  const playerPieces = [...document.getElementsByClassName(`${currPlayer}-pawn`)]
  const opponentPieces = [...document.getElementsByClassName(`${opponent}-pawn`)]
  if (opponentPieces.length === 0) {
    console.log('5Game Over, you took the last piece')
    return
  }
  // check if player has a pawn on the other side
  const targetY = (currPlayer === WHITE_PLAYER ? 0 : 2)
  const getPlayerPiecePos = (piece) => ({
    x: Number(piece.parentNode.dataset.x),
    y: Number(piece.parentNode.dataset.y)
  })
  const anyPiecesOnOtherSide = playerPieces
    .some(piece => getPlayerPiecePos(piece).y === targetY)
  if (anyPiecesOnOtherSide) {
    console.log(`Game Over %c${currPlayer}%c wins!`, 'color:yellow;font-weight:bold', 'color:lightgrey')
    return
  }


  // check if player and opponent have any moves
  const hasMoves = (player, pieces) => pieces.some(piece => {
    const { x: pieceX, y: pieceY } = getPlayerPiecePos(piece)
    const direction = (player === WHITE_PLAYER ? -1 : 1)
    const gridY = direction + pieceY
    return (
      isValidMove(0, gridY, pieceX, pieceY, player) ||
      isValidMove(1, gridY, pieceX, pieceY, player) ||
      isValidMove(2, gridY, pieceX, pieceY, player)
    )
  })
  const playerHasMoves = hasMoves(currPlayer, playerPieces)
  const opponentHasMoves = hasMoves(opponent, opponentPieces)

  const isStalemate = (playerHasMoves === false && opponentHasMoves === false)
  if (isStalemate) {
    console.log('Game Over! Stalemate!')
    return
  }

  const playerWon = (playerHasMoves === true && opponentHasMoves === false)
  if (playerWon) {
    console.log(`2Game Over! %c${currPlayer}%c WINS!`, 'color:yellow', 'color:lightgrey')
    return
  }

  const opponentWon = (playerHasMoves === false && opponentHasMoves === true)
  if (opponentWon) {
    console.log(`3Game Over! %c${opponent}%c WINS!`, 'color:yellow', 'color:lightgrey')
    return
  }

  // otherwise, game on
  gridContainer.classList.remove(`${currPlayer}-shadow`)
  gridContainer.classList.add(`${opponent}-shadow`)
  currPlayer = opponent
}

const onPieceDragStart = (e) => {
  e.target.classList.add('dragging')
  // first check to ensure the player is only moving their own piece
  const pieceColour = e.target.dataset.colour
  if (currPlayer !== pieceColour) {
    // disable dragging
    e.preventDefault()
  } else {
    draggingPiece = e.target
  }
}

const onPieceDragEnd = (e) => {
  e.target.classList.remove('dragging')
  draggingPiece = undefined
}

const onMouseOver = (e) => {
  const canMove = true
  if (canMove) {
    e.currentTarget.classList.add('draggable')
  } else {
    e.currentTarget.classList.delete('draggable')
  }
}


// setup event handlers
getAllPieces().forEach(piece => {
  piece.addEventListener('dragstart', onPieceDragStart)
  piece.addEventListener('dragend', onPieceDragEnd)
})
gridSquares.forEach(gridSquare => {
  gridSquare.addEventListener('dragover', onDragOver)
  gridSquare.addEventListener('drop', onDrop)
  gridSquare.addEventListener('mouseover', onMouseOver)
})
