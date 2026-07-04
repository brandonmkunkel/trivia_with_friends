// Establish unique player ID using localStorage for session persistence
let playerId = localStorage.getItem('trivia_player_id');
if (!playerId) {
    playerId = 'p_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('trivia_player_id', playerId);
}

// Retrieve role from URL params (defaults to player)
const urlParams = new URLSearchParams(window.location.search);
let role = urlParams.get('role') || 'player';

// State management
let ws;
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/ws?player_id=${playerId}`;

// Setup connections
function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("WebSocket connected");
        if (role === 'host') {
            const hostStatus = document.getElementById('host-connection-status');
            if (hostStatus) {
                hostStatus.innerText = 'Online';
                hostStatus.className = 'status-online';
            }
        }
        
        // Auto-rejoin if player has already set their details
        const savedName = localStorage.getItem('trivia_player_name');
        const savedTeam = localStorage.getItem('trivia_player_team');
        if (role === 'player' && savedName) {
            send({
                action: 'join',
                player_id: playerId,
                name: savedName,
                team: savedTeam || ''
            });
        }
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'state_update') {
                updateUI(msg.state);
            }
        } catch (err) {
            console.error("Error parsing message", err);
        }
    };

    ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting in 2 seconds...");
        if (role === 'host') {
            const hostStatus = document.getElementById('host-connection-status');
            if (hostStatus) {
                hostStatus.innerText = 'Offline';
                hostStatus.className = 'status-offline';
            }
        }
        setTimeout(connect, 2000);
    };

    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };
}

function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    } else {
        console.warn("WebSocket not connected. Failed to send:", data);
    }
}

// UI Router / Layout Coordinator
function updateUI(state) {
    // Hide all main wrappers first
    document.getElementById('view-screen').classList.add('hidden');
    document.getElementById('view-player').classList.add('hidden');
    document.getElementById('view-host').classList.add('hidden');

    if (role === 'screen') {
        document.getElementById('view-screen').classList.remove('hidden');
        renderScreen(state);
    } else if (role === 'host') {
        document.getElementById('view-host').classList.remove('hidden');
        renderHost(state);
    } else {
        document.getElementById('view-player').classList.remove('hidden');
        renderPlayer(state);
    }
}

/* ==================== SCREEN RENDERING LOGIC ==================== */
function renderScreen(state) {
    // Hide all sub-sections
    document.getElementById('screen-lobby').classList.add('hidden');
    document.getElementById('screen-board').classList.add('hidden');
    document.getElementById('screen-question').classList.add('hidden');
    document.getElementById('screen-ended').classList.add('hidden');

    if (state.status === 'lobby') {
        document.getElementById('screen-lobby').classList.remove('hidden');
        document.getElementById('screen-join-url').innerText = `${window.location.protocol}//${window.location.host}/ui/index.html`;
        document.getElementById('screen-game-name').innerText = state.name;
        
        const connectedPlayers = state.players || [];
        document.getElementById('screen-player-count').innerText = connectedPlayers.length;
        
        const list = document.getElementById('screen-players-list');
        list.innerHTML = '';
        connectedPlayers.forEach(p => {
            const li = document.createElement('li');
            li.className = 'player-card' + (p.connected ? '' : ' disconnected');
            li.innerHTML = `${p.name} ${p.team ? `<span class="team-name">${p.team}</span>` : ''}`;
            list.appendChild(li);
        });
    } 
    
    else if (state.status === 'board') {
        document.getElementById('screen-board').classList.remove('hidden');
        document.getElementById('screen-board-game-name').innerText = state.name;
        
        // Render Scores bar
        renderScoresBar(document.getElementById('screen-board-scores'), state.players);
        
        // Render Jeopardy Grid
        const grid = document.getElementById('screen-jeopardy-grid');
        renderJeopardyGrid(grid, state, false);
    } 
    
    else if (state.status === 'question' || state.status === 'buzzed' || state.status === 'revealed') {
        document.getElementById('screen-question').classList.remove('hidden');
        
        const q = state.current_question;
        if (q) {
            // Find category name
            let catName = "Trivia";
            state.categories.forEach(c => {
                if (c.questions.some(item => item.id === q.id)) {
                    catName = c.name;
                }
            });
            
            document.getElementById('screen-question-category').innerText = catName;
            document.getElementById('screen-question-points').innerText = `${q.points} Points`;
            document.getElementById('screen-question-text').innerText = q.question;
        }

        // Handle Buzz overlays
        const buzzOverlay = document.getElementById('screen-buzzed-overlay');
        if (state.status === 'buzzed' && state.current_buzzer) {
            buzzOverlay.classList.remove('hidden');
            const buzzerPlayer = state.players.find(p => p.id === state.current_buzzer);
            document.getElementById('screen-buzzer-player-name').innerText = buzzerPlayer ? buzzerPlayer.name : "Someone";
        } else {
            buzzOverlay.classList.add('hidden');
        }

        // Handle Answer overlay
        const answerOverlay = document.getElementById('screen-answer-overlay');
        if (state.status === 'revealed' && q) {
            answerOverlay.classList.remove('hidden');
            document.getElementById('screen-answer-text').innerText = q.answer;
        } else {
            answerOverlay.classList.add('hidden');
        }
        
        // Render scores footer
        renderScoresBar(document.getElementById('screen-question-scores'), state.players);
    } 
    
    else if (state.status === 'ended') {
        document.getElementById('screen-ended').classList.remove('hidden');
        const standings = document.getElementById('screen-final-standings');
        standings.innerHTML = '';
        
        // Sort players by score
        const sortedPlayers = [...state.players].sort((a,b) => b.score - a.score);
        sortedPlayers.forEach((p, idx) => {
            const item = document.createElement('div');
            item.className = 'standing-item';
            item.innerHTML = `
                <div>
                    <span class="standing-rank">#${idx + 1}</span>
                    <span>${p.name} ${p.team ? `<small>(${p.team})</small>` : ''}</span>
                </div>
                <div class="glow-text">${p.score} pts</div>
            `;
            standings.appendChild(item);
        });
    }
}

