// ============================================
// Renderer – Canvas 2D drawing
// ============================================
const Renderer = (() => {
    let canvas, ctx;
    let fieldWidth = 1200;
    let fieldHeight = 600;
    let padding = 40;
    let goalHeight = 160;
    let goalWidth = 12;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        const maxW = window.innerWidth - 40;
        const maxH = window.innerHeight - 100;
        scale = Math.min(maxW / fieldWidth, maxH / fieldHeight);
        canvas.width = fieldWidth * scale;
        canvas.height = fieldHeight * scale;
        offsetX = 0;
        offsetY = 0;
    }

    function render(state, roomData) {
        if (!ctx) return;
        ctx.save();
        ctx.scale(scale, scale);

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, fieldWidth, fieldHeight);

        drawField();
        drawGoals();

        if (state) {
            drawBall(state.ball);
            drawPlayers(state.players, roomData);
        }

        ctx.restore();
    }

    function drawField() {
        const x = padding;
        const y = padding;
        const w = fieldWidth - padding * 2;
        const h = fieldHeight - padding * 2;

        // Grass
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, '#1a5c2a');
        gradient.addColorStop(0.5, '#1e6b31');
        gradient.addColorStop(1, '#1a5c2a');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();

        // Grass stripes
        const stripeWidth = w / 12;
        for (let i = 0; i < 12; i += 2) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.fillRect(x + i * stripeWidth, y, stripeWidth, h);
        }

        // Border lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.stroke();

        // Center line
        ctx.beginPath();
        ctx.moveTo(fieldWidth / 2, y);
        ctx.lineTo(fieldWidth / 2, y + h);
        ctx.stroke();

        // Center circle
        ctx.beginPath();
        ctx.arc(fieldWidth / 2, fieldHeight / 2, 60, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(fieldWidth / 2, fieldHeight / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Penalty areas
        const penW = 80;
        const penH = 220;
        const penY = fieldHeight / 2 - penH / 2;

        // Left penalty
        ctx.strokeRect(x, penY, penW, penH);
        // Right penalty
        ctx.strokeRect(x + w - penW, penY, penW, penH);

        // Small area
        const smallW = 35;
        const smallH = 120;
        const smallY = fieldHeight / 2 - smallH / 2;
        ctx.strokeRect(x, smallY, smallW, smallH);
        ctx.strokeRect(x + w - smallW, smallY, smallW, smallH);
    }

    function drawGoals() {
        const goalTop = fieldHeight / 2 - goalHeight / 2;
        const goalBottom = fieldHeight / 2 + goalHeight / 2;

        // Left goal
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(padding - goalWidth, goalTop, goalWidth, goalHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(padding, goalTop);
        ctx.lineTo(padding - goalWidth, goalTop);
        ctx.lineTo(padding - goalWidth, goalBottom);
        ctx.lineTo(padding, goalBottom);
        ctx.stroke();

        // Right goal
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(fieldWidth - padding, goalTop, goalWidth, goalHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(fieldWidth - padding, goalTop);
        ctx.lineTo(fieldWidth - padding + goalWidth, goalTop);
        ctx.lineTo(fieldWidth - padding + goalWidth, goalBottom);
        ctx.lineTo(fieldWidth - padding, goalBottom);
        ctx.stroke();

        // Goal posts (circles)
        ctx.fillStyle = '#ffffff';
        const postRadius = 4;
        [
            [padding, goalTop],
            [padding, goalBottom],
            [fieldWidth - padding, goalTop],
            [fieldWidth - padding, goalBottom]
        ].forEach(([px, py]) => {
            ctx.beginPath();
            ctx.arc(px, py, postRadius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawBall(ball) {
        if (!ball) return;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(ball.x + 3, ball.y + 3, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ball
        const ballGrad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 2, ball.x, ball.y, 10);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.7, '#e0e0e0');
        ballGrad.addColorStop(1, '#bbbbbb');
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Ball border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pentagon pattern on ball
        ctx.fillStyle = 'rgba(50, 50, 50, 0.3)';
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const px = ball.x + Math.cos(angle) * 5;
            const py = ball.y + Math.sin(angle) * 5;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawPlayers(players, roomData) {
        if (!players) return;

        players.forEach(p => {
            const teamData = p.team === 'left'
                ? (roomData ? roomData.teamLeft : { jersey: '#3B82F6', shorts: '#1E40AF', number: '#FFFFFF' })
                : (roomData ? roomData.teamRight : { jersey: '#EF4444', shorts: '#991B1B', number: '#FFFFFF' });

            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(p.x + 2, p.y + 20, 14, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shorts (lower half circle)
            ctx.fillStyle = teamData.shorts;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 18, 0, Math.PI);
            ctx.fill();

            // Jersey (upper half circle + full circle overlay)
            ctx.fillStyle = teamData.jersey;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 18, Math.PI, Math.PI * 2);
            ctx.fill();

            // Full circle outline with depth
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
            ctx.stroke();

            // Jersey highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 16, Math.PI * 1.2, Math.PI * 1.8);
            ctx.stroke();

            // Number
            ctx.fillStyle = teamData.number;
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.number, p.x, p.y);

            // Player name
            ctx.fillStyle = '#ffffff';
            ctx.font = '600 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.username, p.x, p.y - 26);

            // Shot power indicator
            if (p.shootHoldTime > 0 && p.id === Network.getPlayerId()) {
                const power = Math.min(p.shootHoldTime * 12, 18);
                const ratio = power / 18;
                ctx.strokeStyle = `hsl(${120 - ratio * 120}, 100%, 50%)`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
                ctx.stroke();
            }
        });
    }

    function destroy() {
        window.removeEventListener('resize', resize);
    }

    return { init, render, resize, destroy };
})();
