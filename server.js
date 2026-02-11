// ============================================
// Main Server – Express + WebSocket
// ============================================
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const RoomManager = require('./src/RoomManager');
const GameEngine = require('./src/GameEngine');
const MatchManager = require('./src/MatchManager');
const TournamentManager = require('./src/TournamentManager');
const C = require('./src/Constants');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Managers
const roomManager = new RoomManager();
const tournamentManager = new TournamentManager();

// Connected players: ws -> playerData
const connectedPlayers = new Map();

// ---- WebSocket Handling ----
wss.on('connection', (ws) => {
    const playerId = uuidv4().slice(0, 12);
    const player = { id: playerId, username: null, ws, roomId: null };
    connectedPlayers.set(ws, player);

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            handleMessage(ws, player, msg);
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    ws.on('close', () => {
        handleDisconnect(player);
        connectedPlayers.delete(ws);
    });

    // Send player ID
    send(ws, { type: 'connected', playerId });
});

function send(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(roomId, data, excludeId) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    for (const [id, p] of room.players) {
        if (id !== excludeId && p.ws && p.ws.readyState === 1) {
            p.ws.send(JSON.stringify(data));
        }
    }
}

function broadcastAll(data) {
    for (const [ws, p] of connectedPlayers) {
        if (p.username && ws.readyState === 1) {
            ws.send(JSON.stringify(data));
        }
    }
}

// ---- Message Handler ----
function handleMessage(ws, player, msg) {
    switch (msg.type) {
        case 'login':
            handleLogin(ws, player, msg);
            break;
        case 'createRoom':
            handleCreateRoom(ws, player, msg);
            break;
        case 'joinRoom':
            handleJoinRoom(ws, player, msg);
            break;
        case 'leaveRoom':
            handleLeaveRoom(ws, player, msg);
            break;
        case 'joinTeam':
            handleJoinTeam(ws, player, msg);
            break;
        case 'kickPlayer':
            handleKickPlayer(ws, player, msg);
            break;
        case 'setTeamColors':
            handleSetTeamColors(ws, player, msg);
            break;
        case 'setMatchDuration':
            handleSetMatchDuration(ws, player, msg);
            break;
        case 'startMatch':
            handleStartMatch(ws, player, msg);
            break;
        case 'input':
            handleInput(ws, player, msg);
            break;
        case 'getRooms':
            send(ws, { type: 'roomList', rooms: roomManager.listRooms() });
            break;
        case 'createTournament':
            handleCreateTournament(ws, player, msg);
            break;
        case 'registerTournamentTeam':
            handleRegisterTournamentTeam(ws, player, msg);
            break;
        case 'startTournament':
            handleStartTournament(ws, player, msg);
            break;
        case 'getTournaments':
            send(ws, { type: 'tournamentList', tournaments: tournamentManager.listTournaments() });
            break;
        case 'getTournamentState':
            const tState = tournamentManager.getTournamentState(msg.tournamentId);
            send(ws, { type: 'tournamentState', state: tState });
            break;
        case 'chat':
            handleChat(ws, player, msg);
            break;
        case 'addBot':
            handleAddBot(ws, player, msg);
            break;
        case 'removeBot':
            handleRemoveBot(ws, player, msg);
            break;
    }
}

// ---- Handlers ----
function handleLogin(ws, player, msg) {
    if (!msg.username || msg.username.trim().length < 1) {
        send(ws, { type: 'error', message: 'Kullanıcı adı gerekli' });
        return;
    }
    player.username = msg.username.trim().slice(0, 16);
    send(ws, { type: 'loginSuccess', playerId: player.id, username: player.username });
    send(ws, { type: 'roomList', rooms: roomManager.listRooms() });
    send(ws, { type: 'tournamentList', tournaments: tournamentManager.listTournaments() });
}

function handleCreateRoom(ws, player, msg) {
    const room = roomManager.createRoom(
        msg.name || `${player.username}'in Odası`,
        msg.maxPlayers || 10,
        msg.password || null,
        player
    );
    player.roomId = room.id;
    send(ws, { type: 'roomJoined', room: roomManager.getRoomState(room.id) });
    broadcastAll({ type: 'roomList', rooms: roomManager.listRooms() });
}

