const gridSize = 10;
const userGrid = document.getElementById('userGrid');
const botGrid = document.getElementById('botGrid');

let userText = document.getElementById('userText');
let botText = document.getElementById('botText');
let userButton = document.getElementById('userButton'); // Heatmap button
let botButton = document.getElementById('botButton'); // Attack button

let isDragging = false; // Track whether a ship is being placed
let highlightedCells = []; // To track the cells the user is highlighting
let startX, startY; // Store starting point of the drag
let isPlacingShips = true; // Allow ship placement by default
let canAttackBot = false; // Disable attacks on the bot's grid initially
let selectedAttackCell = null; // Track the selected cell for attack
let isHeatMapVisible = false; // Track whether the heat map is visible
let latestBotAttackCell = null; // Track the latest cell attacked by the bot

let botTargeting = false; // Tracks if the bot is in Target Mode
let knownHits = []; // Stores indices of hits that are part of unsunk ships

let unplaced = [5, 4, 3, 3, 2]; // List of unplaced player ship lengths

// Ships
let botShips = [];
let playerShips = [];

// Probability density map
let probabilities = new Array(gridSize * gridSize).fill(0);

// Remaining player ships
let remainingShipLengths = [5, 4, 3, 3, 2];

class Ship {
  constructor(indices, gridElement) {
    this.indices = indices; 
    this.length = indices.length; 
    this.gridElement = gridElement;
    this.hits = 0; // Track how many cells have been hit
  }

  canPlace() {
    for (const index of this.indices) {
      const cell = this.gridElement.children[index];
      if (!cell || cell.classList.contains('ship-cell')) {
        return false;
      }
    }
    return true;
  }

  place() {
    this.indices.forEach((index) => {
      const cell = this.gridElement.children[index];
      cell.classList.add('ship-cell');
    });
  }

  isSunk() {
    return this.hits === this.length;
  }

  // Reveal sunk bot ship
  reveal() {
    this.indices.forEach((index) => {
      const cell = this.gridElement.children[index];
      cell.classList.add('sunk'); // Add a class to visually reveal the sunk ship
    });
  }
}

function generateGrid(gridElement, isBot = false) {
  for (let i = 0; i < gridSize * gridSize; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.dataset.index = i; 

    if (isBot) {
      cell.addEventListener('click', () => handleBotGridClick(i));
    } else {
      cell.addEventListener('mousedown', (e) => handleMouseDown(e, gridElement, i));
      cell.addEventListener('mouseover', (e) => handleMouseOver(e, gridElement, i));
      cell.addEventListener('mouseup', () => handleMouseUp(gridElement));
    }

    gridElement.appendChild(cell);
  }
}

// Ship placement

function handleMouseDown(event, gridElement, index) {
  if (!isPlacingShips) return;
  isDragging = true;
  highlightedCells = [];
  startX = index % gridSize;
  startY = Math.floor(index / gridSize);

  highlightShipCells(gridElement, startX, startY);
}

function handleMouseOver(event, gridElement, index) { //Dragging 
  if (!isPlacingShips || !isDragging) return; 
  const x = index % gridSize;
  const y = Math.floor(index / gridSize);

  highlightShipCells(gridElement, x, y);
}

function highlightShipCells(gridElement, x, y) {
  // Clear previous highlights
  gridElement.querySelectorAll('.highlight').forEach((cell) => cell.classList.remove('highlight'));
  highlightedCells = [];

  // Determine orientation 
  const isHorizontal = Math.abs(x - startX) > Math.abs(y - startY);

  // Calculate start and end indices
  const start = isHorizontal 
  ? Math.min(startX, x) 
  : Math.min(startY, y);
  const end = isHorizontal 
  ? Math.max(startX, x) 
  : Math.max(startY, y);

  for (let i = start; i <= end; i++) {
    const index = isHorizontal
      ? startY * gridSize + i // Horizontal indices
      : i * gridSize + startX; // Vertical indices

    // Ensure the index is within the grid bounds
    if (index >= 0 && index < gridSize * gridSize) {
      const cell = gridElement.children[index];
      if (cell) {
        cell.classList.add('highlight');
        highlightedCells.push(cell);
      }
    }
  }
}

