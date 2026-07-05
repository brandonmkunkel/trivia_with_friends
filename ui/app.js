// Establish unique player ID using localStorage for session persistence
let playerId = localStorage.getItem("trivia_player_id");
if (!playerId) {
  playerId = "p_" + Math.random().toString(36).substr(2, 9);
  localStorage.setItem("trivia_player_id", playerId);
}

// Confetti animation variables and functions
let confettiActive = false;
let confettiAnimId = null;

function startConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Resize canvas to full viewport
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#C23B22", "#E5A93C", "#DE8A4F", "#D6A2A8", "#478ECC", "#FFFDF6"];
  const particles = [];
  const particleCount = 150;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * particleCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tiltAngle: 0,
      speed: Math.random() * 3 + 2
    });
  }

  confettiActive = true;

  function draw() {
    if (!confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += p.speed;
      p.x += Math.sin(p.tiltAngle) * 0.5;
      p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 5;

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();

      if (p.y > canvas.height) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
    });

    confettiAnimId = requestAnimationFrame(draw);
  }

  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  draw();

  window.addEventListener("resize", resizeConfettiCanvas);
}

function resizeConfettiCanvas() {
  const canvas = document.getElementById("confetti-canvas");
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

function stopConfetti() {
  confettiActive = false;
  if (confettiAnimId) {
    cancelAnimationFrame(confettiAnimId);
    confettiAnimId = null;
  }
  const canvas = document.getElementById("confetti-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  window.removeEventListener("resize", resizeConfettiCanvas);
}

// Retrieve role from URL params or auto-detect based on path and device
const urlParams = new URLSearchParams(window.location.search);
let role = urlParams.get("role");
if (!role) {
  const path = window.location.pathname;
  if (path.endsWith("/host") || path.endsWith("/host/")) {
    role = "host";
  } else if (path.endsWith("/results") || path.endsWith("/results/")) {
    role = "results";
  } else if (path.endsWith("/join") || path.endsWith("/join/")) {
    role = "player";
  } else {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    const isSmallScreen = window.innerWidth < 768;
    role = isMobile || isSmallScreen ? "player" : "screen";
  }
}

// State management
// State management
let ws;
let pingInterval = null;
let lastReceivedState = null;
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${wsProtocol}//${window.location.host}/ws?player_id=${playerId}`;

// Setup connections
function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WebSocket connected");
    if (role === "host") {
      const hostStatus = document.getElementById("host-connection-status");
      if (hostStatus) {
        hostStatus.innerText = "Online";
        hostStatus.className = "status-online";
      }
    }

    // Heartbeat ping to keep connection alive
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        send({ action: "ping" });
      }
    }, 10000);

    // Auto-rejoin if player has already set their details
    const savedName = localStorage.getItem("trivia_player_name");
    const savedRoom = localStorage.getItem("trivia_room_code");
    if (role === "player" && savedName && savedRoom) {
      send({
        action: "join",
        player_id: playerId,
        name: savedName,
        room_code: savedRoom,
      });
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "state_update") {
        lastReceivedState = msg.state;
        updateUI(msg.state);
      } else if (msg.type === "error") {
        alert(msg.message);
        if (msg.message.includes("Room Code")) {
          localStorage.removeItem("trivia_room_code");
          if (lastReceivedState) {
            // Filter out my registration so it defaults to setup view
            lastReceivedState.players = lastReceivedState.players.filter(
              (p) => p.id !== playerId,
            );
            updateUI(lastReceivedState);
          }
        }
      }
    } catch (err) {
      console.error("Error parsing message", err);
    }
  };

  ws.onclose = (event) => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    console.log(
      `WebSocket disconnected (code: ${event.code}, reason: "${event.reason}"), reconnecting in 2 seconds...`,
    );
    if (role === "host") {
      const hostStatus = document.getElementById("host-connection-status");
      if (hostStatus) {
        hostStatus.innerText = "Offline";
        hostStatus.className = "status-offline";
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

function updateUI(state) {
  // Hide all main wrappers first
  document.getElementById("view-screen").classList.add("hidden");
  document.getElementById("view-player").classList.add("hidden");
  document.getElementById("view-host").classList.add("hidden");

  if (state.status !== "ended") {
    stopConfetti();
  }

  if (role === "screen") {
    document.getElementById("view-screen").classList.remove("hidden");
    renderScreen(state);
  } else if (role === "results") {
    document.getElementById("view-screen").classList.remove("hidden");
    renderResultsScreenOnly(state);
  } else if (role === "host") {
    document.getElementById("view-host").classList.remove("hidden");
    renderHost(state);
  } else {
    document.getElementById("view-player").classList.remove("hidden");
    renderPlayer(state);
  }
}

function renderResultsScreenOnly(state) {
  document.getElementById("screen-lobby").classList.add("hidden");
  document.getElementById("screen-board").classList.add("hidden");
  document.getElementById("screen-question").classList.add("hidden");
  document.getElementById("screen-ended").classList.add("hidden");
  document.getElementById("screen-results").classList.remove("hidden");

  document.getElementById("results-title-header").innerText =
    state.status === "ended" ? "Final Standings" : "Live Leaderboard";

  const standingsList = document.getElementById("screen-mid-standings");
  standingsList.innerHTML = "";
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  sorted.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "standing-item";
    item.innerHTML = `
        <div>
            <span class="standing-rank">#${idx + 1}</span>
            <span>${p.name}</span>
        </div>
        <div class="glow-text">${p.score} pts</div>
    `;
    standingsList.appendChild(item);
  });
}

