const socket = io();

// State
let gameState = null;
let myPlayerId = null; // Will need to identify myself, usually socket.id
let selectedAvatar = null;
let myUsername = '';

// DOM Elements
const screens = {
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
};

const avatarGrid = document.getElementById('avatar-grid');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const waitingArea = document.getElementById('waiting-area');
const playerList = document.getElementById('player-list');
const readyBtn = document.getElementById('ready-btn');

const gameTable = document.querySelector('.game-table');
const viraContainer = document.getElementById('vira-container');
const tableCardsContainer = document.getElementById('table-cards-container');
const opponentsContainer = document.getElementById('opponents-container');
const localHud = document.getElementById('local-hud');
const localHand = document.getElementById('local-hand');
const bettingModal = document.getElementById('betting-modal');
const betOptions = document.getElementById('bet-options');
const notificationOverlay = document.getElementById('notification-overlay');
const notificationText = document.getElementById('notification-text');

const championAvatar = document.getElementById('champion-avatar');
const championName = document.getElementById('champion-name');
const restartBtn = document.getElementById('restart-btn');

const bgMusic = document.getElementById('bg-music');
const victoryMusic = document.getElementById('victory-music');
const muteBtn = document.getElementById('mute-btn');

// Avatar List (Mock for now, or just generic names)
const avatars = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6', 'avatar7', 'avatar8'];

// Audio Control
let isMuted = false;
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    bgMusic.muted = isMuted;
    victoryMusic.muted = isMuted;
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
});

function playBackgroundMusic() {
    bgMusic.play().catch(e => console.log("Audio play failed (interaction needed):", e));
}

// Initialization
function init() {
    renderAvatarGrid();
    setupEventListeners();
}

function renderAvatarGrid() {
    avatarGrid.innerHTML = '';
    avatars.forEach(avatar => {
        const div = document.createElement('div');
        div.className = 'avatar-option';
        const img = document.createElement('img');
        img.src = `images/avatars/${avatar}.jpg`;
        img.alt = avatar;
        // Fallback for avatar
        img.onerror = () => { img.src = 'https://via.placeholder.com/60?text=?'; };

        div.appendChild(img);
        div.onclick = () => {
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedAvatar = avatar;
        };
        avatarGrid.appendChild(div);
    });
}

function setupEventListeners() {
    joinBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name || !selectedAvatar) {
            alert("Please select an avatar and enter a username.");
            return;
        }
        myUsername = name;
        socket.emit('join_game', { name, avatar: selectedAvatar });
        playBackgroundMusic();
    });

    readyBtn.addEventListener('click', () => {
        socket.emit('toggle_ready');
    });

    restartBtn.addEventListener('click', () => {
        socket.emit('restart_game');
    });

    // Socket Events
    socket.on('connect', () => {
        console.log("Connected to server");
        myPlayerId = socket.id;
    });

    socket.on('game_update', (state) => {
        gameState = state;
        renderGameState(state);
    });

    socket.on('error_msg', (msg) => {
        alert(msg);
    });
}

// Helper: Get Card Details
function getCardDetails(cardData) {
    // Safety check
    if (!cardData) return { suit: '', value: '', filename: '' };

    let suit, value;

    if (typeof cardData === 'string') {
        // Attempt to parse string format "suit value" or "value suit"
        const parts = cardData.split(' ');
        if (parts.length === 2) {
             // Heuristic: suit is usually the word (copas, ouros...), value is number/letter
             if (['copas','ouros','espadas','paus'].includes(parts[0].toLowerCase())) {
                 suit = parts[0].toLowerCase();
                 value = parts[1];
             } else {
                 value = parts[0];
                 suit = parts[1].toLowerCase();
             }
        }
    } else {
        // Assume object
        suit = cardData.suit ? cardData.suit.toLowerCase() : '';
        value = cardData.value;
    }

    if (!suit || !value) return { suit: '', value: '', filename: '' };

    // Map suit symbols if needed, but PRD says filenames use 'copas', 'ouros', etc.
    // Values: 4, 5, 6, 7, Q, J, K, A, 2, 3.

    return {
        suit,
        value,
        filename: `images/${suit}_${value}.png`,
        symbol: getSuitSymbol(suit)
    };
}

function getSuitSymbol(suit) {
    switch(suit) {
        case 'ouros': return '♦';
        case 'espadas': return '♠';
        case 'copas': return '♥';
        case 'paus': return '♣';
        default: return '?';
    }
}

