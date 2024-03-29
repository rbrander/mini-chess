'use strict';
// chess-isometric.js
// "Tri-Pawn Challenge" is a game of three pawns per player to force a stalemate

// TODO
// - make it mobile friendly
// - add screen transitions between game states
// - add the ability to deselect a piece by clicking on it once it is selected?
// - add sound
// - add unit tests for some of the functions

// get DOM references
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imgWhitePiece = document.getElementById('white-piece');
const imgBlackPiece = document.getElementById('black-piece');

// constants
const POINTER_RADIUS = 10;

const BACKGROUND_COLOR = '#225566';
const WHITE_TILE_COLOR = '#CCCCCC';
const BLACK_TILE_COLOR = '#444444';
const HIGHLIGHT_COLOR = 'rgba(255, 173, 0, 0.5)'; // #FFAD00

const FONT_NAME = 'Righteous';
const DEFAULT_TEXT_SIZE_MULTIPLIER = 40; // 1/40th of the canvas height is used for the font size (e.g. 800px canvas height / 40 = 20px font)

const NUM_MENU_SECTIONS = 5; // content is displayed in different sections, each section is a fraction of the canvas height, full width
// NOTE: section 0 and 4 are reserved for padding
const MENU_TITLE_SECTION = 1;
const MENU_ONE_PLAYER_SECTION = 2;
const MENU_TWO_PLAYER_SECTION = 3;
const MENU_OPTIONS = [
  { text: '  1 - Player  ', section: MENU_ONE_PLAYER_SECTION, pieces: [ imgWhitePiece ] },
  { text: '  2 - Player  ', section: MENU_TWO_PLAYER_SECTION, pieces: [ imgBlackPiece, imgWhitePiece ] }
];

const TILE_SIZE = 250; // pixels
const TILE_WIDTH = TILE_SIZE;
const TILE_HEIGHT = TILE_WIDTH / 2;
const HALF_TILE_WIDTH = TILE_WIDTH / 2;
const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;

const BOARD_WIDTH = 3; // number of board squares wide
const BOARD_HEIGHT = 3; // number of board squares high

const BLACK_PIECE = 'Black';
const WHITE_PIECE = 'White';
const NO_PIECE = 'Empty';


// state
let pointerX = 0, pointerY = 0, isPointerDown = false, hasPointer = false;
let winner = NO_PIECE; // to be determined once the game is over; used for display purpose only
let numPlayers = 1;
let currPlayer = WHITE_PIECE;
let selectedTile = undefined;
const INITIAL_BOARD = [
  [BLACK_PIECE, BLACK_PIECE, BLACK_PIECE],
  [NO_PIECE, NO_PIECE, NO_PIECE],
  [WHITE_PIECE, WHITE_PIECE, WHITE_PIECE]
];
let board = [];
let animationStart = undefined; // holds the tick value of the start of the animation
let animationMove = undefined; // holds an object { pieceX, pieceY, destX, destY } when animating
let animationPercentage = 0; // value between 0 and 1 inclusive
const PIECE_ANIMATION_DURATION = 500; // in milliseconds

// game states
const GAME_STATE_MENU = 'Main Menu';
const GAME_STATE_PLAYING = 'Playing';
const GAME_STATE_GAME_OVER = 'Game Over!';
// This is a finite state machine: (menu)->(playing)->(gameover)->(menu)
let gameState = GAME_STATE_MENU;

// isometric utility functions
const cartesianToIsometric = (x, y) => [x + y, 0.5 * (y - x)];
const isometricToCartesian = (x, y) => [Math.round(0.5 * x - y), Math.round(0.5 * x + y)];
const fromIso = (x, y) => isometricToCartesian(x / HALF_TILE_WIDTH, y / HALF_TILE_WIDTH);
const toIso = (x, y) => {
  const [isoX, isoY] = cartesianToIsometric(x, y);
  return [isoX * HALF_TILE_WIDTH, isoY * HALF_TILE_WIDTH];
};