/* ==================== SCREEN RENDERING LOGIC ==================== */
function renderScreen(state) {
  // Hide all sub-sections
  document.getElementById("screen-lobby").classList.add("hidden");
  document.getElementById("screen-board").classList.add("hidden");
  document.getElementById("screen-question").classList.add("hidden");
  document.getElementById("screen-ended").classList.add("hidden");
  document.getElementById("screen-results").classList.add("hidden");

  if (state.status === "lobby") {
    document.getElementById("screen-lobby").classList.remove("hidden");
    const protocol = window.location.protocol;
    const hostIp = state.host_ip || window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    document.getElementById("screen-join-url").innerText =
      `${protocol}//${hostIp}${port}/join`;
    document.getElementById("screen-room-code").innerText =
      state.room_code || "----";
    document.getElementById("screen-game-name").innerText = state.name;

    const connectedPlayers = state.players || [];
    document.getElementById("screen-player-count").innerText =
      connectedPlayers.length;

    const list = document.getElementById("screen-players-list");
    list.innerHTML = "";
    connectedPlayers.forEach((p) => {
      const li = document.createElement("li");
      li.className = "player-card" + (p.connected ? "" : " disconnected");
      li.innerHTML = p.name;
      list.appendChild(li);
    });
  } else if (state.status === "board") {
    document.getElementById("screen-board").classList.remove("hidden");
    document.getElementById("screen-board-game-name").innerText = state.name;

    // Render Scores bar
    renderScoresBar(
      document.getElementById("screen-board-scores"),
      state.players,
    );

    // Render Jeopardy Grid
    const grid = document.getElementById("screen-jeopardy-grid");
    renderJeopardyGrid(grid, state, false);

    // Show who is choosing a question
    const boardStatus = document.getElementById("screen-board-status");
    if (boardStatus) {
      if (state.active_player_id) {
        const activePlayer = state.players.find((p) => p.id === state.active_player_id);
        if (activePlayer) {
          boardStatus.innerText = `${activePlayer.name} is choosing a question from the board`;
        } else {
          boardStatus.innerText = "Host is choosing a question from the board";
        }
      } else {
        boardStatus.innerText = "Host is choosing a question from the board";
      }
    }
  } else if (
    state.status === "question" ||
    state.status === "buzzed" ||
    state.status === "revealed"
  ) {
    document.getElementById("screen-question").classList.remove("hidden");

    const q = state.current_question;
    if (q) {
      // Find category name
      let catName = "Trivia";
      state.categories.forEach((c) => {
        if (c.questions.some((item) => item.id === q.id)) {
          catName = c.name;
        }
      });

      document.getElementById("screen-question-category").innerText = catName;
      document.getElementById("screen-question-points").innerText =
        `${q.points} Points`;
      document.getElementById("screen-question-text").innerText = q.question;
    }

    // Handle Buzz overlays
    const buzzOverlay = document.getElementById("screen-buzzed-overlay");
    if (state.status === "buzzed" && state.current_buzzer) {
      buzzOverlay.classList.remove("hidden");
      const buzzerPlayer = state.players.find(
        (p) => p.id === state.current_buzzer,
      );
      document.getElementById("screen-buzzer-player-name").innerText =
        buzzerPlayer ? buzzerPlayer.name : "Someone";
    } else {
      buzzOverlay.classList.add("hidden");
    }

    // Handle Answer overlay
    const answerOverlay = document.getElementById("screen-answer-overlay");
    if (state.status === "revealed" && q) {
      answerOverlay.classList.remove("hidden");
      document.getElementById("screen-answer-text").innerText = q.answer;
    } else {
      answerOverlay.classList.add("hidden");
    }

    // Render scores footer
    renderScoresBar(
      document.getElementById("screen-question-scores"),
      state.players,
    );
  } else if (state.status === "results") {
    document.getElementById("screen-results").classList.remove("hidden");
    document.getElementById("results-title-header").innerText =
      "Current Standings";
    const standings = document.getElementById("screen-mid-standings");
    standings.innerHTML = "";
    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
    sortedPlayers.forEach((p, idx) => {
      const item = document.createElement("div");
      item.className = "standing-item";
      item.innerHTML = `
                <div>
                    <span class="standing-rank">#${idx + 1}</span>
                    <span>${p.name}</span>
                </div>
                <div class="glow-text">${p.score} pts</div>
            `;
      standings.appendChild(item);
    });
  } else if (state.status === "ended") {
    document.getElementById("screen-ended").classList.remove("hidden");
    const standings = document.getElementById("screen-final-standings");
    standings.innerHTML = "";

    // Sort players by score
    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
    sortedPlayers.forEach((p, idx) => {
      const item = document.createElement("div");
      item.className = "standing-item";
      item.innerHTML = `
                <div>
                    <span class="standing-rank">#${idx + 1}</span>
                    <span>${p.name}</span>
                </div>
                <div class="glow-text">${p.score} pts</div>
            `;
      standings.appendChild(item);
    });
  }
}