function handleMouseUp(gridElement) { // ship placement
  if (!isPlacingShips || !isDragging) return;

  const shipLength = highlightedCells.length;

  if (unplaced.includes(shipLength)) {
    const ship = new Ship(highlightedCells.map((cell) => parseInt(cell.dataset.index)), gridElement);

    if (ship.canPlace()) {
      ship.place();

      // Remove placed ship's length from unplaced array
      const index = unplaced.indexOf(shipLength);
      if (index !== -1) {
        unplaced.splice(index, 1);
      }

      // Add the ship to the player's ships array
      playerShips.push(ship);

      userText.textContent = `Ship of length ${shipLength} placed!`;

      if (unplaced.length === 0) {
        isPlacingShips = false; 
        canAttackBot = true; 
        userText.textContent = "Ships placed! Click on bot's grid to attack!";
      }
    } else {
      userText.textContent = "Can't place this ship!";
    }
  } else {
    userText.textContent = "Invalid ship length!";
  }

  isDragging = false;
  highlightedCells = [];
}

// Attacking 

function handleBotGridClick(index) {
    if (!canAttackBot) {
      userText.textContent = "The game is over.";
      return;
    }
  
    // Clear previous highlight
    if (selectedAttackCell !== null) {
      botGrid.children[selectedAttackCell].classList.remove('selected');
    }
  
    selectedAttackCell = index;
    botGrid.children[index].classList.add('selected');
    botText.textContent = `Selected cell ${index}. Press "Attack" to confirm.`;
  }

botButton.addEventListener('click', () => {
  if (!canAttackBot) {
    userText.textContent = "Place all ships before attacking!";
    botText.textContent = "You must place your ships first.";
    return; 
  }

  if (selectedAttackCell === null) {
    botText.textContent = "Select a cell to attack first!";
    return; 
  }

  // Clear highlight
  if (latestBotAttackCell !== null) {
    userGrid.children[latestBotAttackCell].classList.remove('selected');
    latestBotAttackCell = null;
  }

  const cell = botGrid.children[selectedAttackCell];
  const ship = botShips.find((ship) => ship.indices.includes(selectedAttackCell)); // Finds the ship that was hit

  if (ship) {
    cell.classList.add('hit');
    cell.textContent = 'X'; 
    ship.hits++; 

    // Sinking bot ship
    if (ship.isSunk()) {
      ship.reveal();
      botText.textContent = `You sunk a ship of length ${ship.length}!`;
    } else {
      botText.textContent = `Hit at cell ${selectedAttackCell}!`;
    }
  } else {
    cell.classList.add('miss');
    cell.textContent = 'O'; 
    botText.textContent = `Miss at cell ${selectedAttackCell}!`;
  }

  // Reset highlight
  botGrid.children[selectedAttackCell].classList.remove('selected');
  selectedAttackCell = null;

  botAttack();
});

// Bot logic