function handleJoinRoom(ws, player, msg) {
    const result = roomManager.joinRoom(msg.roomId, player, msg.password);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    player.roomId = msg.roomId;
    send(ws, { type: 'roomJoined', room: roomManager.getRoomState(msg.roomId) });
    broadcast(msg.roomId, { type: 'roomUpdate', room: roomManager.getRoomState(msg.roomId) }, player.id);
    broadcastAll({ type: 'roomList', rooms: roomManager.listRooms() });
}

function handleLeaveRoom(ws, player, msg) {
    if (!player.roomId) return;
    const roomId = player.roomId;
    const room = roomManager.getRoom(roomId);

    // Stop game if running
    if (room && room.gameEngine) {
        room.gameEngine.stop();
        room.gameEngine = null;
    }
    if (room && room.matchManager) {
        room.matchManager.destroy();
        room.matchManager = null;
    }

    const result = roomManager.leaveRoom(roomId, player.id);
    player.roomId = null;
    send(ws, { type: 'leftRoom' });

    if (!result.deleted) {
        broadcast(roomId, { type: 'roomUpdate', room: roomManager.getRoomState(roomId) });
        if (result.newOwnerId) {
            broadcast(roomId, { type: 'newOwner', ownerId: result.newOwnerId });
        }
    }
    broadcastAll({ type: 'roomList', rooms: roomManager.listRooms() });
}

