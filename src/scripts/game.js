const STAGES = {
    WARM_UP: 'warmUp',
    PLACING: 'placing',
    PLAYING: 'playing',
    END_GAME: 'endGame'
};

const MAX_SHIP_CELLS = 4; // Maximum number of cells a ship can have

const SHIP_RULES = {
    1: 4, // 4 ships of size 1
    2: 3, // 3 ships of size 2
    3: 2, // 2 ships of size 3
    4: 1  // 1 ship of size 4
};

class GameState {
    constructor(readyButtonSelector) {
        this.currentStage = STAGES.WARM_UP;
        this.readyButtonSelector = document.querySelector(readyButtonSelector);
    }

    handleReadyButtonClick() {
        if (this.currentStage === STAGES.PLACING) {
            this.setStage(STAGES.PLAYING);
            this.readyButtonSelector.style.display = 'none'
        }
    }

    setStage(stage) {
        this.currentStage = stage;

        switch (stage) {
            case STAGES.PLACING:
                this.myBoard.setState(new PlacingState(this.myBoard, this.readyButtonSelector));
                this.opponentBoard.setState(new LockedState());
                break;
            case STAGES.PLAYING:
                this.myBoard.setState(new PlayingState(this.myBoard, new MyBoardStrategy()))
                this.opponentBoard.setState(new PlayingState(this.opponentBoard, new OpponentBoardStrategy()));
                break;
            case STAGES.END_GAME:
            default:
                this.myBoard.setState(new LockedState());
                this.opponentBoard.setState(new LockedState());
                break;
        }

        console.log('Current stage set to:', this.currentStage);
    }

    getStage() {
        return this.currentStage;
    }

    addMyBoard(board) {
        this.myBoard = board;
    }

    addOpponentBoard(board) {
        this.opponentBoard = board;
    }
}

class ClickEvent {
    constructor(name, target, coordinates) {
        this.name = name;
        this.target = target;
        this.coordinates = coordinates;
    }
}

class LongPressEvent {
    constructor(name, target, coordinates) {
        this.name = name;
        this.target = target;
        this.coordinates = coordinates;
    }
}

class BoardState {
    state = null; // State pattern to handle board-specific states
    table = null;
    ships = []; // Array to store all ships on the board

    constructor(tableSelector, shipStatusBoard) {
        if (!this.table) {
            this.table = document.querySelector(tableSelector); // Get the HTML table element

            if (this.table) {
                let pressTimer = null;
                let isPressEvent = false;

                this.table.addEventListener('mousedown', (event) => {
                    const row = event.target.parentElement.rowIndex;
                    const col = event.target.cellIndex;

                    pressTimer = setTimeout(() => {
                        isPressEvent = true;
                        const pressEvent = new LongPressEvent('press', event.target, { row, col });
                        this.handleEvent(pressEvent);
                    }, 500); // 500ms threshold for press event
                });

                this.table.addEventListener('mouseup', (event) => {
                    clearTimeout(pressTimer);
                    if (!isPressEvent) {
                        const row = event.target.parentElement.rowIndex;
                        const col = event.target.cellIndex;
                        const clickEvent = new ClickEvent('click', event.target, { row, col });
                        this.handleEvent(clickEvent);
                    }
                    isPressEvent = false;
                });

                this.table.addEventListener('mouseleave', () => {
                    clearTimeout(pressTimer);
                    isPressEvent = false;
                });
            }
        }
        this.shipStatusBoard = shipStatusBoard; // Reference to the ship status board for updating ship statuses
    }

    setState(state) {
        this.state = state;
    }

    handleEvent(event) {
        if (this.state) {
            this.state.handleEvent(event);
        }
    }

    getShips() {
        return this.ships.slice().sort((a, b) => a.updatedAt - b.updatedAt);
    }

    isShipCell(row, col) {
        return this.ships.some(ship => ship.cells.some(cell => cell.row === row && cell.col === col));
    }