const getOpponent = (player) => player === WHITE_PIECE ? BLACK_PIECE : WHITE_PIECE;

const getMenuSectionHeight = () => canvas.height / NUM_MENU_SECTIONS;

// given a piece (black, white, or no-piece), return all the grid locations in a 2 array
const getPieceLocations = (piece) =>
  // using the board iterate over it to find pieces and return their locations
  board.map((row, yPosition) =>
    row.map((boardPiece, xPosition) => piece === boardPiece ? [xPosition, yPosition] : null)
      .filter(coordinates => coordinates !== null)
  ).flat();

// TODO: check if player can be optional; given the coordinates we could lookup the player using the board
const getValidMoves = (x, y, player) => {
  // pawns can move in one of three possible ways: forward, forward-right, forward-left
  // the pawn can only move forward if the cell is empty
  // the pawn can only move diagonally if the cell has an opponent pawn
  const validMoves = [];

  // forward check
  // use the yOffset to determine which direction is forward (relative to y)
  const yOffset = player === WHITE_PIECE ? -1 : +1;
  const cellForwardY = y + yOffset;
  const isCellForwardInBounds = cellForwardY >= 0 && cellForwardY < BOARD_HEIGHT;
  const isCellForwardEmpty = isCellForwardInBounds && board[cellForwardY][x] === NO_PIECE;
  const canMoveForward = isCellForwardInBounds && isCellForwardEmpty;
  if (canMoveForward) {
    validMoves.push({ x, y: cellForwardY });
  }

  // forward left and right
  // use the xOffset to determine which direction to evaluate (left/right)
  const opponent = getOpponent(player);
  for (let xOffset of [-1, +1]) {
    const cellAheadX = x + xOffset;
    const isCellAheadInBounds = cellAheadX >= 0 && cellAheadX < BOARD_WIDTH;
    const isCellAheadOpponent = isCellForwardInBounds && isCellAheadInBounds && board[cellForwardY][cellAheadX] === opponent;
    const canAttack = isCellAheadInBounds && isCellAheadOpponent;
    if (canAttack) {
      validMoves.push({ x: cellAheadX, y: cellForwardY });
    }
  }

  return validMoves;
};

// update the board to clobber the piece at destination with piece at source, replacing source with empty
// TODO: perhaps name it updatePieceLocation?
const movePiece = (sourceX, sourceY, destinationX, destinationY) => {
  board[destinationY][destinationX] = board[sourceY][sourceX];
  board[sourceY][sourceX] = NO_PIECE;
};

// checks if game is over by seeing if either opponent is out of moves
const isGameOver = (currPlayer) => {
  // get all pieces for a player
  const playerPieceLocations = getPieceLocations(currPlayer);
  const validPlayerMoves = playerPieceLocations.map(([x, y]) => getValidMoves(x, y, currPlayer)).flat();
  const playerCanMove = validPlayerMoves.length > 0;

  // check opponent
  const opponent = getOpponent(currPlayer);
  const opponentPieceLocations = getPieceLocations(opponent);
  const validOpponentMoves = opponentPieceLocations.map(([x, y]) => getValidMoves(x, y, opponent)).flat();
  const opponentCanMove = validOpponentMoves.length > 0;

  // game is over when there is a stalemate; when a player cannot move
  const isGameOver = !playerCanMove || !opponentCanMove;
  if (isGameOver) {
    // determine the winner
    if (playerCanMove && !opponentCanMove) {
      winner = currPlayer;
    } else if (!playerCanMove && opponentCanMove) {
      winner = opponent;
    } else {
      // if the last move caused both players to put into stalemate, the last player (opponent) is the winner
      winner = opponent
    }
  }

  return isGameOver;
};

