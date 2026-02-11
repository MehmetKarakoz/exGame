// ============================================
// Game Engine – server-authoritative physics
// ============================================
const C = require('./Constants');

class GameEngine {
    constructor(room) {
        this.room = room;
        this.players = {};
        this.ball = null;
        this.paused = false;
        this.intervalId = null;
        this.onUpdate = null;
        this.onGoal = null;
    }

    init() {
        // Initialize ball at center
        this.ball = {
            x: C.FIELD_WIDTH / 2,
            y: C.FIELD_HEIGHT / 2,
            vx: 0,
            vy: 0,
            radius: C.BALL_RADIUS,
            spin: { x: 0, y: 0 }
        };

        // Initialize players
        this.players = {};
        const leftPlayers = this.room.teamLeft.players;
        const rightPlayers = this.room.teamRight.players;

        const leftPositions = C.getStartPositions('left', leftPlayers.length);
        const rightPositions = C.getStartPositions('right', rightPlayers.length);

        leftPlayers.forEach((pid, i) => {
            const p = this.room.players.get(pid);
            this.players[pid] = {
                id: pid,
                username: p ? p.username : 'Player',
                team: 'left',
                x: leftPositions[i] ? leftPositions[i].x : C.FIELD_PADDING + 100,
                y: leftPositions[i] ? leftPositions[i].y : C.FIELD_HEIGHT / 2,
                vx: 0,
                vy: 0,
                radius: C.PLAYER_RADIUS,
                input: { up: false, down: false, left: false, right: false, shoot: false },
                shootHoldTime: 0,
                number: i + 1
            };
        });

        rightPlayers.forEach((pid, i) => {
            const p = this.room.players.get(pid);
            this.players[pid] = {
                id: pid,
                username: p ? p.username : 'Player',
                team: 'right',
                x: rightPositions[i] ? rightPositions[i].x : C.FIELD_WIDTH - C.FIELD_PADDING - 100,
                y: rightPositions[i] ? rightPositions[i].y : C.FIELD_HEIGHT / 2,
                vx: 0,
                vy: 0,
                radius: C.PLAYER_RADIUS,
                input: { up: false, down: false, left: false, right: false, shoot: false },
                shootHoldTime: 0,
                number: i + 1
            };
        });
    }

    start() {
        this.paused = false;
        this.intervalId = setInterval(() => this.tick(), C.TICK_INTERVAL);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }

    setInput(playerId, input) {
        if (this.players[playerId]) {
            this.players[playerId].input = input;
        }
    }

    tick() {
        if (this.paused) return;

        const dt = 1;

        // Update Bots
        this.updateBots();

        // Update players
        for (const pid in this.players) {
            const p = this.players[pid];

            // Apply input acceleration
            if (p.input.up) p.vy -= C.PLAYER_ACCELERATION;
            if (p.input.down) p.vy += C.PLAYER_ACCELERATION;
            if (p.input.left) p.vx -= C.PLAYER_ACCELERATION;
            if (p.input.right) p.vx += C.PLAYER_ACCELERATION;

            p.vx *= C.PLAYER_FRICTION;
            p.vy *= C.PLAYER_FRICTION;

            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > C.PLAYER_MAX_SPEED) {
                p.vx = (p.vx / speed) * C.PLAYER_MAX_SPEED;
                p.vy = (p.vy / speed) * C.PLAYER_MAX_SPEED;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            p.x = Math.max(C.FIELD_PADDING + p.radius, Math.min(C.FIELD_WIDTH - C.FIELD_PADDING - p.radius, p.x));
            p.y = Math.max(C.FIELD_PADDING + p.radius, Math.min(C.FIELD_HEIGHT - C.FIELD_PADDING - p.radius, p.y));

            if (p.input.shoot) {
                p.shootHoldTime += C.TICK_INTERVAL / 1000;
            } else if (p.shootHoldTime > 0) {
                this.performShot(p);
                p.shootHoldTime = 0;
            }
        }

        // Update Ball
        this.updateBall();

        // Goal post collisions
        this.handleGoalPostCollisions();

        // Player–ball collisions
        for (const pid in this.players) {
            const p = this.players[pid];
            this.resolveCircleCollision(p, this.ball, true);
        }

        // Player–player collisions
        const pids = Object.keys(this.players);
        for (let i = 0; i < pids.length; i++) {
            for (let j = i + 1; j < pids.length; j++) {
                this.resolveCircleCollision(this.players[pids[i]], this.players[pids[j]], false);
            }
        }

        if (this.onUpdate) {
            this.onUpdate(this.getState());
        }
    }