// Helpers for Screen rendering
function renderScoresBar(container, players) {
    container.innerHTML = '';
    const sorted = [...players].sort((a,b) => b.score - a.score);
    sorted.forEach(p => {
        const badge = document.createElement('div');
        badge.className = 'score-badge' + (p.connected ? '' : ' disconnected');
        badge.innerHTML = `${p.name}: <span class="score-val">${p.score}</span>`;
        container.appendChild(badge);
    });
}

function renderJeopardyGrid(gridContainer, state, isHostMode) {
    gridContainer.innerHTML = '';
    
    state.categories.forEach(cat => {
        const col = document.createElement('div');
        col.className = 'grid-category';
        
        const catHeader = document.createElement('div');
        catHeader.className = 'category-name-card';
        catHeader.innerText = cat.name;
        col.appendChild(catHeader);
        
        cat.questions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'question-point-card' + (q.completed ? ' completed' : '');
            card.innerText = q.completed ? '' : `$${q.points}`;
            
            if (isHostMode && !q.completed && state.status === 'board') {
                card.addEventListener('click', () => {
                    send({ action: 'select_question', question_id: q.id });
                });
            }
            col.appendChild(card);
        });
        
        gridContainer.appendChild(col);
    });
}


/* ==================== PLAYER RENDERING LOGIC ==================== */
function renderPlayer(state) {
    const me = state.players.find(p => p.id === playerId);
    
    // Switch views depending on registration
    if (!me) {
        showPlayerSection('player-setup');
        return;
    }
    
    // Save to sync
    localStorage.setItem('trivia_player_name', me.name);
    localStorage.setItem('trivia_player_team', me.team || '');

    // Common player state panel updates
    const myScoreText = document.getElementById('player-my-score');
    if (myScoreText) myScoreText.innerText = me.score;
    
    const myNameText = document.getElementById('player-my-name');
    if (myNameText) myNameText.innerText = me.name;
    
    const myTeamText = document.getElementById('player-my-team');
    if (myTeamText) myTeamText.innerText = me.team ? `Team: ${me.team}` : '';

    // Route states
    if (state.status === 'lobby') {
        showPlayerSection('player-lobby');
        document.getElementById('player-lobby-count').innerText = state.players.length;
    } 
    
    else if (state.status === 'board') {
        showPlayerSection('player-board');
    } 
    
    else if (state.status === 'question') {
        showPlayerSection('player-question');
        
        const q = state.current_question;
        let catName = "Jeopardy";
        if (q) {
            state.categories.forEach(c => {
                if (c.questions.some(item => item.id === q.id)) {
                    catName = c.name;
                }
            });
            document.getElementById('player-q-category').innerText = catName;
            document.getElementById('player-q-points').innerText = `${q.points} pts`;
        }

        const buzzBtn = document.getElementById('player-buzz-btn');
        const statusMsg = document.getElementById('player-status-message');
        
        const hasBuzzedIncorrectly = state.buzzed_players.includes(playerId);
        if (hasBuzzedIncorrectly) {
            buzzBtn.disabled = true;
            statusMsg.innerText = "Locked out (Incorrect answer submitted).";
        } else {
            buzzBtn.disabled = false;
            statusMsg.innerText = "Buzz in when you know it!";
        }
    } 
    
    else if (state.status === 'buzzed') {
        if (state.current_buzzer === playerId) {
            showPlayerSection('player-buzzed');
            document.getElementById('player-buzz-title').innerText = "YOUR BUZZ!";
            document.getElementById('player-buzz-subtitle').innerText = "State your answer to the host!";
        } else {
            // Disable buzzers for others
            showPlayerSection('player-question');
            const buzzBtn = document.getElementById('player-buzz-btn');
            const statusMsg = document.getElementById('player-status-message');
            buzzBtn.disabled = true;
            
            const buzzerPlayer = state.players.find(p => p.id === state.current_buzzer);
            statusMsg.innerText = buzzerPlayer ? `${buzzerPlayer.name} has buzzed!` : "Buzzed!";
        }
    } 
    
    else if (state.status === 'revealed') {
        showPlayerSection('player-revealed');
        const q = state.current_question;
        document.getElementById('player-revealed-answer').innerText = q ? q.answer : '...';
    } 
    
    else if (state.status === 'ended') {
        showPlayerSection('player-ended');
        document.getElementById('player-final-score').innerText = me.score;
    }
}