// Helpers for Screen rendering
function renderScoresBar(container, players) {
  container.innerHTML = "";
  const sorted = [...players].sort((a, b) => b.score - a.score).slice(0, 5);
  sorted.forEach((p) => {
    const badge = document.createElement("div");
    badge.className = "score-badge" + (p.connected ? "" : " disconnected");
    badge.innerHTML = `${p.name}: <span class="score-val">${p.score}</span>`;
    container.appendChild(badge);
  });
}

function renderJeopardyGrid(gridContainer, state, isHostMode) {
  gridContainer.innerHTML = "";

  state.categories.forEach((cat) => {
    const col = document.createElement("div");
    col.className = "grid-category";

    const catHeader = document.createElement("div");
    catHeader.className = "category-name-card";
    catHeader.innerText = cat.name;
    col.appendChild(catHeader);

    cat.questions.forEach((q) => {
      const card = document.createElement("div");
      card.className =
        "question-point-card" + (q.completed ? " completed" : "");
      card.innerText = q.completed ? "" : `$${q.points}`;

      if (isHostMode && !q.completed && state.status === "board") {
        card.addEventListener("click", () => {
          send({ action: "select_question", question_id: q.id });
        });
      }
      col.appendChild(card);
    });

    gridContainer.appendChild(col);
  });
}