// Used in 1-player game to determine opponents next move
// returns an object: { pieceX, pieceY, destX, destY }
const getRandomBlackMove = () => {
  let pieceLocations = getPieceLocations(BLACK_PIECE);
  let playerMove = undefined;
  while (pieceLocations.length > 0 && playerMove === undefined) {
    // find a random index to pop off the array
    const randomIndex = Math.floor(Math.random() * pieceLocations.length);
    const [pieceX, pieceY] = pieceLocations.splice(randomIndex, 1)[0];

    // get valid moves and if there are none, find another piece
    const validMoves = getValidMoves(pieceX, pieceY, BLACK_PIECE);
    const hasValidMoves = validMoves.length > 0;
    if (hasValidMoves) {
      // grab a random move
      const validMoveRandomIndex = validMoves.length === 1 ? 0 : Math.floor(Math.random() * validMoves.length)
      const validMove = validMoves[validMoveRandomIndex];
      // set the playerMove (to move the piece) and break out of the loop
      playerMove = { pieceX, pieceY, destX:validMove.x, destY:validMove.y };
      // break out of loop
      break;
    }
    // else find another piece to move, by looping back up
  }
  return playerMove;
};

const resetGame = () => {
  selectedTile = undefined;
  winner = NO_PIECE;
  currPlayer = WHITE_PIECE;
  board = JSON.parse(JSON.stringify(INITIAL_BOARD));
  gameState = GAME_STATE_MENU;
};

// x is the progress (value between 0 and 1 inclusive)
// function taken from https://easings.net/#easeInBack
function easeInBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * x * x * x - c1 * x * x;
}


const measureTextWidth = (text, fontSize) => {
  if (fontSize !== undefined && typeof fontSize === 'number' && fontSize > 0) {
    ctx.font = `${fontSize}px ${FONT_NAME}`;
  }
  const { width } = ctx.measureText(text);
  return width;
};

const measureTextHeight = (text, fontSize) => {
  if (fontSize !== undefined && typeof fontSize === 'number' && fontSize > 0) {
    ctx.font = `${fontSize}px ${FONT_NAME}`;
  }
  const { actualBoundingBoxAscent, actualBoundingBoxDescent } = ctx.measureText(text);
  return Math.abs(actualBoundingBoxAscent + actualBoundingBoxDescent);
};



// Drawing functions

// returns a hex color code that is darker than the hexColor provided by a given amount (beteween 0 and 1)
const darkenColor = (hexColor, amount) => {
  // Remove the '#' character from the beginning of the hex color code and
  // Convert the hex color code to a decimal number
  const decimalColor = parseInt(hexColor.replace('#', ''), 16);
  // Calculate the amount to darken the color by
  const darkenedDecimalColor = ((decimalColor >> 1) & 0x7f7f7f) * (1 - amount);
  // Convert the decimal color back to a hex color code
  const darkenedHexColor = '#' + (darkenedDecimalColor.toString(16)).padStart(6, '0');
  return darkenedHexColor;
};