// Generate valid ship arrangements for the bot
function generateValidArrangements(length) {
  const arrangements = [];

  if (botTargeting) {
    // Targeting
    for (const hitIndex of knownHits) {
      const x = hitIndex % gridSize;
      const y = Math.floor(hitIndex / gridSize);
  
      // Check horizontal placements (left and right)
      for (let dir = -1; dir <= 1; dir += 2) {
        for (let i = 0; i < length; i++) {
          const startX = x + dir * i;
          if (startX >= 0 && startX + length <= gridSize) {
            const indices = [];
            let isValid = true;
  
            for (let j = 0; j < length; j++) {
              const index = y * gridSize + (startX + j);
              const cell = userGrid.children[index];
  
              if (cell.classList.contains('miss') || cell.classList.contains('sunk')) {
                isValid = false;
                break;
              }
              indices.push(index);
            }
  
            if (isValid) {
              arrangements.push(indices);
            }
          }
        }
      }
  
      // Check vertical placements (up and down)
      for (let dir = -1; dir <= 1; dir += 2) { // dir = -1 (up), dir = 1 (down)
        for (let i = 0; i < length; i++) {
          const startY = y + dir * i;
          if (startY >= 0 && startY + length <= gridSize) {
            const indices = [];
            let isValid = true;
  
            for (let j = 0; j < length; j++) {
              const index = (startY + j) * gridSize + x;
              const cell = userGrid.children[index];
  
              if (cell.classList.contains('miss') || cell.classList.contains('sunk')) {
                isValid = false;
                break;
              }
              indices.push(index);
            }
  
            if (isValid) {
              arrangements.push(indices);
            }
          }
        }
      }
    }
  }
  

  else {
    // Hunting: Generate all valid arrangements 
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x <= gridSize - length; x++) {
        let isValid = true;
        const indices = [];

        for (let i = 0; i < length; i++) {
          const index = y * gridSize + (x + i);
          const cell = userGrid.children[index];

          if (cell.classList.contains('miss') || cell.classList.contains('sunk')) {
            isValid = false;
            break;
          }
          indices.push(index);
        }

        if (isValid) {
          arrangements.push(indices);
        }
      }
    }

    // Check vertical placements
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y <= gridSize - length; y++) {
        let isValid = true;
        const indices = [];

        for (let i = 0; i < length; i++) {
          const index = (y + i) * gridSize + x;
          const cell = userGrid.children[index];

          if (cell.classList.contains('miss') || cell.classList.contains('sunk')) {
            isValid = false;
            break;
          }
          indices.push(index);
        }

        if (isValid) {
          arrangements.push(indices);
        }
      }
    }
  }

  return arrangements;
}

function calculateProbabilities() {
  const probabilities = new Array(gridSize * gridSize).fill(0);

  for (const length of remainingShipLengths) {
    const arrangements = generateValidArrangements(length);
    for (const indices of arrangements) {
      for (const index of indices) {
        probabilities[index]++;
      }
    }
  }

  return probabilities;
}

function botAttack() {
    probabilities = calculateProbabilities();
  
    // Find the cell with the highest probability
    let maxProbability = -1;
    let targetCell = null;
    for (let i = 0; i < probabilities.length; i++) {
      const cell = userGrid.children[i];
      if (!cell.classList.contains('hit') && !cell.classList.contains('miss') && probabilities[i] > maxProbability) {
        maxProbability = probabilities[i];
        targetCell = i;
      }
    }
  
    if (targetCell !== null) {
      // Update highlight
      if (latestBotAttackCell !== null) {
        userGrid.children[latestBotAttackCell].classList.remove('selected');
      }
      userGrid.children[targetCell].classList.add('selected');
      latestBotAttackCell = targetCell;
  
      attackCell(userGrid.children[targetCell]);
  
      // Check for win
      if (isFleetSunk(botShips)) {
        endGame("player");
        return;
      }
    }
  }

function attackCell(cell) {
    const index = parseInt(cell.dataset.index);
    const ship = playerShips.find((ship) => ship.indices.includes(index));
  
    if (ship) {
      cell.classList.add('hit');
      cell.textContent = 'X'; 
      ship.hits++; 
  
      // Add the hit to knownHits if not already present
      if (!knownHits.includes(index)) {
        knownHits.push(index);
      }
  
      // Switch to Target Mode
      if (!botTargeting) {
        botTargeting = true;
      }
  
      if (ship.isSunk()) {
        ship.reveal(); // Reveal the sunk ship
        userText.textContent = `Your ship of length ${ship.length} has been sunk!`;
        updateProbabilitiesAfterSunk(ship);
  
        // Remove sunk ship's hits from knownHits
        knownHits = knownHits.filter((hitIndex) => !ship.indices.includes(hitIndex));
  
        // If no more known hits, switch back to Hunt Mode
        if (knownHits.length === 0) {
          botTargeting = false;
        }
      } else {
        userText.textContent = `The bot hit your ship at cell ${index}!`;
      }
  
      // Check for win
      if (isFleetSunk(playerShips)) {
        endGame("bot"); 
        return;
      }
    } else {
      cell.classList.add('miss');
      cell.textContent = 'O'; 
      userText.textContent = `The bot missed at cell ${index}!`;
      updateProbabilitiesAfterMiss(index);
    }
  }