    getShipAtCell(row, col) {
        return this.ships.find(ship => ship.cells.some(cell => cell.row === row && cell.col === col));
    }

    addShip(ship) {
        this.ships.push(ship);
    }

    removeShip(shipId) {
        const shipToRemove = this.ships.find(ship => ship.getId() === shipId);
        if (!shipToRemove) {
            return false; // Ship not found
        }

        // Remove ship cells from the board
        shipToRemove.cells.forEach(({row, col}) => {
            const cell = this.table.rows[row].cells[col];
            cell.classList.remove('ship', 'invalid');
        });

        // Remove the ship from the ships array
        this.ships = this.ships.filter(ship => ship.getId() !== shipId);
        return true; // Ship successfully removed
    }

    toggleShipHit(row, col) {
        const ship = this.getShipAtCell(row, col);
        if (!ship) {
            return;
        }

        const isShipDestroyedBeforeToggle = ship.isDestroyed();
        ship.toggleHit(row, col);

        if (ship.isDestroyed()) {
            this.addLockedClassToNeighbors(ship);
            this.shipStatusBoard.toggleDestroyed(ship.getSize(), true);
        } else if (isShipDestroyedBeforeToggle) {
            this.removeLockedClassFromCells(ship);
            this.shipStatusBoard.toggleDestroyed(ship.getSize(), false);
        }
    }

    getCellMooreNeighborhood(row, col) {
        const neighbors = [];
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (r === row && c === col) continue; // Skip the cell itself
                if (this.table.rows[r] && this.table.rows[r].cells[c]) {
                    neighbors.push(this.table.rows[r].cells[c]);
                }
            }
        }
        return neighbors;
    }

    addLockedClassToNeighbors(ship) {
        ship.cells.forEach(({ row, col }) => {
            const neighbors = this.getCellMooreNeighborhood(row, col);
            neighbors.forEach(cell => {
                if (!cell.classList.contains('miss') && !cell.classList.contains('ship')) {
                    cell.classList.add('locked');
                }
            });
        });
    }

    removeLockedClassFromCells(ship) {
        ship.cells.forEach(({ row, col }) => {
            const neighbors = this.getCellMooreNeighborhood(row, col);
            neighbors.forEach(cell => {
                const isLockedByOtherShip = this.ships.some(otherShip =>
                    otherShip !== ship &&
                    otherShip.isDestroyed() &&
                    otherShip.cells.some(({ row: r, col: c }) =>
                        this.getCellMooreNeighborhood(r, c).includes(cell)
                    )
                );
                if (!isLockedByOtherShip) {
                    cell.classList.remove('locked');
                }
            });
        });
    }

    toggleMiss(row, col) {
        const cell = this.table.rows[row].cells[col];
        if (cell.classList.contains('miss')) {
            this.unmarkMiss(row, col);
        } else {
            this.markMiss(row, col);
        }
    }

    markMiss(row, col) {
        const cell = this.table.rows[row].cells[col];
        if (!cell.classList.contains('locked')) {
            cell.classList.add('miss');
        }
    }

    unmarkMiss(row, col) {
        const cell = this.table.rows[row].cells[col];
        cell.classList.remove('miss');
    }

    markHit(row, col) {
        const cell = this.table.rows[row].cells[col];
        if (!cell.classList.contains('locked')) {
            cell.classList.add('hit');
        }
    }

    unmarkHit(row, col) {
        const cell = this.table.rows[row].cells[col];
        cell.classList.remove('hit');
    }
}

class BoardStrategyInterface {
    constructor() {
        if (new.target === BoardStrategyInterface) {
            throw new Error("Cannot instantiate an interface directly");
        }
        if (typeof this.handleClickEvent !== "function") {
            throw new Error("Classes extending BoardStrategyInterface must implement the 'handleClickEvent' method");
        }
        if (typeof this.handleLongPress !== "function") {
            throw new Error("Classes extending BoardStrategyInterface must implement the 'handleLongPress' method");
        }
    }
}