const drawTile = (x, y, color, shouldDrawBottom = false, tileWidth = TILE_WIDTH) => {
  const halfTileHeight = tileWidth / 4;
  const halfTileWidth = tileWidth / 2;
  const topPoint = [0, -halfTileHeight];
  const rightPoint = [+halfTileWidth, 0];
  const bottomPoint = [0, +halfTileHeight];
  const leftPoint = [-halfTileWidth, 0];

  // move the canvas to x,y to draw relative to 0,0
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.moveTo(...topPoint);
  ctx.lineTo(...rightPoint);
  ctx.lineTo(...bottomPoint);
  ctx.lineTo(...leftPoint);
  ctx.lineTo(...topPoint);
  ctx.lineTo(...rightPoint);
  ctx.fillStyle = color;
  ctx.fill();

  // draw a bottom edge to show thickness of the tile
  if (shouldDrawBottom) {
    const BOTTOM_THICKNESS = 10; // pixels

    // draw left side
    ctx.beginPath();
    ctx.moveTo(...leftPoint);
    ctx.lineTo(leftPoint[0], leftPoint[1] + BOTTOM_THICKNESS);
    ctx.lineTo(bottomPoint[0], bottomPoint[1] + BOTTOM_THICKNESS);
    ctx.lineTo(...bottomPoint);
    ctx.lineTo(...leftPoint);
    ctx.fillStyle = darkenColor(color, -0.5);
    ctx.fill();

    // draw right side
    ctx.beginPath();
    ctx.moveTo(...bottomPoint);
    ctx.lineTo(bottomPoint[0], bottomPoint[1] + BOTTOM_THICKNESS);
    ctx.lineTo(rightPoint[0], rightPoint[1] + BOTTOM_THICKNESS);
    ctx.lineTo(...rightPoint);
    ctx.lineTo(...bottomPoint);
    ctx.fillStyle = darkenColor(color, 0);
    ctx.fill();
  }

  // revert the position of the canvas
  ctx.translate(-x, -y);
};

const drawPiece = (x, y, image) => {
  const halfImageWidth = image.width / 2;
  const halfImageHeight = image.height * 0.75;
  ctx.drawImage(image, x - halfImageWidth, y - halfImageHeight);
};

const drawBackground = () => {
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const drawPointer = () => {
  // short-circuit if mouse is out of bounds
  if (!hasPointer) {
    return;
  }

  if (isPointerDown) {
    // fill the center if pointer is down
    ctx.fillStyle = BLACK_TILE_COLOR;
    ctx.beginPath()
    ctx.arc(pointerX, pointerY, POINTER_RADIUS, 0, Math.PI * 2)
    ctx.fill();
  }
  // dark ring
  ctx.lineWidth = 5;
  ctx.strokeStyle = BLACK_TILE_COLOR;
  ctx.beginPath()
  ctx.arc(pointerX, pointerY, POINTER_RADIUS, 0, Math.PI * 2)
  ctx.stroke();
  // light ring
  ctx.strokeStyle = WHITE_TILE_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath()
  ctx.arc(pointerX, pointerY, POINTER_RADIUS, 0, Math.PI * 2)
  ctx.stroke();
};

const drawCurrentPlayerIndicator = () => {
  // draw a piece in the players corner along with text to indicate players turn
  const BUFFER_FROM_EDGE = 20; // pixels
  const isWhitesTurn = (currPlayer === WHITE_PIECE);

  // draw a piece in the player's corner
  const pieceX = isWhitesTurn ? (canvas.width - imgWhitePiece.width - BUFFER_FROM_EDGE) : BUFFER_FROM_EDGE;
  const pieceY = isWhitesTurn ? (canvas.height - imgWhitePiece.height - BUFFER_FROM_EDGE) : BUFFER_FROM_EDGE;
  const pieceImage = isWhitesTurn ? imgWhitePiece : imgBlackPiece;
  ctx.drawImage(pieceImage, pieceX, pieceY);

  // draw text beside piece to indicate player's turn
  const halfImageHeight = (pieceImage.height / 2);
  const textX = isWhitesTurn ? (pieceX - BUFFER_FROM_EDGE) : (pieceX + imgBlackPiece.width + BUFFER_FROM_EDGE);
  const textY = pieceY + halfImageHeight;
  const textAlign = isWhitesTurn ? 'right' : 'left';
  drawText(`${currPlayer}'s turn`, textX, textY, halfImageHeight, textAlign);
};

const drawBoardTiles = (xOffset, yOffset) => {
  const [pointerTileX, pointerTileY] = fromIso(pointerX - xOffset, pointerY - yOffset);
  const hasSelectedTile = selectedTile !== undefined;
  const validMoves = hasSelectedTile ? getValidMoves(selectedTile.x, selectedTile.y, currPlayer) : getValidMoves(pointerTileX, pointerTileY, currPlayer);
  const canMove = validMoves.length > 0;
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = BOARD_WIDTH - 1; x >= 0; x--) {
      const [isoX, isoY] = toIso(x, y);
      let color = (x + y) % 2 == 0 ? WHITE_TILE_COLOR : BLACK_TILE_COLOR
      const shouldDrawBottom = ((x === 0) || (y === (BOARD_HEIGHT - 1)));
      drawTile(xOffset + isoX, yOffset + isoY, color, shouldDrawBottom);

      // if the pointer is over the current tile, and its the tile of a current player
      // highlight it by drawing a highlighed tile on top of the existing tile
      // using transparency on the colour
      const isValidMove = validMoves.some(cell => cell.x === x && cell.y === y);
      const tileHasCurrentPlayersPiece = currPlayer === board[y][x];
      const tileHasMovablePiece = tileHasCurrentPlayersPiece && canMove;
      const isPointerOverTile = pointerTileX === x && pointerTileY === y;
      const shouldHighlightTile = (hasSelectedTile && isValidMove) || (!hasSelectedTile && isPointerOverTile && tileHasMovablePiece);
      if (shouldHighlightTile) {
        drawTile(xOffset + isoX, yOffset + isoY, HIGHLIGHT_COLOR, false, TILE_WIDTH * 0.9 /* 90% of the width of a tile */);
      }
    }
  }
};

