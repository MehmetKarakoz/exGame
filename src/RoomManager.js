// ============================================
// Room Manager – handles rooms, players, teams
// ============================================
const { v4: uuidv4 } = require('uuid');
const C = require('./Constants');

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(name, maxPlayers, password, owner) {
        const id = uuidv4().slice(0, 8);
        const room = {
            id,
            name,
            maxPlayers: Math.min(maxPlayers || 10, C.MAX_PLAYERS_PER_ROOM),
            password: password || null,
            ownerId: owner.id,
            players: new Map(),
            teamLeft: { ...C.TEAM_LEFT_DEFAULT, players: [] },
            teamRight: { ...C.TEAM_RIGHT_DEFAULT, players: [] },
            spectators: [],
            matchDuration: C.DEFAULT_MATCH_DURATION,
            state: 'waiting', // waiting | playing | paused | finished
            gameEngine: null,
            matchManager: null,
            tournamentId: null
        };
        room.players.set(owner.id, owner);
        room.spectators.push(owner.id);
        this.rooms.set(id, room);
        return room;
    }

    joinRoom(roomId, player, password) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Oda bulunamadı' };
        if (room.password && room.password !== password) return { error: 'Yanlış şifre' };
        if (room.players.size >= room.maxPlayers) return { error: 'Oda dolu' };
        if (room.state === 'playing') return { error: 'Maç devam ediyor' };

        room.players.set(player.id, player);
        room.spectators.push(player.id);
        return { success: true, room };
    }

    leaveRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.players.delete(playerId);
        room.teamLeft.players = room.teamLeft.players.filter(id => id !== playerId);
        room.teamRight.players = room.teamRight.players.filter(id => id !== playerId);
        room.spectators = room.spectators.filter(id => id !== playerId);

        // Transfer ownership or delete room
        if (room.players.size === 0) {
            this.rooms.delete(roomId);
            return { deleted: true };
        }

        if (room.ownerId === playerId) {
            const newOwner = room.players.keys().next().value;
            room.ownerId = newOwner;
            return { newOwnerId: newOwner };
        }

        return {};
    }

    kickPlayer(roomId, requesterId, targetId) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Oda bulunamadı' };
        if (room.ownerId !== requesterId) return { error: 'Yetkiniz yok' };
        if (targetId === requesterId) return { error: 'Kendinizi atamazsınız' };

        room.players.delete(targetId);
        room.teamLeft.players = room.teamLeft.players.filter(id => id !== targetId);
        room.teamRight.players = room.teamRight.players.filter(id => id !== targetId);
        room.spectators = room.spectators.filter(id => id !== targetId);

        return { success: true };
    }

    joinTeam(roomId, requesterId, playerId, team) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Oda bulunamadı' };
        if (room.state === 'playing') return { error: 'Maç devam ediyor, takım değiştiremezsiniz' };

        // Allow if it's the player themselves OR if the requester is the room owner
        if (requesterId !== playerId && room.ownerId !== requesterId) {
            return { error: 'Yetkiniz yok' };
        }

        // Remove from current team/spectators
        room.teamLeft.players = room.teamLeft.players.filter(id => id !== playerId);
        room.teamRight.players = room.teamRight.players.filter(id => id !== playerId);
        room.spectators = room.spectators.filter(id => id !== playerId);

        if (team === 'left') {
            room.teamLeft.players.push(playerId);
        } else if (team === 'right') {
            room.teamRight.players.push(playerId);
        } else {
            room.spectators.push(playerId);
        }

        return { success: true };
    }

    setTeamColors(roomId, requesterId, team, colors) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Oda bulunamadı' };
        if (room.ownerId !== requesterId) return { error: 'Yetkiniz yok' };

        const t = team === 'left' ? room.teamLeft : room.teamRight;
        if (colors.jersey) t.jersey = colors.jersey;
        if (colors.shorts) t.shorts = colors.shorts;
        if (colors.number) t.number = colors.number;
        if (colors.name) t.name = colors.name;

        return { success: true };
    }

    setMatchDuration(roomId, requesterId, duration) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Oda bulunamadı' };
        if (room.ownerId !== requesterId) return { error: 'Yetkiniz yok' };
        if (!C.MATCH_DURATIONS.includes(duration)) return { error: 'Geçersiz süre' };

        room.matchDuration = duration;
        return { success: true };
    }

    listRooms() {
        const list = [];
        for (const [id, room] of this.rooms) {
            if (!room.tournamentId) {
                list.push({
                    id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    hasPassword: !!room.password,
                    state: room.state,
                    teamLeftCount: room.teamLeft.players.length,
                    teamRightCount: room.teamRight.players.length
                });
            }
        }
        return list;
    }

    getRoomState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const players = {};
        for (const [id, p] of room.players) {
            players[id] = { id: p.id, username: p.username, isBot: !!p.isBot };
        }

        return {
            id: room.id,
            name: room.name,
            maxPlayers: room.maxPlayers,
            hasPassword: !!room.password,
            ownerId: room.ownerId,
            players,
            teamLeft: {
                ...room.teamLeft,
                players: room.teamLeft.players
            },
            teamRight: {
                ...room.teamRight,
                players: room.teamRight.players
            },
            spectators: room.spectators,
            matchDuration: room.matchDuration,
            state: room.state
        };
    }

    addBot(roomId, requesterId) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Oda bulunamadı' };
        if (room.ownerId !== requesterId) return { error: 'Yetkiniz yok' };
        if (room.players.size >= room.maxPlayers) return { error: 'Oda dolu' };

        const botId = `bot-${uuidv4().slice(0, 4)}`;
        const bot = {
            id: botId,
            username: `Bot ${room.players.size}`,
            isBot: true,
            ws: null,
            roomId: roomId
        };

        room.players.set(botId, bot);
        room.spectators.push(botId);
        return { success: true, botId };
    }

    removeBot(roomId, requesterId, botId) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Oda bulunamadı' };
        if (room.ownerId !== requesterId) return { error: 'Yetkiniz yok' };

        room.players.delete(botId);
        room.teamLeft.players = room.teamLeft.players.filter(id => id !== botId);
        room.teamRight.players = room.teamRight.players.filter(id => id !== botId);
        room.spectators = room.spectators.filter(id => id !== botId);

        return { success: true };
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
}

module.exports = RoomManager;