function handleJoinTeam(ws, player, msg) {
    const result = roomManager.joinTeam(player.roomId, player.id, msg.team);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    broadcast(player.roomId, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
    send(ws, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
}

function handleKickPlayer(ws, player, msg) {
    const result = roomManager.kickPlayer(player.roomId, player.id, msg.targetId);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }

    // Notify kicked player
    const room = roomManager.getRoom(player.roomId);
    if (room) {
        for (const [pid, p] of room.players) {
            if (pid === msg.targetId && p.ws) {
                send(p.ws, { type: 'kicked' });
                p.roomId = null;
                break;
            }
        }
    }

    // find kicked player in connectedPlayers
    for (const [ws2, p2] of connectedPlayers) {
        if (p2.id === msg.targetId) {
            send(ws2, { type: 'kicked' });
            p2.roomId = null;
            break;
        }
    }

    broadcast(player.roomId, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
}

function handleSetTeamColors(ws, player, msg) {
    const result = roomManager.setTeamColors(player.roomId, player.id, msg.team, msg.colors);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    broadcast(player.roomId, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
    send(ws, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
}

function handleSetMatchDuration(ws, player, msg) {
    const result = roomManager.setMatchDuration(player.roomId, player.id, msg.duration);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    broadcast(player.roomId, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
    send(ws, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
}

function handleStartMatch(ws, player, msg) {
    const room = roomManager.getRoom(player.roomId);
    if (!room) return;
    if (room.ownerId !== player.id) {
        send(ws, { type: 'error', message: 'Yetkiniz yok' });
        return;
    }
    if (room.teamLeft.players.length === 0 || room.teamRight.players.length === 0) {
        send(ws, { type: 'error', message: 'Her iki takımda da en az bir oyuncu olmalı' });
        return;
    }

    // Create engine & match manager
    room.state = 'playing';
    const engine = new GameEngine(room);
    engine.init();
    room.gameEngine = engine;

    const match = new MatchManager(room);
    room.matchManager = match;

    // Goal handler
    engine.onGoal = (scoringTeam) => {
        engine.pause();
        const goalResult = match.goal(scoringTeam);

        broadcast(room.id, {
            type: 'goal',
            team: scoringTeam,
            scoreLeft: goalResult.scoreLeft,
            scoreRight: goalResult.scoreRight
        });

        // Reset positions after pause
        setTimeout(() => {
            engine.resetPositions();
            match.resumeAfterGoal();
            engine.resume();
            broadcast(room.id, { type: 'goalResume' });
        }, C.GOAL_PAUSE_DURATION);
    };

    // Game state broadcast
    engine.onUpdate = (state) => {
        broadcast(room.id, {
            type: 'gameState',
            ...state,
            match: match.getState()
        });
    };

    // Match time update
    match.onTimeUpdate = (timeRemaining, scoreLeft, scoreRight) => {
        // Already included in gameState
    };

    // Match end
    match.onMatchEnd = (result) => {
        engine.stop();
        room.gameEngine = null;
        room.matchManager = null;
        room.state = 'waiting';

        broadcast(room.id, {
            type: 'matchEnd',
            result,
            room: roomManager.getRoomState(room.id)
        });

        // If tournament match, report result
        if (room.tournamentId && room.tournamentMatchId) {
            const winnerTeam = result.winner === 'left' ? room.teamLeft : room.teamRight;
            tournamentManager.reportMatchResult(
                room.tournamentId,
                room.tournamentMatchId,
                winnerTeam,
                result.scoreLeft,
                result.scoreRight
            );
        }
    };

    // Countdown then start
    broadcast(room.id, { type: 'matchStarting' });

    match.startCountdown((countdownVal) => {
        broadcast(room.id, { type: 'countdown', value: countdownVal });
    });

    match.onCountdown = (val) => {
        broadcast(room.id, { type: 'countdown', value: val });
        if (val <= 0) {
            engine.start();
        }
    };
}

function handleInput(ws, player, msg) {
    if (!player.roomId) return;
    const room = roomManager.getRoom(player.roomId);
    if (!room || !room.gameEngine) return;
    room.gameEngine.setInput(player.id, msg.input);
}

function handleChat(ws, player, msg) {
    if (!player.roomId || !msg.text) return;
    broadcast(player.roomId, {
        type: 'chat',
        playerId: player.id,
        username: player.username,
        text: msg.text.slice(0, 200)
    });
}

function handleCreateTournament(ws, player, msg) {
    const result = tournamentManager.createTournament(
        msg.name || `${player.username} Turnuvası`,
        player.id,
        msg.teamCount || 4
    );
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    send(ws, { type: 'tournamentCreated', tournament: result.tournament });
    broadcastAll({ type: 'tournamentList', tournaments: tournamentManager.listTournaments() });
}

function handleRegisterTournamentTeam(ws, player, msg) {
    const result = tournamentManager.registerTeam(msg.tournamentId, msg.teamName, msg.players || [player.id]);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    send(ws, { type: 'teamRegistered', team: result.team });
    broadcastAll({ type: 'tournamentList', tournaments: tournamentManager.listTournaments() });
}

function handleStartTournament(ws, player, msg) {
    const result = tournamentManager.startTournament(msg.tournamentId, player.id);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    broadcastAll({
        type: 'tournamentStarted',
        tournamentId: msg.tournamentId,
        bracket: result.bracket
    });
}

function handleAddBot(ws, player, msg) {
    const result = roomManager.addBot(player.roomId, player.id);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    broadcast(player.roomId, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
}

function handleRemoveBot(ws, player, msg) {
    const result = roomManager.removeBot(player.roomId, player.id, msg.botId);
    if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
    }
    broadcast(player.roomId, { type: 'roomUpdate', room: roomManager.getRoomState(player.roomId) });
}

// ---- Disconnect ----
function handleDisconnect(player) {
    if (player.roomId) {
        const roomId = player.roomId;
        const room = roomManager.getRoom(roomId);

        if (room && room.gameEngine) {
            // Remove player from engine if in game
            if (room.gameEngine.players[player.id]) {
                delete room.gameEngine.players[player.id];
            }
        }

        const result = roomManager.leaveRoom(roomId, player.id);

        if (!result.deleted) {
            broadcast(roomId, { type: 'roomUpdate', room: roomManager.getRoomState(roomId) });
            if (result.newOwnerId) {
                broadcast(roomId, { type: 'newOwner', ownerId: result.newOwnerId });
            }

            // If no more players on either team during a match, end it
            if (room && room.gameEngine) {
                const leftCount = room.teamLeft.players.filter(pid => room.players.has(pid)).length;
                const rightCount = room.teamRight.players.filter(pid => room.players.has(pid)).length;

                if (leftCount === 0 || rightCount === 0) {
                    room.gameEngine.stop();
                    room.gameEngine = null;
                    if (room.matchManager) {
                        room.matchManager.destroy();
                        room.matchManager = null;
                    }
                    room.state = 'waiting';
                    broadcast(roomId, {
                        type: 'matchEnd',
                        result: { winner: leftCount === 0 ? 'right' : 'left', scoreLeft: 0, scoreRight: 0, forfeit: true },
                        room: roomManager.getRoomState(roomId)
                    });
                }
            }
        }
        broadcastAll({ type: 'roomList', rooms: roomManager.listRooms() });
    }
}

// ---- Start Server ----
server.listen(C.PORT, () => {
    console.log(`⚽ Futbol Online sunucusu çalışıyor: http://localhost:${C.PORT}`);
});