class MyBoardStrategy extends BoardStrategyInterface {
    handleClickEvent(event, board) {
        console.log("Handling click event on My Ships board", event, board);
        const {row, col} = event.coordinates;

        if (board.isShipCell(row, col)) {
            board.toggleShipHit(row, col);
        } else {
            board.toggleMiss(row, col);
        }
    }

    handleLongPress(event, board) {
        console.log("Handling long press event on My Ships board", event, board);
    }
}

class OpponentBoardStrategy extends BoardStrategyInterface {
    handleClickEvent(event, board) {
        console.log("Handling click event on Opponent's Ships board", event, board);
        const { row, col } = event.coordinates;
        const cell = event.target;

        if (cell.tagName === 'TD') {
            if (!cell.classList.contains('miss') && !cell.classList.contains('hit')) {
                // First click: mark as miss
                board.markMiss(row, col);
            } else if (cell.classList.contains('miss') && !cell.classList.contains('hit')) {
                // Second click: mark as hit and unmark miss
                board.unmarkMiss(row, col);
                board.markHit(row, col);
            } else if (cell.classList.contains('hit')) {
                // Third click: reset cell
                board.unmarkMiss(row, col);
                board.unmarkHit(row, col);
            }
        }
    }

    handleLongPress(event, board) {
        console.log("Handling long press event on Opponent's Ships board", event, board);
        const { row, col } = event.coordinates;
        const cell = event.target;

        if (cell.tagName === 'TD' && cell.classList.contains('hit')) {
            const ship = board.getShipAtCell(row, col);

            if (ship && ship.isDestroyed()) {
                // Remove locked class from neighboring cells
                board.removeLockedClassFromCells(ship);

                // Remove the ship from the board
                board.removeShip(ship.getId());

                // Keep hit classes on the cells
                ship.cells.forEach(({ row, col }) => {
                    board.markHit(row, col);
                });

                // Update the ship status board to remove the destroyed status
                board.shipStatusBoard.toggleDestroyed(ship.getSize(), false);
            } else {
                const newShip = new Ship();

                // Use a queue to find all connected hit cells
                const queue = [{ row, col }];
                const visited = new Set();

                while (queue.length > 0) {
                    const current = queue.shift();
                    const key = `${current.row},${current.col}`;

                    if (visited.has(key)) {
                        continue;
                    }

                    visited.add(key);
                    const currentCell = board.table.rows[current.row]?.cells[current.col];

                    if (currentCell && currentCell.classList.contains('hit')) {
                        newShip.addCell(current.row, current.col, currentCell);

                        // Add neighbors to the queue
                        const neighbors = [
                            { row: current.row - 1, col: current.col },
                            { row: current.row + 1, col: current.col },
                            { row: current.row, col: current.col - 1 },
                            { row: current.row, col: current.col + 1 }
                        ];

                        neighbors.forEach(neighbor => {
                            const neighborKey = `${neighbor.row},${neighbor.col}`;
                            if (!visited.has(neighborKey)) {
                                queue.push(neighbor);
                            }
                        });
                    }
                }

                board.addShip(newShip);

                // Mark the ship as destroyed
                newShip.destroy();
                board.shipStatusBoard.toggleDestroyed(newShip.getSize(), true);
                board.addLockedClassToNeighbors(newShip);
            }
        }
    }
}

// Example states for BoardState
class PlacingState {
    constructor(board, buttonSelector) {
        this.board = board; // Reference to the board this state belongs to
        this.button = buttonSelector;
        this.hideButton(); // Initially hide the button
    }