function showPlayerSection(sectionId) {
    const sections = ['player-setup', 'player-lobby', 'player-board', 'player-question', 'player-buzzed', 'player-revealed', 'player-ended'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === sectionId) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });
}


/* ==================== HOST RENDERING LOGIC ==================== */
function renderHost(state) {
    // Hide all sections first
    const sections = ['host-lobby', 'host-board', 'host-question', 'host-buzzed', 'host-revealed', 'host-ended'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Render Host Sidebar scoreboard
    const sidebarScores = document.getElementById('host-sidebar-scores');
    sidebarScores.innerHTML = '';
    const sorted = [...state.players].sort((a,b) => b.score - a.score);
    sorted.forEach(p => {
        const li = document.createElement('li');
        li.className = 'sidebar-score-item' + (p.connected ? '' : ' disconnected');
        li.innerHTML = `<span>${p.name} ${p.team ? `<small>(${p.team})</small>` : ''}</span> <span>${p.score}</span>`;
        sidebarScores.appendChild(li);
    });

    if (state.status === 'lobby') {
        document.getElementById('host-lobby').classList.remove('hidden');
        document.getElementById('host-player-count').innerText = state.players.length;
        
        const list = document.getElementById('host-players-list');
        list.innerHTML = '';
        state.players.forEach(p => {
            const li = document.createElement('li');
            li.className = 'host-player-item';
            li.innerHTML = `<span>${p.name} ${p.team ? `<small>(${p.team})</small>` : ''}</span> <span>${p.connected ? '🟢' : '🔴'}</span>`;
            list.appendChild(li);
        });
    } 
    
    else if (state.status === 'board') {
        document.getElementById('host-board').classList.remove('hidden');
        const grid = document.getElementById('host-jeopardy-grid');
        renderJeopardyGrid(grid, state, true);
    } 
    
    else if (state.status === 'question') {
        document.getElementById('host-question').classList.remove('hidden');
        
        const q = state.current_question;
        if (q) {
            let catName = "Trivia";
            state.categories.forEach(c => {
                if (c.questions.some(item => item.id === q.id)) {
                    catName = c.name;
                }
            });
            document.getElementById('host-question-category').innerText = catName;
            document.getElementById('host-question-points').innerText = `${q.points} Points`;
            document.getElementById('host-question-text').innerText = q.question;
            document.getElementById('host-question-answer').innerText = q.answer;
        }
    } 
    
    else if (state.status === 'buzzed') {
        document.getElementById('host-buzzed').classList.remove('hidden');
        const buzzerPlayer = state.players.find(p => p.id === state.current_buzzer);
        document.getElementById('host-buzzer-player-name').innerText = buzzerPlayer ? buzzerPlayer.name : "Someone";
    } 
    
    else if (state.status === 'revealed') {
        document.getElementById('host-revealed').classList.remove('hidden');
    } 
    
    else if (state.status === 'ended') {
        document.getElementById('host-ended').classList.remove('hidden');
    }
}


/* ==================== BUTTON EVENT BINDINGS ==================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup/Join (Player)
    const joinBtn = document.getElementById('player-join-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            const name = document.getElementById('player-name-input').value.trim();
            const team = document.getElementById('player-team-input').value.trim();
            
            if (!name) {
                alert("Please enter your name to join!");
                return;
            }
            
            localStorage.setItem('trivia_player_name', name);
            localStorage.setItem('trivia_player_team', team);

            send({
                action: 'join',
                player_id: playerId,
                name: name,
                team: team
            });
        });
    }

    // 2. Buzzer button (Player)
    const buzzBtn = document.getElementById('player-buzz-btn');
    if (buzzBtn) {
        buzzBtn.addEventListener('click', () => {
            send({ action: 'buzz', player_id: playerId });
        });
    }

    // 3. Start Game button (Host)
    const startBtn = document.getElementById('host-start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            send({ action: 'start_game' });
        });
    }

    // 4. Reveal answer button (Host)
    const revealBtn = document.getElementById('host-reveal-btn');
    if (revealBtn) {
        revealBtn.addEventListener('click', () => {
            send({ action: 'reveal_answer' });
        });
    }

    // 5. Correct answer button (Host)
    const correctBtn = document.getElementById('host-correct-btn');
    if (correctBtn) {
        correctBtn.addEventListener('click', () => {
            send({ action: 'mark_answer', correct: true });
        });
    }

    // 6. Incorrect answer button (Host)
    const incorrectBtn = document.getElementById('host-incorrect-btn');
    if (incorrectBtn) {
        incorrectBtn.addEventListener('click', () => {
            send({ action: 'mark_answer', correct: false });
        });
    }

    // 7. Next Question/Return to Board (Host)
    const nextBtn = document.getElementById('host-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            send({ action: 'next_question' });
        });
    }

    // 8. Restart button (Host)
    const restartBtn = document.getElementById('host-restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            send({ action: 'restart_game' });
        });
    }

    // Initialize Connection
    connect();
});
