// ============================================
// Room – team selection, settings, chat
// ============================================
const Room = (() => {
    let currentRoom = null;

    function init() {
        // Team buttons
        document.querySelectorAll('.btn-team').forEach(btn => {
            btn.addEventListener('click', () => {
                const team = btn.dataset.team;
                Network.send({ type: 'joinTeam', team });
            });
        });

        // Leave room
        document.getElementById('leave-room-btn').addEventListener('click', () => {
            Network.send({ type: 'leaveRoom' });
        });

        // Start match
        document.getElementById('start-match-btn').addEventListener('click', () => {
            Network.send({ type: 'startMatch' });
        });

        // Add Bot
        document.getElementById('add-bot-btn').addEventListener('click', () => {
            Network.send({ type: 'addBot' });
        });

        // Match duration
        document.getElementById('match-duration-select').addEventListener('change', (e) => {
            Network.send({ type: 'setMatchDuration', duration: parseInt(e.target.value) });
        });

        // Team color pickers
        ['left', 'right'].forEach(side => {
            ['jersey', 'shorts'].forEach(part => {
                const id = `color-${side}-${part}`;
                document.getElementById(id).addEventListener('change', (e) => {
                    Network.send({
                        type: 'setTeamColors',
                        team: side,
                        colors: { [part]: e.target.value }
                    });
                });
            });
        });

        // Chat
        document.getElementById('chat-send-btn').addEventListener('click', sendChat);
        document.getElementById('chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChat();
        });

        // Network handlers
        Network.on('roomUpdate', (msg) => {
            setRoom(msg.room);
        });

        Network.on('leftRoom', () => {
            currentRoom = null;
            Main.showScreen('lobby');
            Network.send({ type: 'getRooms' });
        });

        Network.on('kicked', () => {
            currentRoom = null;
            Main.showScreen('lobby');
            Main.showToast('Odadan atıldınız!', 'error');
            Network.send({ type: 'getRooms' });
        });

        Network.on('newOwner', (msg) => {
            if (currentRoom) {
                currentRoom.ownerId = msg.ownerId;
                renderRoom();
            }
        });

        Network.on('matchStarting', () => {
            Game.init(currentRoom);
            Main.showScreen('game');
        });

        Network.on('matchEnd', (msg) => {
            Game.showMatchEnd(msg.result);
        });

        Network.on('chat', (msg) => {
            addChatMessage(msg.username, msg.text);
        });
    }

    function setRoom(room) {
        currentRoom = room;
        renderRoom();
    }

    function renderRoom() {
        if (!currentRoom) return;

        const myId = Network.getPlayerId();
        const isOwner = currentRoom.ownerId === myId;

        document.getElementById('room-title').textContent = currentRoom.name;
        document.getElementById('room-owner-controls').style.display = isOwner ? 'flex' : 'none';
        document.getElementById('room-settings').style.display = isOwner ? 'block' : 'none';

        // Teams
        renderTeam('left', currentRoom.teamLeft, isOwner, myId);
        renderTeam('right', currentRoom.teamRight, isOwner, myId);

        // Spectators
        const specList = document.getElementById('spectator-list');
        specList.innerHTML = currentRoom.spectators.map(pid => {
            const p = currentRoom.players[pid];
            if (!p) return '';

            const kickBtn = isOwner && pid !== myId
                ? (p.isBot
                    ? `<button class="kick-btn" onclick="Room.removeBot('${pid}')">Kaldır</button>`
                    : `<button class="kick-btn" onclick="Room.kickPlayer('${pid}')">At</button>`)
                : '';

            const moveBtns = isOwner
                ? `<div class="move-btns">
                    <button class="btn-tiny" onclick="Room.movePlayer('${pid}', 'left')" title="Sol Takım">L</button>
                    <button class="btn-tiny" onclick="Room.movePlayer('${pid}', 'right')" title="Sağ Takım">R</button>
                   </div>`
                : '';

            return `
                <div class="player-item spectator-item">
                  <div class="player-info" style="flex:1; display:flex; align-items:center; gap:5px;">
                     <span>${escapeHtml(p.username)}</span>
                     ${pid === currentRoom.ownerId ? '<span style="font-size:11px;">👑</span>' : ''}
                  </div>
                  ${moveBtns}
                  ${kickBtn}
                </div>
            `;
        }).join('');

        // Colors
        document.getElementById('team-left-color').style.background = currentRoom.teamLeft.jersey;
        document.getElementById('team-right-color').style.background = currentRoom.teamRight.jersey;
        document.getElementById('team-left-name').textContent = currentRoom.teamLeft.name;
        document.getElementById('team-right-name').textContent = currentRoom.teamRight.name;
        document.getElementById('team-left-count').textContent = currentRoom.teamLeft.players.length;
        document.getElementById('team-right-count').textContent = currentRoom.teamRight.players.length;

        // Color pickers
        document.getElementById('color-left-jersey').value = currentRoom.teamLeft.jersey;
        document.getElementById('color-left-shorts').value = currentRoom.teamLeft.shorts;
        document.getElementById('color-right-jersey').value = currentRoom.teamRight.jersey;
        document.getElementById('color-right-shorts').value = currentRoom.teamRight.shorts;

        // Match duration
        document.getElementById('match-duration-select').value = currentRoom.matchDuration;
    }

    function renderTeam(side, team, isOwner, myId) {
        const container = document.getElementById(`team-${side}-players`);
        container.innerHTML = team.players.map((pid, i) => {
            const p = currentRoom.players[pid];
            if (!p) return '';
            const kickBtn = isOwner && pid !== myId
                ? (p.isBot
                    ? `<button class="kick-btn" onclick="Room.removeBot('${pid}')">Kaldır</button>`
                    : `<button class="kick-btn" onclick="Room.kickPlayer('${pid}')">At</button>`)
                : '';
            const moveBtns = isOwner
                ? `<div class="move-btns">
                    <button class="btn-tiny" onclick="Room.movePlayer('${pid}', 'left')" title="Sol Takım">L</button>
                    <button class="btn-tiny" onclick="Room.movePlayer('${pid}', 'spectator')" title="İzle">S</button>
                    <button class="btn-tiny" onclick="Room.movePlayer('${pid}', 'right')" title="Sağ Takım">R</button>
                   </div>`
                : '';

            return `
        <div class="player-item">
          <span class="player-number" style="background:${team.jersey};color:${team.number};">${i + 1}</span>
          <div class="player-info" style="flex:1; display:flex; align-items:center; gap:5px; margin-left:5px;">
             <span>${escapeHtml(p.username)}</span>
             ${pid === currentRoom.ownerId ? '<span style="font-size:11px;">👑</span>' : ''}
          </div>
          ${moveBtns}
          ${kickBtn}
        </div>
      `;
        }).join('');
    }

    function kickPlayer(targetId) {
        Network.send({ type: 'kickPlayer', targetId });
    }

    function removeBot(botId) {
        Network.send({ type: 'removeBot', botId });
    }

    function movePlayer(targetId, team) {
        Network.send({ type: 'movePlayer', targetId, team });
    }

    function sendChat() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;
        Network.send({ type: 'chat', text });
        input.value = '';
    }

    function addChatMessage(username, text) {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<span class="chat-username" style="color:var(--accent-blue);">${escapeHtml(username)}:</span>${escapeHtml(text)}`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function getRoom() {
        return currentRoom;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return { init, setRoom, getRoom, kickPlayer, removeBot, movePlayer };
})();