/* ==================== PLAYER RENDERING LOGIC ==================== */
function renderPlayer(state) {
  const me = state.players.find((p) => p.id === playerId);

  // Switch views depending on registration
  if (!me) {
    // If the game was reset, or the player is not registered in the game,
    // clear the saved room code to prevent automatic re-joins.
    const savedRoom = localStorage.getItem("trivia_room_code");
    if (savedRoom) {
      localStorage.removeItem("trivia_room_code");
    }

    // Force redirection to /$HOST/join if not already there
    const pathname = window.location.pathname;
    if (!pathname.endsWith("/join") && !pathname.endsWith("/join/")) {
      window.location.pathname = "/join";
      return;
    }

    showPlayerSection("player-setup");

    // Clear and prefill inputs
    const savedName = localStorage.getItem("trivia_player_name");
    const nameInput = document.getElementById("player-name-input");
    const roomInput = document.getElementById("player-room-input");

    if (nameInput) {
      nameInput.value = savedName || "";
    }
    if (roomInput) {
      roomInput.value = "";
    }
    
    stopConfetti();
    return;
  }

  // Save to sync
  localStorage.setItem("trivia_player_name", me.name);

  // Common player state panel updates
  const myScoreText = document.getElementById("player-my-score");
  if (myScoreText) myScoreText.innerText = me.score;

  const myNameText = document.getElementById("player-my-name");
  if (myNameText) myNameText.innerText = me.name;

  // Route states
  if (state.status === "lobby") {
    showPlayerSection("player-lobby");
    document.getElementById("player-lobby-count").innerText =
      state.players.length;
  } else if (state.status === "board") {
    showPlayerSection("player-board");
    const playerBoardStatus = document.getElementById("player-board-status");
    if (playerBoardStatus) {
      if (state.active_player_id) {
        const activePlayer = state.players.find((p) => p.id === state.active_player_id);
        if (activePlayer) {
          if (activePlayer.id === playerId) {
            playerBoardStatus.innerText = "You are choosing a question from the board! Tell the host which one you want.";
          } else {
            playerBoardStatus.innerText = `${activePlayer.name} is choosing a question from the board`;
          }
        } else {
          playerBoardStatus.innerText = "The host is choosing a question from the board.";
        }
      } else {
        playerBoardStatus.innerText = "The host is choosing a question from the board.";
      }
    }
  } else if (state.status === "question" || state.status === "buzzed") {
    const q = state.current_question;
    let catName = "Jeopardy";
    if (q) {
      state.categories.forEach((c) => {
        if (c.questions.some((item) => item.id === q.id)) {
          catName = c.name;
        }
      });
      const qCategory = document.getElementById("player-q-category");
      const qPoints = document.getElementById("player-q-points");
      const qText = document.getElementById("player-q-text");
      if (qCategory) qCategory.innerText = catName;
      if (qPoints) qPoints.innerText = `${q.points} pts`;
      if (qText) qText.innerText = q.question;
    }

    if (state.status === "question") {
      showPlayerSection("player-question");
      const buzzBtn = document.getElementById("player-buzz-btn");
      const statusMsg = document.getElementById("player-status-message");

      const hasBuzzedIncorrectly = state.buzzed_players.includes(playerId);
      if (hasBuzzedIncorrectly) {
        if (buzzBtn) buzzBtn.disabled = true;
        if (statusMsg)
          statusMsg.innerText = "Locked out (Incorrect answer submitted).";
      } else {
        if (buzzBtn) buzzBtn.disabled = false;
        if (statusMsg) statusMsg.innerText = "Buzz in when you know it!";
      }
    } else if (state.status === "buzzed") {
      if (state.current_buzzer === playerId) {
        showPlayerSection("player-buzzed");
        document.getElementById("player-buzz-title").innerText = "YOUR BUZZ!";
        document.getElementById("player-buzz-subtitle").innerText =
          "State your answer to the host!";
      } else {
        // Disable buzzers for others
        showPlayerSection("player-question");
        const buzzBtn = document.getElementById("player-buzz-btn");
        const statusMsg = document.getElementById("player-status-message");
        if (buzzBtn) buzzBtn.disabled = true;

        const buzzerPlayer = state.players.find(
          (p) => p.id === state.current_buzzer,
        );
        if (statusMsg)
          statusMsg.innerText = buzzerPlayer
            ? `${buzzerPlayer.name} has buzzed!`
            : "Buzzed!";
      }
    }
  } else if (state.status === "revealed") {
    showPlayerSection("player-revealed");
    const q = state.current_question;
    document.getElementById("player-revealed-answer").innerText = q
      ? q.answer
      : "...";
  } else if (state.status === "results") {
    showPlayerSection("player-results");
  } else if (state.status === "ended") {
    showPlayerSection("player-ended");
    
    // Determine the winner
    const scores = state.players.map((p) => p.score);
    const maxScore = Math.max(...scores);
    const isWinner = me.score === maxScore && state.players.length > 0;

    const normalSection = document.getElementById("player-ended-normal");
    const winnerSection = document.getElementById("player-ended-winner");

    if (isWinner) {
      if (normalSection) normalSection.classList.add("hidden");
      if (winnerSection) winnerSection.classList.remove("hidden");
      
      const winnerMsg = document.getElementById("player-winner-msg");
      if (winnerMsg) {
        winnerMsg.innerText = `You are the winner with ${me.score}`;
      }
      
      startConfetti();
    } else {
      if (winnerSection) winnerSection.classList.add("hidden");
      if (normalSection) normalSection.classList.remove("hidden");
      document.getElementById("player-final-score").innerText = me.score;
      
      stopConfetti();
    }
  }
}