const drawPieces = (xOffset, yOffset) => {
  for (let y = 0; y < board.length; y++) {
    for (let x = board[y].length - 1; x >= 0; x--) {
      const piece = board[y][x];
      if (piece === NO_PIECE) {
        continue;
      }

      const pieceGridPosition = { x, y };
      const isAnimatingPiece = typeof animationMove === 'object' && animationMove.pieceX === x && animationMove.pieceY === y;
      if (isAnimatingPiece) {
        const xRange = (animationMove.destX - animationMove.pieceX);
        const yRange = (animationMove.destY - animationMove.pieceY);
        const percentageEased = easeInBack(animationPercentage);
        pieceGridPosition.x = percentageEased * xRange + animationMove.pieceX;
        pieceGridPosition.y = percentageEased * yRange + animationMove.pieceY;
      }

      const [isoX, isoY] = toIso(pieceGridPosition.x, pieceGridPosition.y);
      const pieceImage = piece === BLACK_PIECE ? imgBlackPiece : imgWhitePiece;
      drawPiece(xOffset + isoX, yOffset + isoY, pieceImage);
    }
  }
};

const drawBoardWithPieces = () => {
  const gridWidth = TILE_WIDTH * 2;
  const xOffset = (canvas.width - gridWidth) / 2;
  const yOffset = (canvas.height / 2);
  drawBoardTiles(xOffset, yOffset);
  drawPieces(xOffset, yOffset);
};

const drawText = (text, x, y, fontSize, align = 'center', baseline = 'middle', isGlowing = false) => {
  ctx.font = `${fontSize}px ${FONT_NAME}`;
  ctx.lineWidth = fontSize / 30;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'white';
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  // set the blue if the flag is set
  if (isGlowing) {
    const blur = fontSize / 5;
    ctx.shadowBlur = blur;
    ctx.shadowColor = 'white';
  }

  // draw the text
  ctx.fillText(text, x, y);
  ctx.strokeText(text, x, y);

  // reset the shadow blur
  ctx.shadowBlur = 0;
}


// Game State drawing functions