    handleEvent(event) {
        console.log('Handling event in Placing State:', event);
        if (event.name === 'click' && this.board.table) {
            const {row, col} = event.coordinates;
            const cell = event.target;

            if (cell.tagName === 'TD') {
                // Check if the cell is already part of a ship
                if (this.board.isShipCell(row, col)) {
                    const ship = this.board.getShipAtCell(row, col);
                    const removalSuccessful = ship.removeCell(row, col);

                    if (!removalSuccessful) {
                        alert('This cell cannot be removed based on the current rules!');
                        return;
                    }

                    // Update the cell's class if removal was successful
                    cell.classList.remove('ship', 'invalid');

                    // If the ship has no cells left, remove the ship instance
                    if (ship.getSize() === 0) {
                        this.board.removeShip(ship.getId());
                    }

                    this.validateShipRules();

                    return;
                }

                // Check for Von Neumann neighborhood (priority)
                const vonNeumannShip = this.board.getShips().find(ship => ship.isInVonNeumannNeighborhood(row, col));
                if (vonNeumannShip) {
                    // Check if the clicked cell will be in Moore neighborhood with 2 or more ships
                    const neighboringShips = this.board.getShips().filter(ship => ship.isInMooreNeighborhood(row, col));
                    if (neighboringShips.length >= 2) {
                        alert('Cannot place a cell here as it will be in Moore neighborhood with 2 or more ships!');
                        return;
                    }

                    if (vonNeumannShip.cells.length >= MAX_SHIP_CELLS) {
                        alert('A ship cannot have more than 4 cells!');
                        return;
                    }

                    vonNeumannShip.addCell(row, col, cell);

                    this.validateShipRules();
                    return;
                }

                // Check for Moore neighborhood (disallow placement)
                if (this.board.getShips().some(ship => ship.isInMooreNeighborhood(row, col))) {
                    alert('Cannot place a ship here due to Moore neighborhood!');
                    return;
                }

                // Create a new ship if no neighborhood conditions are met
                const newShip = new Ship();
                newShip.addCell(row, col, cell);
                this.board.addShip(newShip);

                this.validateShipRules();
            }
        }
    }

    validateShipRules() {
        // Reset all ship cells to blue
        this.board.getShips().forEach(ship => {
            ship.unmarkInvalid();
        });

        const shipCounts = this.board.getShips().reduce((counts, ship) => {
            const size = ship.getSize();
            counts[size] = (counts[size] || 0) + 1;

            return counts;
        }, {});

        for (const [size, maxCount] of Object.entries(SHIP_RULES)) {
            if ((shipCounts[size] || 0) > maxCount) {
                // Mark invalid ships of this size
                this.board.getShips()
                    .filter(ship => ship.getSize() === Number.parseInt(size))
                    .slice(maxCount) // Only mark the extra ships
                    .forEach(ship => {
                        ship.markInvalid();
                    });
            }
        }

        const allShipsPlaced = Object.entries(SHIP_RULES).every(
            ([size, maxCount]) => (shipCounts[size] || 0) === maxCount
        );

        if (allShipsPlaced) {
            this.showButton();
        } else {
            this.hideButton();
        }
    }

    showButton() {
        this.button.style.display = 'block';
    }

    hideButton() {
        this.button.style.display = 'none';
    }
}

class PlayingState {
    constructor(board, boardStrategy) {
        this.board = board;
        this.boardStrategy = boardStrategy;
    }

    handleEvent(event) {
        console.log('Handling event in Playing State:', event);
        if (event.name === 'click') {
            this.boardStrategy.handleClickEvent(event, this.board)
        }
        if (event.name === 'press') {
            this.boardStrategy.handleLongPress(event, this.board)
        }
    }
}

class LockedState {
    handleEvent(event) {
        console.log('Board is locked. Ignoring event:', event);
        // No interaction allowed in this state
    }
}

class ShipCell {
    constructor(row, col, selector) {
        this.row = row;
        this.col = col;
        this.selector = selector;
        this.hit = false; // Property to track if the cell is hit
    }

    reset() {
        this.selector.classList.remove('ship', 'hit', 'invalid', 'locked', 'miss');
        this.hit = false;
    }

    markShip() {
        this.selector.classList.add('ship');
    }

    markShipHit() {
        this.selector.classList.add('hit');
        this.hit = true;
    }

    unmarkShipHit() {
        this.selector.classList.remove('hit');
        this.hit = false;
    }

