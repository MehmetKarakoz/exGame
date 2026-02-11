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
            radius: C.BALL_RADIUS
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

        const dt = 1; // fixed timestep

        // Update players
        for (const pid in this.players) {
            const p = this.players[pid];

            // Apply input acceleration
            if (p.input.up) p.vy -= C.PLAYER_ACCELERATION;
            if (p.input.down) p.vy += C.PLAYER_ACCELERATION;
            if (p.input.left) p.vx -= C.PLAYER_ACCELERATION;
            if (p.input.right) p.vx += C.PLAYER_ACCELERATION;

            // Apply friction
            p.vx *= C.PLAYER_FRICTION;
            p.vy *= C.PLAYER_FRICTION;

            // Clamp speed
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > C.PLAYER_MAX_SPEED) {
                p.vx = (p.vx / speed) * C.PLAYER_MAX_SPEED;
                p.vy = (p.vy / speed) * C.PLAYER_MAX_SPEED;
            }

            // Update position
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Clamp to field
            p.x = Math.max(C.FIELD_PADDING + p.radius, Math.min(C.FIELD_WIDTH - C.FIELD_PADDING - p.radius, p.x));
            p.y = Math.max(C.FIELD_PADDING + p.radius, Math.min(C.FIELD_HEIGHT - C.FIELD_PADDING - p.radius, p.y));

            // Shot charging
            if (p.input.shoot) {
                p.shootHoldTime += C.TICK_INTERVAL / 1000;
            } else if (p.shootHoldTime > 0) {
                // Release shot
                this.performShot(p);
                p.shootHoldTime = 0;
            }
        }

        // Update ball
        this.ball.vx *= C.BALL_FRICTION;
        this.ball.vy *= C.BALL_FRICTION;

        // Clamp ball speed
        const ballSpeed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
        if (ballSpeed > C.BALL_MAX_SPEED) {
            this.ball.vx = (this.ball.vx / ballSpeed) * C.BALL_MAX_SPEED;
            this.ball.vy = (this.ball.vy / ballSpeed) * C.BALL_MAX_SPEED;
        }

        this.ball.x += this.ball.vx * dt;
        this.ball.y += this.ball.vy * dt;

        // Ball–wall collisions (top & bottom)
        if (this.ball.y - this.ball.radius < C.FIELD_PADDING) {
            this.ball.y = C.FIELD_PADDING + this.ball.radius;
            this.ball.vy *= -0.8;
        }
        if (this.ball.y + this.ball.radius > C.FIELD_HEIGHT - C.FIELD_PADDING) {
            this.ball.y = C.FIELD_HEIGHT - C.FIELD_PADDING - this.ball.radius;
            this.ball.vy *= -0.8;
        }

        // Ball–wall collisions (left & right) — but check for goal
        const goalTop = C.FIELD_HEIGHT / 2 - C.GOAL_HEIGHT / 2;
        const goalBottom = C.FIELD_HEIGHT / 2 + C.GOAL_HEIGHT / 2;
        const inGoalY = this.ball.y > goalTop && this.ball.y < goalBottom;

        // Left wall
        if (this.ball.x - this.ball.radius < C.FIELD_PADDING) {
            if (inGoalY) {
                // GOAL for right team!
                if (this.onGoal) this.onGoal('right');
                return;
            }
            this.ball.x = C.FIELD_PADDING + this.ball.radius;
            this.ball.vx *= -0.8;
        }

        // Right wall
        if (this.ball.x + this.ball.radius > C.FIELD_WIDTH - C.FIELD_PADDING) {
            if (inGoalY) {
                // GOAL for left team!
                if (this.onGoal) this.onGoal('left');
                return;
            }
            this.ball.x = C.FIELD_WIDTH - C.FIELD_PADDING - this.ball.radius;
            this.ball.vx *= -0.8;
        }

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

        // Send state
        if (this.onUpdate) {
            this.onUpdate(this.getState());
        }
    }

    performShot(player) {
        const dx = this.ball.x - player.x;
        const dy = this.ball.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > C.SHOT_RANGE + player.radius + this.ball.radius) return;

        const power = Math.min(
            C.SHOT_MIN_POWER + player.shootHoldTime * C.SHOT_CHARGE_RATE,
            C.SHOT_MAX_POWER
        );

        const nx = dx / dist;
        const ny = dy / dist;

        this.ball.vx += nx * power;
        this.ball.vy += ny * power;
    }

    handleGoalPostCollisions() {
        const goalTop = C.FIELD_HEIGHT / 2 - C.GOAL_HEIGHT / 2;
        const goalBottom = C.FIELD_HEIGHT / 2 + C.GOAL_HEIGHT / 2;

        // 4 goal posts (corners of both goals)
        const posts = [
            { x: C.FIELD_PADDING, y: goalTop },
            { x: C.FIELD_PADDING, y: goalBottom },
            { x: C.FIELD_WIDTH - C.FIELD_PADDING, y: goalTop },
            { x: C.FIELD_WIDTH - C.FIELD_PADDING, y: goalBottom }
        ];

        const postRadius = 4;

        for (const post of posts) {
            const dx = this.ball.x - post.x;
            const dy = this.ball.y - post.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = this.ball.radius + postRadius;

            if (dist < minDist && dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;
                this.ball.x += nx * overlap;
                this.ball.y += ny * overlap;

                const dot = this.ball.vx * nx + this.ball.vy * ny;
                this.ball.vx -= 2 * dot * nx * 0.8;
                this.ball.vy -= 2 * dot * ny * 0.8;
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

            // Separate
            const overlap = minDist - dist;
            if (isBallCollision) {
                b.x += nx * overlap;
                b.y += ny * overlap;
            } else {
                a.x -= nx * overlap * 0.5;
                a.y -= ny * overlap * 0.5;
                b.x += nx * overlap * 0.5;
                b.y += ny * overlap * 0.5;
            }

            // Elastic collision
            const massA = isBallCollision ? C.PLAYER_MASS : C.PLAYER_MASS;
            const massB = isBallCollision ? C.BALL_MASS : C.PLAYER_MASS;

            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvDotN = dvx * nx + dvy * ny;

            if (dvDotN > 0) {
                const j = (2 * dvDotN) / (massA + massB);
                a.vx -= j * massB * nx * 0.9;
                a.vy -= j * massB * ny * 0.9;
                b.vx += j * massA * nx * 0.9;
                b.vy += j * massA * ny * 0.9;
            }
        }
    }

    resetBall() {
        this.ball.x = C.FIELD_WIDTH / 2;
        this.ball.y = C.FIELD_HEIGHT / 2;
        this.ball.vx = 0;
        this.ball.vy = 0;
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
                shootHoldTime: p.shootHoldTime
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
