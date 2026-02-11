// ============================================
// Game – input handling, game loop, HUD
// ============================================
const Game = (() => {
    let running = false;
    let roomData = null;
    let lastState = null;
    let input = { up: false, down: false, left: false, right: false, shoot: false };
    let animFrameId = null;
    let shootStartTime = 0;

    function init(room) {
        roomData = room;
        running = true;
        lastState = null;

        // Init canvas
        const canvas = document.getElementById('game-canvas');
        Renderer.init(canvas);

        // HUD
        document.getElementById('hud-team-left-name').textContent = room.teamLeft.name;
        document.getElementById('hud-team-right-name').textContent = room.teamRight.name;
        document.getElementById('hud-score-left').textContent = '0';
        document.getElementById('hud-score-right').textContent = '0';
        document.getElementById('hud-timer').textContent = formatTime(room.matchDuration);

        // Set HUD colors
        document.querySelector('.hud-team-left').style.background =
            `linear-gradient(90deg, ${room.teamLeft.jersey}99, transparent)`;
        document.querySelector('.hud-team-right').style.background =
            `linear-gradient(-90deg, ${room.teamRight.jersey}99, transparent)`;

        // Hide overlays
        document.getElementById('countdown-overlay').style.display = 'none';
        document.getElementById('goal-overlay').style.display = 'none';
        document.getElementById('match-end-overlay').style.display = 'none';
        document.getElementById('shot-power-bar').style.display = 'none';

        // Input
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Network handlers
        Network.on('gameState', onGameState);
        Network.on('countdown', onCountdown);
        Network.on('goal', onGoal);
        Network.on('goalResume', onGoalResume);

        // Start render loop
        renderLoop();
    }

    function destroy() {
        running = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        Network.off('gameState', onGameState);
        Network.off('countdown', onCountdown);
        Network.off('goal', onGoal);
        Network.off('goalResume', onGoalResume);
        Renderer.destroy();
    }

    function onKeyDown(e) {
        if (!running) return;
        let changed = false;

        switch (e.key) {
            case 'w': case 'W': case 'ArrowUp':
                if (!input.up) { input.up = true; changed = true; }
                break;
            case 's': case 'S': case 'ArrowDown':
                if (!input.down) { input.down = true; changed = true; }
                break;
            case 'a': case 'A': case 'ArrowLeft':
                if (!input.left) { input.left = true; changed = true; }
                break;
            case 'd': case 'D': case 'ArrowRight':
                if (!input.right) { input.right = true; changed = true; }
                break;
            case ' ':
                e.preventDefault();
                if (!input.shoot) {
                    input.shoot = true;
                    shootStartTime = performance.now();
                    document.getElementById('shot-power-bar').style.display = 'block';
                    changed = true;
                }
                break;
        }

        if (changed) {
            Network.send({ type: 'input', input });
        }
    }

    function onKeyUp(e) {
        if (!running) return;
        let changed = false;

        switch (e.key) {
            case 'w': case 'W': case 'ArrowUp':
                input.up = false; changed = true; break;
            case 's': case 'S': case 'ArrowDown':
                input.down = false; changed = true; break;
            case 'a': case 'A': case 'ArrowLeft':
                input.left = false; changed = true; break;
            case 'd': case 'D': case 'ArrowRight':
                input.right = false; changed = true; break;
            case ' ':
                input.shoot = false;
                document.getElementById('shot-power-bar').style.display = 'none';
                document.getElementById('shot-power-fill').style.width = '0%';
                changed = true;
                break;
        }

        if (changed) {
            Network.send({ type: 'input', input });
        }
    }

    function onGameState(msg) {
        lastState = msg;

        // Update HUD
        if (msg.match) {
            document.getElementById('hud-score-left').textContent = msg.match.scoreLeft;
            document.getElementById('hud-score-right').textContent = msg.match.scoreRight;
            document.getElementById('hud-timer').textContent = formatTime(msg.match.timeRemaining);
        }
    }

    function onCountdown(msg) {
        const overlay = document.getElementById('countdown-overlay');
        const number = document.getElementById('countdown-number');

        if (msg.value > 0) {
            overlay.style.display = 'flex';
            number.textContent = msg.value;
            number.style.animation = 'none';
            requestAnimationFrame(() => {
                number.style.animation = 'pulse 0.5s ease-in-out';
            });
        } else {
            number.textContent = 'BAŞLA!';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 800);
        }
    }

    function onGoal(msg) {
        const overlay = document.getElementById('goal-overlay');
        overlay.style.display = 'flex';

        document.getElementById('hud-score-left').textContent = msg.scoreLeft;
        document.getElementById('hud-score-right').textContent = msg.scoreRight;
    }

    function onGoalResume() {
        document.getElementById('goal-overlay').style.display = 'none';
    }

    function showMatchEnd(result) {
        running = false;
        const overlay = document.getElementById('match-end-overlay');
        const title = document.getElementById('match-end-title');
        const score = document.getElementById('match-end-score');

        let winnerText = 'Berabere!';
        if (result.winner === 'left' && roomData) {
            winnerText = `🏆 ${roomData.teamLeft.name} Kazandı!`;
        } else if (result.winner === 'right' && roomData) {
            winnerText = `🏆 ${roomData.teamRight.name} Kazandı!`;
        }

        title.textContent = winnerText;
        score.innerHTML = `
      <span style="color:${roomData ? roomData.teamLeft.jersey : '#3B82F6'}">${result.scoreLeft}</span>
      <span style="color:var(--text-muted);">-</span>
      <span style="color:${roomData ? roomData.teamRight.jersey : '#EF4444'}">${result.scoreRight}</span>
    `;

        overlay.style.display = 'flex';

        document.getElementById('match-end-btn').onclick = () => {
            overlay.style.display = 'none';
            destroy();
            Main.showScreen('room');
        };
    }

    function renderLoop() {
        if (!running) return;

        // Update shot power bar
        if (input.shoot) {
            const elapsed = (performance.now() - shootStartTime) / 1000;
            const ratio = Math.min(elapsed * 12 / 18, 1);
            document.getElementById('shot-power-fill').style.width = `${ratio * 100}%`;
        }

        Renderer.render(lastState, roomData);
        animFrameId = requestAnimationFrame(renderLoop);
    }

    function formatTime(seconds) {
        if (seconds < 0) seconds = 0;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    return { init, destroy, showMatchEnd };
})();