    markInvalid() {
        this.selector.classList.add('invalid');
    }

    unmarkInvalid() {
        this.selector.classList.remove('invalid');
        this.markShip(); // Ensure the cell remains marked as part of a ship
    }
}

class Ship {
    destroyed = false;
    cells = [];

    constructor() {
        this.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); // Unique ID based on current time and random string
        this.updatedAt = Date.now(); // Initialize updatedAt with the current timestamp
    }

    isDestroyed() {
        return this.destroyed;
    }

    dispatchUpdated() {
        this.updatedAt = Date.now(); // Update the timestamp
    }

    addCell(row, col, cellSelector) {
        const newCell = new ShipCell(row, col, cellSelector);
        this.cells.push(newCell);
        newCell.markShip(); // Use the ShipCell method to mark the cell as part of a ship
        this.dispatchUpdated(); // Update the timestamp
    }

    destroy() {
        // Mark all cells as hit
        this.cells.forEach(cell => cell.markShipHit());
        this.destroyed = true;
    }

    toggleHit(row, col) {
        const cell = this.cells.find(cell => cell.row === row && cell.col === col);
        if (cell) {
            if (cell.hit) {
                cell.unmarkShipHit();
                this.checkIfDestroyed();
            } else {
                cell.markShipHit();
                this.checkIfDestroyed();
            }
        }
    }

    checkIfDestroyed() {
        this.destroyed = this.cells.every(cell => cell.hit);
    }

    removeCell(row, col) {
        const cellIndex = this.cells.findIndex(cell => cell.row === row && cell.col === col);
        if (cellIndex === -1) {
            return false; // Cell not found in the ship
        }

        // Check neighbors to determine if removal is allowed
        const vonNeumannNeighbors = this.cells.filter(({row: r, col: c}) => {
            return (
                (r === row && Math.abs(c - col) === 1) ||
                (c === col && Math.abs(r - row) === 1)
            );
        }).filter(cell => !(cell.row === row && cell.col === col)); // Skip the cell under validation

        const mooreNeighbors = this.cells.filter(({row: r, col: c}) => {
            return Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;
        }).filter(cell => !(cell.row === row && cell.col === col)); // Skip the cell under validation

        // Allow removal if there is one Von Neumann neighbor OR exactly three Moore neighbors
        if (vonNeumannNeighbors.length === 2 && mooreNeighbors.length === 3) {
            this.cells[cellIndex].reset(); // Use the ShipCell method to reset the cell
            this.cells.splice(cellIndex, 1);
            this.dispatchUpdated(); // Update the timestamp
            return true;
        }
        if (vonNeumannNeighbors.length > 1) {
            return false; // Removal not allowed
        }

        // Remove the cell
        this.cells[cellIndex].reset(); // Use the ShipCell method to reset the cell
        this.cells.splice(cellIndex, 1);
        this.dispatchUpdated(); // Update the timestamp

        return true; // Removal successful
    }

    markInvalid() {
        this.cells.forEach(cell => cell.markInvalid());
    }

    unmarkInvalid() {
        this.cells.forEach(cell => cell.unmarkInvalid());
    }

    isInVonNeumannNeighborhood(row, col) {
        return this.cells.some(cell =>
            (cell.row === row && Math.abs(cell.col - col) === 1) ||
            (cell.col === col && Math.abs(cell.row - row) === 1)
        );
    }

    isInMooreNeighborhood(row, col) {
        return this.cells.some(cell =>
            Math.abs(cell.row - row) <= 1 && Math.abs(cell.col - col) <= 1
        );
    }

    getSize() {
        return this.cells.length;
    }

    getId() {
        return this.id;
    }
}

class ShipStatusBoard {
    constructor(selector) {
        this.board = document.querySelector(selector);
        if (!this.board) {
            throw new Error(`Element with selector '${selector}' not found.`);
        }
    }