const drawMenu = (tick) => {
  // draw background sections
  const sectionHeight = getMenuSectionHeight();
  const pointerSection = hasPointer ? Math.floor(pointerY / sectionHeight) : -1;
  for (let section = 0; section < NUM_MENU_SECTIONS; section++) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    if (section === MENU_TITLE_SECTION) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    }
    ctx.fillRect(0, sectionHeight * section, canvas.width, sectionHeight);
  }

  // draw the title text
  const canvasMiddleX = canvas.width / 2;
  const titleYOffset = (MENU_TITLE_SECTION + 0.5) * sectionHeight; // get the half way pointer of the title section
  const titleText = 'Tri-Pawn Challenge';
  let titleFontSize = sectionHeight * 0.5; // 50% of the section for title
  const titleTextWidth = measureTextWidth(titleText, titleFontSize);
  const maxContentWidth = (canvas.width * 0.8); // use 80% of canvas width so there is room for 10% padding on each side
  if (titleTextWidth > maxContentWidth) {
    // Break up the two words in the title into two lines and make fit
    const [firstWord, secondWord] = titleText.split(' ');
    const firstWordWidth = measureTextWidth(firstWord);
    const secondWordWidth = measureTextWidth(secondWord);
    const maxWidth = Math.max(firstWordWidth, secondWordWidth);
    if (maxWidth > maxContentWidth) {
      const aspectRatio = titleFontSize / maxWidth;
      const newFontSize = aspectRatio * maxContentWidth;
      titleFontSize = newFontSize;
    }
    drawText(firstWord, canvasMiddleX, titleYOffset, titleFontSize, 'center', 'bottom');
    drawText(secondWord, canvasMiddleX, titleYOffset, titleFontSize, 'center', 'top');
  } else {
    drawText(titleText, canvasMiddleX, titleYOffset, titleFontSize);
  }

  // measure the text at the desired font size to see if it fits on the screen, if not, resize the font
  const desiredOptionFontSize = sectionHeight * 0.4; // 40% of the section height in pixels
  const maxOptionTextWidth = MENU_OPTIONS
    .map(option => measureTextWidth(option.text, desiredOptionFontSize))
    .reduce((maxOptionTextWidth, optionTextWidth) => Math.ceil(optionTextWidth > maxOptionTextWidth ? optionTextWidth : maxOptionTextWidth));
  // set the font size to be used, defaulting to desired size
  let optionFontSize = desiredOptionFontSize;
  if (maxOptionTextWidth > maxContentWidth) {
    const aspectRatio = desiredOptionFontSize / maxOptionTextWidth;
    const newFontSize = aspectRatio * maxContentWidth;
    optionFontSize = newFontSize;
  }

  // calculate the size of the pieces, to see if we can fit them on the screen
  // note: this assumes the white piece is the same size as the black piece
  const maxOptionTextHeight = MENU_OPTIONS
    .map(option => measureTextHeight(option.text, optionFontSize))
    .reduce((maxOptionTextHeight, optionTextHeight) => Math.ceil(optionTextHeight > maxOptionTextHeight ? optionTextHeight : maxOptionTextHeight));
  const pieceHeight = maxOptionTextHeight * 1.5;
  const pieceAspectRatio = (pieceHeight / imgWhitePiece.height);
  const pieceWidth = pieceAspectRatio * imgWhitePiece.width;
  const maxOptionPieces = MENU_OPTIONS.reduce((maxOptionPieces, option) => (option?.pieces?.length ?? 0) > maxOptionPieces ? (option?.pieces?.length ?? 0) : maxOptionPieces, 0);
  const totalWidthNeeded = maxOptionTextWidth + (pieceWidth * maxOptionPieces) * 2; // *2 to include image widths on both sides of the text
  const hasEnoughSpaceToDrawPieces = (totalWidthNeeded < maxContentWidth);

  // draw the options
  MENU_OPTIONS.forEach((option) => {
    const yOffset = (option.section + 0.5) * sectionHeight; // add 0.5 to the section to the get middle of the section
    const isPointerOverOption = pointerSection === option.section;
    drawText(option.text, canvasMiddleX, yOffset, optionFontSize, 'center', 'middle', isPointerOverOption);
    const optionTextWidth = measureTextWidth(option.text);

      // draw the option's pieces from middle, out
    if (hasEnoughSpaceToDrawPieces) {
      const leftSideOfOptionText = (canvas.width - optionTextWidth) / 2;
      option.pieces.forEach((piece, pieceIndex) => {
        const xOffset = pieceIndex * pieceWidth;
        // draw on the left side of the text
        ctx.drawImage(piece,
          leftSideOfOptionText - pieceWidth - xOffset, yOffset - pieceHeight / 2,
          pieceWidth, pieceHeight
        );
        // draw on the left side of the text
        ctx.drawImage(piece,
          leftSideOfOptionText + optionTextWidth + xOffset, yOffset - pieceHeight / 2,
          pieceWidth, pieceHeight
        );
      })
    }
  });
}