    updateBall() {
        // Apply spin/curve
        if (this.ball.spin && (Math.abs(this.ball.spin.x) > 0.01 || Math.abs(this.ball.spin.y) > 0.01)) {
            // Falso effect: side force perpendicular to velocity
            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            if (speed > 1) {
                // Direction of curve is influenced by the spin vector
                this.ball.vx += this.ball.spin.x * C.CURVE_STRENGTH;
                this.ball.vy += this.ball.spin.y * C.CURVE_STRENGTH;
            }
            this.ball.spin.x *= C.CURVE_FRICTION;
            this.ball.spin.y *= C.CURVE_FRICTION;
        }

        this.ball.vx *= C.BALL_FRICTION;
        this.ball.vy *= C.BALL_FRICTION;

        const ballSpeed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
        if (ballSpeed > C.BALL_MAX_SPEED) {
            this.ball.vx = (this.ball.vx / ballSpeed) * C.BALL_MAX_SPEED;
            this.ball.vy = (this.ball.vy / ballSpeed) * C.BALL_MAX_SPEED;
        }

        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        const goalTop = C.FIELD_HEIGHT / 2 - C.GOAL_HEIGHT / 2;
        const goalBottom = C.FIELD_HEIGHT / 2 + C.GOAL_HEIGHT / 2;
        const inGoalY = this.ball.y > goalTop - 5 && this.ball.y < goalBottom + 5;

        // Top/Bottom walls
        if (this.ball.y - this.ball.radius < C.FIELD_PADDING) {
            this.ball.y = C.FIELD_PADDING + this.ball.radius;
            this.ball.vy = Math.abs(this.ball.vy) * 0.8; // Bounce down
        } else if (this.ball.y + this.ball.radius > C.FIELD_HEIGHT - C.FIELD_PADDING) {
            this.ball.y = C.FIELD_HEIGHT - C.FIELD_PADDING - this.ball.radius;
            this.ball.vy = -Math.abs(this.ball.vy) * 0.8; // Bounce up
        }

        // Left wall/Goal
        if (this.ball.x - this.ball.radius < C.FIELD_PADDING) {
            if (inGoalY) {
                if (this.onGoal) this.onGoal('right');
                return;
            }
            this.ball.x = C.FIELD_PADDING + this.ball.radius;
            this.ball.vx = Math.abs(this.ball.vx) * 0.8; // Bounce right
        } else if (this.ball.x + this.ball.radius > C.FIELD_WIDTH - C.FIELD_PADDING) {
            // Right wall/Goal
            if (inGoalY) {
                if (this.onGoal) this.onGoal('left');
                return;
            }
            this.ball.x = C.FIELD_WIDTH - C.FIELD_PADDING - this.ball.radius;
            this.ball.vx = -Math.abs(this.ball.vx) * 0.8; // Bounce left
        }

        // Final safety clamp for field bounds
        this.ball.x = Math.max(C.FIELD_PADDING - 20, Math.min(C.FIELD_WIDTH - C.FIELD_PADDING + 20, this.ball.x));
        this.ball.y = Math.max(C.FIELD_PADDING - 20, Math.min(C.FIELD_HEIGHT - C.FIELD_PADDING + 20, this.ball.y));
    }

    performShot(player) {
        const dx = this.ball.x - player.x;
        const dy = this.ball.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Required distance is much smaller now (must be very close or touching)
        const contactDist = player.radius + this.ball.radius + 5;
        if (dist > contactDist) return;

        const power = Math.min(
            C.SHOT_MIN_POWER + player.shootHoldTime * C.SHOT_CHARGE_RATE,
            C.SHOT_MAX_POWER
        );

        const nx = dx / dist;
        const ny = dy / dist;

        this.ball.vx = nx * power;
        this.ball.vy = ny * power;

        // Apply curve (falso)
        let spinX = 0;
        let spinY = 0;

        // Keyboard curve (O/P keys) - Perpendicular to shot direction
        if (player.input.curveLeft) {
            spinX = ny * 3;
            spinY = -nx * 3;
        } else if (player.input.curveRight) {
            spinX = -ny * 3;
            spinY = nx * 3;
        }

        // Mouse curve - Directional spin
        if (player.input.mouseX !== undefined && player.input.mouseY !== undefined && !player.input.curveLeft && !player.input.curveRight) {
            const mdx = player.input.mouseX - player.x;
            const mdy = player.input.mouseY - player.y;
            const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mDist > 0) {
                spinX = (mdx / mDist) * 2;
                spinY = (mdy / mDist) * 2;
            }
        }