function showPlayerSection(sectionId) {
  const sections = [
    "player-setup",
    "player-lobby",
    "player-board",
    "player-question",
    "player-buzzed",
    "player-revealed",
    "player-ended",
    "player-results",
  ];
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === sectionId) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  });
}

/* ==================== HOST RENDERING LOGIC ==================== */
function renderHost(state) {
  // Hide all sections first
  const sections = [
    "host-lobby",
    "host-board",
    "host-question",
    "host-buzzed",
    "host-revealed",
    "host-results",
    "host-ended",
  ];
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  // Render Host Sidebar scoreboard
  const sidebarScores = document.getElementById("host-sidebar-scores");
  sidebarScores.innerHTML = "";
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  sorted.forEach((p) => {
    const li = document.createElement("li");
    li.className = "sidebar-score-item" + (p.connected ? "" : " disconnected");
    li.innerHTML = `<span>${p.name}</span> <span>${p.score}</span>`;
    sidebarScores.appendChild(li);
  });

  if (state.status === "lobby") {
    document.getElementById("host-lobby").classList.remove("hidden");
    document.getElementById("host-player-count").innerText =
      state.players.length;

    const list = document.getElementById("host-players-list");
    list.innerHTML = "";
    state.players.forEach((p) => {
      const li = document.createElement("li");
      li.className = "host-player-item";
      li.innerHTML = `<span>${p.name}</span> <span>${p.connected ? "🟢" : "🔴"}</span>`;
      list.appendChild(li);
    });
  } else if (state.status === "board") {
    document.getElementById("host-board").classList.remove("hidden");
    const grid = document.getElementById("host-jeopardy-grid");
    renderJeopardyGrid(grid, state, true);
  } else if (state.status === "question") {
    document.getElementById("host-question").classList.remove("hidden");

    const q = state.current_question;
    if (q) {
      let catName = "Trivia";
      state.categories.forEach((c) => {
        if (c.questions.some((item) => item.id === q.id)) {
          catName = c.name;
        }
      });
      document.getElementById("host-question-category").innerText = catName;
      document.getElementById("host-question-points").innerText =
        `${q.points} Points`;
      document.getElementById("host-question-text").innerText = q.question;
      document.getElementById("host-question-answer").innerText = q.answer;
    }
  } else if (state.status === "buzzed") {
    document.getElementById("host-buzzed").classList.remove("hidden");
    const buzzerPlayer = state.players.find(
      (p) => p.id === state.current_buzzer,
    );
    document.getElementById("host-buzzer-player-name").innerText = buzzerPlayer
      ? buzzerPlayer.name
      : "Someone";

    // Show correct answer and question text to host
    const q = state.current_question;
    const buzzedQText = document.getElementById("host-buzzed-question-text");
    const buzzedAText = document.getElementById("host-buzzed-answer-text");
    if (q) {
      if (buzzedQText) buzzedQText.innerText = q.question;
      if (buzzedAText) buzzedAText.innerText = q.answer;
    }
  } else if (state.status === "revealed") {
    document.getElementById("host-revealed").classList.remove("hidden");
  } else if (state.status === "results") {
    document.getElementById("host-results").classList.remove("hidden");
  } else if (state.status === "ended") {
    document.getElementById("host-ended").classList.remove("hidden");
  }
}