const drawPlaying = (tick) => {
  drawBoardWithPieces();
  drawCurrentPlayerIndicator();
};

const drawGameOver = (tick) => {
  drawBoardWithPieces();

  // draw a semi-transparent layer over whole canvas to emphasize text
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // text drawing settings
  const canvasMiddleX = canvas.width / 2;
  const canvasMiddleY = canvas.height / 2;
  const fontSize = Math.floor(canvas.height / 10); // 10% of the canvas height for the font size

  // draw the top text: "Game Over!"
  const gameOverText = 'Game Over!';
  drawText(gameOverText, canvasMiddleX, canvasMiddleY, fontSize, 'center', 'bottom');

  // draw the bottom text of who wins
  const winnerText = `${winner} wins`;
  drawText(winnerText, canvasMiddleX, canvasMiddleY, fontSize, 'center', 'top');
};


// Game State update functions

const handleMenu = (tick) => {
  // detect if the player has clicked on a menu option, if so, start the game
  const sectionHeight = getMenuSectionHeight();
  const pointerSection = hasPointer ? Math.floor(pointerY / sectionHeight) : -1;
  const ONE_PLAYER_SECTION = 2;
  const TWO_PLAYER_SECTION = 3;
  if (isPointerDown && (pointerSection === ONE_PLAYER_SECTION || pointerSection == TWO_PLAYER_SECTION)) {
    isPointerDown = false;
    resetGame();
    numPlayers = pointerSection - ONE_PLAYER_SECTION + 1;
    gameState = GAME_STATE_PLAYING;
  }
};