function updateProbabilitiesAfterMiss(missedIndex) {
  // Remove all ship placements that include the missed cell
  for (const length of remainingShipLengths) {
    const arrangements = generateValidArrangements(length);
    for (let i = arrangements.length - 1; i >= 0; i--) {
      if (arrangements[i].includes(missedIndex)) {
        arrangements.splice(i, 1);
      }
    }
  }
}

function updateProbabilitiesAfterSunk(ship) {
    // Remove the sunk ship's length from remainingShipLengths
    const index = remainingShipLengths.indexOf(ship.length);
    if (index !== -1) {
      remainingShipLengths.splice(index, 1);
    }
  
    // Remove sunk ship's hits from knownHits
    knownHits = knownHits.filter((hitIndex) => !ship.indices.includes(hitIndex));
  
    // If no more known hits, switch back to Hunting
    if (knownHits.length === 0) {
      botTargeting = false;
    }
  
    if (isHeatMapVisible) {
      displayHeatMap();
    }
  }


function placeBotShips() {
  const shipLengths = [5, 4, 3, 3, 2]; // bot ships

  for (const length of shipLengths) {
    let shipPlaced = false;

    while (!shipPlaced) {
      // Randomly choose orientation and starting position
      const isHorizontal = Math.random() < 0.5;
      const startX = Math.floor(Math.random() * gridSize);
      const startY = Math.floor(Math.random() * gridSize);

      // ship indices
      const indices = [];
      for (let i = 0; i < length; i++) {
        const x = isHorizontal ? startX + i : startX;
        const y = isHorizontal ? startY : startY + i;
        const index = y * gridSize + x;

        // Check if the ship is out of bounds or overlaps
        if (x >= gridSize || y >= gridSize || botShips.some((ship) => ship.indices.includes(index))) {
          break;
        }

        indices.push(index);
      }

      if (indices.length === length) {
        const ship = new Ship(indices, botGrid);
        botShips.push(ship);
        shipPlaced = true;
      }
    }
  }
}

// Heat map 

userButton.addEventListener('click', () => {
  if (unplaced.length === 0) {
    // toggle heat map if ships are placed
    isHeatMapVisible = !isHeatMapVisible;

    if (isHeatMapVisible) {
      probabilities = calculateProbabilities();
      displayHeatMap();
      userText.textContent = "Heat map displayed!";
    } else {
      clearHeatMap();
      userText.textContent = "Heat map hidden!";
    }
  } else {
    
    if (unplaced.length === 0) {
      isPlacingShips = false;
      canAttackBot = true;
      userText.textContent = "All ships placed! Ready to play!";
    } else {
      userText.textContent = "Place all ships first!";
    }
  }
});

function displayHeatMap() {
  const maxProbability = Math.max(...probabilities);

  for (let i = 0; i < gridSize * gridSize; i++) {
    const cell = userGrid.children[i];
    if (maxProbability > 0) {
      const opacity = probabilities[i] / maxProbability; // Normalize opacity
      cell.style.backgroundColor = `rgba(255, 0, 0, ${opacity})`; 
    }
  }
}

function clearHeatMap() {
  for (let i = 0; i < gridSize * gridSize; i++) {
    const cell = userGrid.children[i];
    cell.style.backgroundColor = '';
  }
}

function isFleetSunk(ships) {
  return ships.every((ship) => ship.isSunk());
}

function endGame(winner) {
  if (winner === "player") {
    userText.textContent = "Player wins!";
    botText.textContent = "Player wins!";
  } else if (winner === "bot") {
    userText.textContent = "Bot wins!";
    botText.textContent = "Bot wins!";
  }

  // Disable attacking
  canAttackBot = false;
  botButton.disabled = true;
  userButton.disabled = true;

  const botCells = botGrid.querySelectorAll('.cell');
  botCells.forEach((cell) => {
    cell.removeEventListener('click', handleBotGridClick);
  });
}  


// Initialize grids and place bot ships
generateGrid(userGrid);
generateGrid(botGrid, true); 
placeBotShips();