// Helper: Create Card Element (2-Layer)
function createCardElement(cardData, isInteractive = false, index = -1) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `card ${cardData.suit}`;

    // Text Layer
    const textDiv = document.createElement('div');
    textDiv.className = 'card-text';
    textDiv.innerHTML = `<span>${cardData.value}</span><span>${cardData.symbol}</span>`;

    // Image Layer
    const img = document.createElement('img');
    img.src = cardData.filename;
    img.onerror = function() { this.style.display = 'none'; }; // Hide if missing, showing text

    cardDiv.appendChild(textDiv);
    cardDiv.appendChild(img);

    if (isInteractive) {
        cardDiv.onclick = () => {
            socket.emit('play_card', index);
        };
    }

    return cardDiv;
}

// Core Render Function
function renderGameState(state) {
    // Switch Screens
    Object.values(screens).forEach(s => s.classList.remove('active'));

    if (state.status === 'LOBBY') {
        screens.lobby.classList.add('active');
        renderLobby(state);
    } else if (state.status === 'GAME_OVER') {
        screens.gameOver.classList.add('active');
        renderGameOver(state);
        bgMusic.pause();
        victoryMusic.play().catch(() => {});
    } else {
        screens.game.classList.add('active');
        renderTable(state);
    }
}

function renderLobby(state) {
    // If I am in the player list, show waiting area, hide inputs
    const myPlayer = state.players.find(p => p.id === socket.id);

    if (myPlayer) {
        document.querySelector('.input-section').classList.add('hidden'); // styling needed
        document.querySelector('.avatar-section').classList.add('hidden'); // styling needed
        waitingArea.classList.remove('hidden');
        joinBtn.style.display = 'none'; // Hide join button explicitly if needed
    } else {
        document.querySelector('.input-section').classList.remove('hidden');
        document.querySelector('.avatar-section').classList.remove('hidden');
        waitingArea.classList.add('hidden');
        joinBtn.style.display = 'block';
    }

    // Render Player List
    playerList.innerHTML = '';
    state.players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.name} ${p.ready ? '✅' : '⏳'}`;
        playerList.appendChild(li);
    });

    // Update ready button state
    if (myPlayer) {
        readyBtn.textContent = myPlayer.ready ? "Not Ready" : "Ready";
        readyBtn.classList.toggle('ready', myPlayer.ready); // Add style if needed
    }
}

function renderTable(state) {
    // 1. Identify Local Player Index
    const myIndex = state.players.findIndex(p => p.id === socket.id);
    if (myIndex === -1) return; // Should not happen if game started and I am in it

    // 2. Rotate Players Array so Local Player is at Index 0
    const playerCount = state.players.length;
    const rotatedPlayers = [];
    for (let i = 0; i < playerCount; i++) {
        rotatedPlayers.push(state.players[(myIndex + i) % playerCount]);
    }

    // 3. Render Vira
    viraContainer.innerHTML = '';
    if (state.vira) {
        const viraCard = getCardDetails(state.vira);
        viraContainer.appendChild(createCardElement(viraCard));
    }

    // 4. Render Table Cards
    tableCardsContainer.innerHTML = '';
    // state.tableCards should be an array of objects: { playerId, card }
    // We need to map playerId to the visual position.
    state.tableCards.forEach(played => {
        // Find relative index for this player
        const pIndex = state.players.findIndex(p => p.id === played.playerId);
        const relativeIndex = (pIndex - myIndex + playerCount) % playerCount;

        // Calculate Position
        // Angle depends on relativeIndex and playerCount
        // 0 (Local) = 90 deg (Bottom)
        // Step = 360 / N
        // Angle = 90 + (relativeIndex * 360 / N)
        const angleDeg = 90 + (relativeIndex * (360 / playerCount));
        const angleRad = angleDeg * (Math.PI / 180);

        // Distance from center: slightly closer than players. Say 20%
        const radius = 20;
        const x = 50 + radius * Math.cos(angleRad);
        const y = 50 + radius * Math.sin(angleRad);

        const cardDetails = getCardDetails(played.card);
        const cardEl = createCardElement(cardDetails);

        cardEl.style.position = 'absolute';
        cardEl.style.left = `${x}%`;
        cardEl.style.top = `${y}%`;
        cardEl.style.transform = `translate(-50%, -50%)`; // Keep straight or rotate? PRD says "rendered slightly closer". No rotation specified.

        tableCardsContainer.appendChild(cardEl);
    });

    // 5. Render Opponents & Local HUD
    opponentsContainer.innerHTML = '';
    localHud.innerHTML = '';
    localHand.innerHTML = '';

    rotatedPlayers.forEach((p, i) => {
        // i=0 is Local Player
        if (i === 0) {
            // Local HUD
            renderPlayerHud(localHud, p, state);
            // Local Hand
            p.hand.forEach((card, cardIndex) => {
                const cardDetails = getCardDetails(card);
                const isMyTurn = (state.status === 'PLAYING' && state.currentTurnIndex === myIndex);
                localHand.appendChild(createCardElement(cardDetails, isMyTurn, cardIndex));
            });
        } else {
            // Opponent
            const hudDiv = document.createElement('div');
            hudDiv.className = 'player-hud';

            // Position
            const angleDeg = 90 + (i * (360 / playerCount));
            const angleRad = angleDeg * (Math.PI / 180);
            const radius = 42; // Distance from center

            const x = 50 + radius * Math.cos(angleRad);
            const y = 50 + radius * Math.sin(angleRad);

            hudDiv.style.left = `${x}%`;
            hudDiv.style.top = `${y}%`;
            hudDiv.style.transform = `translate(-50%, -50%)`;

            renderPlayerHud(hudDiv, p, state);
            opponentsContainer.appendChild(hudDiv);
        }
    });

    // 6. Betting Modal
    if (state.status === 'BETTING') {
        // Check if it's my turn
        if (state.bettingTurnIndex === myIndex) {
            bettingModal.classList.remove('hidden');
            renderBettingOptions(state.roundNumber, state.forbiddenBet);
            notificationText.textContent = "YOUR TURN TO BET!";
            notificationOverlay.classList.remove('hidden');
        } else {
            bettingModal.classList.add('hidden');
            const activePlayer = state.players[state.bettingTurnIndex];
            notificationText.textContent = `${activePlayer.name} is betting...`;
            notificationOverlay.classList.remove('hidden');
        }
    } else if (state.status === 'PLAYING') {
        bettingModal.classList.add('hidden');
        const activePlayer = state.players[state.currentTurnIndex];
        if (state.currentTurnIndex === myIndex) {
            notificationText.textContent = "YOUR TURN TO PLAY!";
        } else {
            notificationText.textContent = `${activePlayer.name} is playing...`;
        }
        notificationOverlay.classList.remove('hidden');
    } else {
        bettingModal.classList.add('hidden');
        notificationOverlay.classList.add('hidden');
    }
}

function renderPlayerHud(container, player, state) {
    // Check if active
    const isActive = (state.status === 'BETTING' && state.players[state.bettingTurnIndex].id === player.id) ||
                     (state.status === 'PLAYING' && state.players[state.currentTurnIndex].id === player.id);

    if (isActive) container.classList.add('active-turn');
    else container.classList.remove('active-turn');

    const avatarImg = document.createElement('img');
    avatarImg.src = `images/avatars/${player.avatar}.jpg`;
    avatarImg.onerror = () => { avatarImg.src = 'https://via.placeholder.com/40'; };

    const nameDiv = document.createElement('div');
    nameDiv.textContent = player.name;

    const livesDiv = document.createElement('div');
    // Hearts or Skull
    livesDiv.textContent = player.lives > 0 ? "❤️".repeat(player.lives) : "💀";

    const statsDiv = document.createElement('div');
    // Bet and Tricks
    // Assuming player object has 'bet' and 'tricksWon'
    // If bet is null, show '-'
    const betText = player.bet !== null ? player.bet : '-';
    statsDiv.textContent = `Bet: ${betText} | Won: ${player.tricksWon}`;

    container.appendChild(avatarImg);
    container.appendChild(nameDiv);
    container.appendChild(livesDiv);
    container.appendChild(statsDiv);
}

function renderBettingOptions(maxBet, forbiddenBet) {
    betOptions.innerHTML = '';
    for (let i = 0; i <= maxBet; i++) {
        const btn = document.createElement('button');
        btn.className = 'bet-btn';
        btn.textContent = i;

        if (i === forbiddenBet) {
            btn.disabled = true;
            btn.classList.add('forbidden');
            btn.title = "Forbidden Bet (Sum rule)";
        }

        btn.onclick = () => {
            socket.emit('place_bet', i);
        };

        betOptions.appendChild(btn);
    }
}

function renderGameOver(state) {
    if (state.winner) {
        championName.textContent = state.winner.name;
        championAvatar.style.backgroundImage = `url('images/avatars/${state.winner.avatar}.jpg')`;
    }
}

// Start
init();