    toggleDestroyed(numberOfCells, isDestroyed) {
        const row = this.board.rows[numberOfCells - 1]; // Get the row corresponding to the number of cells
        if (!row) {
            throw new Error(`Row for ${numberOfCells} cells not found.`);
        }

        if (isDestroyed) {
            // Add 'hit' class to the next non-hit cell in the row, skipping the first column
            const cell = Array.from(row.cells).slice(1).find(cell => !cell.classList.contains('hit'));
            if (cell) {
                cell.classList.add('hit');
            }
        } else {
            // Remove 'hit' class from the last hit cell in the row, skipping the first column
            const cell = Array.from(row.cells).slice(1).reverse().find(cell => cell.classList.contains('hit'));
            if (cell) {
                cell.classList.remove('hit');
            }
        }
    }
}

// Example usage
const myShipStatusBoard = new ShipStatusBoard('#my-ship-status-table');
const opponentShipStatusBoard = new ShipStatusBoard('#opponent-ship-status-table');

const gameState = new GameState('#ready-button');
const myBoard = new BoardState('#table1', myShipStatusBoard);
const opponentBoard = new BoardState('#table2', opponentShipStatusBoard);

gameState.addMyBoard(myBoard);
gameState.addOpponentBoard(opponentBoard);

gameState.setStage(STAGES.PLACING);

console.log('Current Game Stage:', gameState.getStage());

// Add event listener for the Ready button at the end of the file
document.querySelector('#ready-button').addEventListener('click', () => {
    gameState.handleReadyButtonClick();
});


// Initial debug setup: set ships on my board for testing. DO NOT REMOVE THIS
const testShip1 = new Ship();
testShip1.addCell(1, 1, myBoard.table.rows[1].cells[1]);
testShip1.addCell(1, 2, myBoard.table.rows[1].cells[2]);
testShip1.addCell(1, 3, myBoard.table.rows[1].cells[3]);
testShip1.addCell(1, 4, myBoard.table.rows[1].cells[4]);
myBoard.addShip(testShip1);

const testShip2 = new Ship();
testShip2.addCell(3, 3, myBoard.table.rows[3].cells[3]);
testShip2.addCell(4, 3, myBoard.table.rows[4].cells[3]);
testShip2.addCell(5, 3, myBoard.table.rows[5].cells[3]);
myBoard.addShip(testShip2);

const testShip3 = new Ship();
testShip3.addCell(3, 5, myBoard.table.rows[3].cells[5]);
testShip3.addCell(4, 5, myBoard.table.rows[4].cells[5]);
testShip3.addCell(5, 5, myBoard.table.rows[5].cells[5]);
myBoard.addShip(testShip3);

const testShip4 = new Ship();
testShip4.addCell(7, 7, myBoard.table.rows[7].cells[7]);
testShip4.addCell(7, 8, myBoard.table.rows[7].cells[8]);
myBoard.addShip(testShip4);

const testShip5 = new Ship();
testShip5.addCell(5, 7, myBoard.table.rows[5].cells[7]);
testShip5.addCell(5, 8, myBoard.table.rows[5].cells[8]);
myBoard.addShip(testShip5);

const testShip6 = new Ship();
testShip6.addCell(3, 7, myBoard.table.rows[3].cells[7]);
testShip6.addCell(3, 8, myBoard.table.rows[3].cells[8]);
myBoard.addShip(testShip6);

const testShip7 = new Ship();
testShip7.addCell(9, 9, myBoard.table.rows[9].cells[9]);
myBoard.addShip(testShip7);

const testShip8 = new Ship();
testShip8.addCell(10, 1, myBoard.table.rows[10].cells[1]);
myBoard.addShip(testShip8);

const testShip9 = new Ship();
testShip9.addCell(10, 3, myBoard.table.rows[10].cells[3]);
myBoard.addShip(testShip9);

const testShip10 = new Ship();
testShip10.addCell(10, 5, myBoard.table.rows[10].cells[5]);
myBoard.addShip(testShip10);

myBoard.state.validateShipRules();