/* ==================== BUTTON EVENT BINDINGS ==================== */
document.addEventListener("DOMContentLoaded", () => {
  // 1. Setup/Join (Player)
  const joinBtn = document.getElementById("player-join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      const roomCode = document
        .getElementById("player-room-input")
        .value.trim()
        .toUpperCase();
      const name = document.getElementById("player-name-input").value.trim();

      if (!roomCode) {
        alert("Please enter the Room Code shown on the TV screen!");
        return;
      }
      if (!name) {
        alert("Please enter your name to join!");
        return;
      }

      localStorage.setItem("trivia_player_name", name);
      localStorage.setItem("trivia_room_code", roomCode);

      send({
        action: "join",
        player_id: playerId,
        name: name,
        room_code: roomCode,
      });
    });
  }

  // 2. Buzzer button (Player)
  const buzzBtn = document.getElementById("player-buzz-btn");
  if (buzzBtn) {
    buzzBtn.addEventListener("click", () => {
      send({ action: "buzz", player_id: playerId });
    });
  }

  // 3. Start Game button (Host)
  const startBtn = document.getElementById("host-start-game-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      send({ action: "start_game" });
    });
  }

  // 4. Reveal answer button (Host)
  const revealBtn = document.getElementById("host-reveal-btn");
  if (revealBtn) {
    revealBtn.addEventListener("click", () => {
      send({ action: "reveal_answer" });
    });
  }

  // 5. Correct answer button (Host)
  const correctBtn = document.getElementById("host-correct-btn");
  if (correctBtn) {
    correctBtn.addEventListener("click", () => {
      send({ action: "mark_answer", correct: true });
    });
  }

  // 6. Incorrect answer button (Host)
  const incorrectBtn = document.getElementById("host-incorrect-btn");
  if (incorrectBtn) {
    incorrectBtn.addEventListener("click", () => {
      send({ action: "mark_answer", correct: false });
    });
  }

  // 7. Next Question/Return to Board (Host)
  const nextBtn = document.getElementById("host-next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      send({ action: "next_question" });
    });
  }

  // 8. Restart button (Host)
  const restartBtn = document.getElementById("host-restart-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      send({ action: "restart_game" });
    });
  }

  // 9. Show Standings button (Host)
  const showResultsBtn = document.getElementById("host-show-results-btn");
  if (showResultsBtn) {
    showResultsBtn.addEventListener("click", () => {
      send({ action: "show_results" });
    });
  }

  // 10. End Game Early button (Host)
  const endGameBtn = document.getElementById("host-end-game-btn");
  if (endGameBtn) {
    endGameBtn.addEventListener("click", () => {
      send({ action: "end_game" });
    });
  }

  // 11. Results Back button (Host)
  const resultsBackBtn = document.getElementById("host-results-back-btn");
  if (resultsBackBtn) {
    resultsBackBtn.addEventListener("click", () => {
      send({ action: "next_question" });
    });
  }

  // 12. Global Reset button (Host)
  const globalResetBtn = document.getElementById("host-global-reset-btn");
  if (globalResetBtn) {
    globalResetBtn.addEventListener("click", () => {
      showConfirm(
        "Reset Game",
        "Are you sure you want to reset the current game and return to the lobby?",
        () => {
          send({ action: "restart_game" });
        },
      );
    });
  }

  function showConfirm(title, message, onConfirm) {
  const modal = document.getElementById("custom-confirm-modal");
  if (!modal) {
    if (confirm(message)) onConfirm();
    return;
  }

  document.getElementById("custom-confirm-title").innerText = title;
  document.getElementById("custom-confirm-message").innerText = message;
  modal.classList.remove("hidden");

  const okBtn = document.getElementById("custom-confirm-ok-btn");
  const cancelBtn = document.getElementById("custom-confirm-cancel-btn");

  // Re-bind click event listeners to prevent duplicate triggers
  const newOkBtn = okBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newOkBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    onConfirm();
  });

  newCancelBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });
}

// Initialize Connection
connect();
});