        if (spinX !== 0 || spinY !== 0) {
            this.ball.spin = { x: spinX, y: spinY };
        }
    }

    updateBots() {
        for (const pid in this.players) {
            const p = this.players[pid];
            if (p.isBot) {
                const dx = this.ball.x - p.x;
                const dy = this.ball.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Simple AI: Move toward ball
                p.input.left = dx < -10;
                p.input.right = dx > 10;
                p.input.up = dy < -10;
                p.input.down = dy > 10;

                // Shoot if close
                if (dist < C.SHOT_RANGE + 10) {
                    p.input.shoot = true;
                    // Reset shoot after some time or immediately for simple bot
                    if (p.shootHoldTime > 0.1) p.input.shoot = false;
                } else {
                    p.input.shoot = false;
                }
            }
        }
    }

    resolveCircleCollision(a, b, isBallCollision) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;

        if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            if (isBallCollision) {
                // Fix: Stronger separation for ball to prevent clipping
                b.x += nx * overlap;
                b.y += ny * overlap;
            } else {
                a.x -= nx * overlap * 0.5;
                a.y -= ny * overlap * 0.5;
                b.x += nx * overlap * 0.5;
                b.y += ny * overlap * 0.5;
            }

            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvDotN = dvx * nx + dvy * ny;

            if (dvDotN > 0) {
                const j = (2 * dvDotN) / (C.PLAYER_MASS + (isBallCollision ? C.BALL_MASS : C.PLAYER_MASS));
                a.vx -= j * (isBallCollision ? C.BALL_MASS : C.PLAYER_MASS) * nx * 0.9;
                a.vy -= j * (isBallCollision ? C.BALL_MASS : C.PLAYER_MASS) * ny * 0.9;
                b.vx += j * C.PLAYER_MASS * nx * 0.9;
                b.vy += j * C.PLAYER_MASS * ny * 0.9;
            }
        }
    }

    handleGoalPostCollisions() {
        const goalTop = C.FIELD_HEIGHT / 2 - C.GOAL_HEIGHT / 2;
        const goalBottom = C.FIELD_HEIGHT / 2 + C.GOAL_HEIGHT / 2;
        const posts = [
            { x: C.FIELD_PADDING, y: goalTop },
            { x: C.FIELD_PADDING, y: goalBottom },
            { x: C.FIELD_WIDTH - C.FIELD_PADDING, y: goalTop },
            { x: C.FIELD_WIDTH - C.FIELD_PADDING, y: goalBottom }
        ];
        const postRadius = 6;

        for (const post of posts) {
            const dx = this.ball.x - post.x;
            const dy = this.ball.y - post.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = this.ball.radius + postRadius;

            if (dist < minDist && dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                this.ball.x = post.x + nx * minDist;
                this.ball.y = post.y + ny * minDist;

                const dot = this.ball.vx * nx + this.ball.vy * ny;
                this.ball.vx -= 2 * dot * nx * 0.8;
                this.ball.vy -= 2 * dot * ny * 0.8;
            }
        }
    }

    resetBall() {
        this.ball.x = C.FIELD_WIDTH / 2;
        this.ball.y = C.FIELD_HEIGHT / 2;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.spin = { x: 0, y: 0 };
    }

    resetPositions() {
        this.resetBall();
        const leftPlayers = this.room.teamLeft.players;
        const rightPlayers = this.room.teamRight.players;
        const leftPositions = C.getStartPositions('left', leftPlayers.length);
        const rightPositions = C.getStartPositions('right', rightPlayers.length);

        leftPlayers.forEach((pid, i) => {
            if (this.players[pid] && leftPositions[i]) {
                this.players[pid].x = leftPositions[i].x;
                this.players[pid].y = leftPositions[i].y;
                this.players[pid].vx = 0;
                this.players[pid].vy = 0;
            }
        });

        rightPlayers.forEach((pid, i) => {
            if (this.players[pid] && rightPositions[i]) {
                this.players[pid].x = rightPositions[i].x;
                this.players[pid].y = rightPositions[i].y;
                this.players[pid].vx = 0;
                this.players[pid].vy = 0;
            }
        });
    }

    getState() {
        const playersArr = [];
        for (const pid in this.players) {
            const p = this.players[pid];
            playersArr.push({
                id: p.id,
                username: p.username,
                team: p.team,
                x: Math.round(p.x * 10) / 10,
                y: Math.round(p.y * 10) / 10,
                vx: Math.round(p.vx * 100) / 100,
                vy: Math.round(p.vy * 100) / 100,
                number: p.number,
                shootHoldTime: p.shootHoldTime,
                isBot: p.isBot
            });
        }
        return {
            players: playersArr,
            ball: {
                x: Math.round(this.ball.x * 10) / 10,
                y: Math.round(this.ball.y * 10) / 10,
                vx: Math.round(this.ball.vx * 100) / 100,
                vy: Math.round(this.ball.vy * 100) / 100
            }
        };
    }
}

module.exports = GameEngine;