const handlePlaying = (tick) => {
  // check if the game is over before trying to handle logic for next move (following logic)
  if (isGameOver(currPlayer)) {
    gameState = GAME_STATE_GAME_OVER;
    return;
  }

  const gridWidth = TILE_WIDTH * 2;
  const xOffset = (canvas.width - gridWidth) / 2;
  const yOffset = (canvas.height / 2);

  // When there is only one player, and the current player is black (the opponent),
  // move a random piece to a valid place
  const isComputerPlayerTurn = (numPlayers === 1 && currPlayer === BLACK_PIECE);
  if (isComputerPlayerTurn) {
    const isStartingAnimation = animationStart === undefined;
    if (isStartingAnimation) {
      animationStart = tick;
      animationMove = getRandomBlackMove();
      animationPercentage = 0;
    }
  }

  // animation updates
  const isAnimatingPiece = typeof animationMove === 'object' && typeof animationStart === 'number';
  if (isAnimatingPiece) {
    animationPercentage = Math.min((tick - animationStart) / PIECE_ANIMATION_DURATION, 1.0);
    const isAnimationDone = animationPercentage === 1.0;
    if (isAnimationDone) {
      // register the piece move
      movePiece(animationMove.pieceX, animationMove.pieceY, animationMove.destX, animationMove.destY);
      // stop animation
      animationStart = undefined;
      animationMove = undefined;
      // change player
      currPlayer = getOpponent(currPlayer);
      selectedTile = undefined;
    }
  };

  // short-circuit if there is no mouse pointer on the canvas, or the pointer isn't down
  if (!hasPointer || !isPointerDown) {
    return;
  }

  // convert pointer coordinates into board coordinates, to check if its in bounds
  const [pointerTileX, pointerTileY] = fromIso(pointerX - xOffset, pointerY - yOffset);
  const isPointerTileInBounds = ((pointerTileX >= 0 && pointerTileX < BOARD_WIDTH) && (pointerTileY >= 0 && pointerTileY < BOARD_HEIGHT))
  // short-circuit if there pointer is out of bounds of the board
  if (!isPointerTileInBounds) {
    return;
  }

  const hasSelectedTile = selectedTile !== undefined;
  // when there is a selected tile, check if the pointer is a valid move
  if (hasSelectedTile) {
    const validMoves = getValidMoves(selectedTile.x, selectedTile.y, currPlayer);
    const isValidMove = validMoves.some(cell => cell.x === pointerTileX && cell.y === pointerTileY);
    const isPointerOnAnotherPiece = board[pointerTileY][pointerTileX] === currPlayer;
    if (isValidMove) {
      // animate the piece
      const isStartingAnimation = animationStart === undefined;
      if (isStartingAnimation) {
        animationStart = tick;
        animationMove = { pieceX: selectedTile.x, pieceY: selectedTile.y, destX: pointerTileX, destY: pointerTileY }
        animationPercentage = 0;
      }
    } else if (isPointerOnAnotherPiece) {
      selectedTile = { x: pointerTileX, y: pointerTileY };
    }
  } else {
    // otherwise when there is no selected piece,
    // select the piece if it belongs to the player
    // and the player has valid places to move
    const isPointerOverPlayersPiece = board[pointerTileY][pointerTileX] === currPlayer;
    const validMoves = getValidMoves(pointerTileX, pointerTileY, currPlayer);
    const canMove = validMoves.length > 0;
    if (isPointerOverPlayersPiece && canMove) {
      selectedTile = { x: pointerTileX, y: pointerTileY };
    }
  }

  // reset the state now that it has been processed (to prevent future updates from processing unnecessarily)
  isPointerDown = false;
};

const handleGameOver = (tick) => {
  // go back to the main menu on click
  if (isPointerDown) {
    isPointerDown = false;
    resetGame();
  }
};


// Game loop functions

const update = (tick) => {
  switch (gameState) {
    case GAME_STATE_MENU:
      handleMenu(tick);
      break;
    case GAME_STATE_PLAYING:
      handlePlaying(tick);
      break;
    case GAME_STATE_GAME_OVER:
      handleGameOver(tick);
      break;
    default:
      throw new Error(`Invalid gameState: ${gameState}`);
  }
};

const draw = (tick) => {
  drawBackground();

  // decide what to draw based on the current game state
  switch (gameState) {
    case GAME_STATE_MENU:
      drawMenu(tick);
      break;
    case GAME_STATE_PLAYING:
      drawPlaying(tick);
      break;
    case GAME_STATE_GAME_OVER:
      drawGameOver(tick);
      break;
    default:
      throw new Error(`Invalid gameState: ${gameState}`);
  }

  // always draw the pointer last so that it is on top of everything else
  drawPointer();
};

const loop = (tick) => {
  update(tick);
  draw(tick);
  requestAnimationFrame(loop);
};

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};

const onPointerMove = (e) => {
  pointerX = Math.floor(e.clientX);
  pointerY = Math.floor(e.clientY);
};

const onPointerDown = () => {
  isPointerDown = true;
};

const onPointerUp = () => {
  isPointerDown = false;
};

const onPointerEnter = (e) => {
  hasPointer = true;
  pointerX = Math.floor(e.clientX);
  pointerY = Math.floor(e.clientY);
};

const onPointerOut = () => {
  hasPointer = false;
}

init: {
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerenter', onPointerEnter);
  canvas.addEventListener('pointerout', onPointerOut);
  requestAnimationFrame(loop);
};
