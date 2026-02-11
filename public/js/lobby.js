// ============================================
// Lobby – room list, create room, tournaments
// ============================================
const Lobby = (() => {
    let rooms = [];
    let tournaments = [];

    function init() {
        document.getElementById('refresh-rooms-btn').addEventListener('click', () => {
            Network.send({ type: 'getRooms' });
        });

        document.getElementById('create-room-btn').addEventListener('click', createRoom);
        document.getElementById('create-tournament-btn').addEventListener('click', createTournament);
        document.getElementById('refresh-tournaments-btn').addEventListener('click', () => {
            Network.send({ type: 'getTournaments' });
        });

        Network.on('roomList', (msg) => {
            rooms = msg.rooms;
            renderRooms();
        });

        Network.on('tournamentList', (msg) => {
            tournaments = msg.tournaments;
            renderTournaments();
        });

        Network.on('roomJoined', (msg) => {
            Room.setRoom(msg.room);
            Main.showScreen('room');
        });

        Network.on('tournamentCreated', (msg) => {
            Main.showToast('Turnuva oluşturuldu!', 'success');
        });
    }

    function createRoom() {
        const name = document.getElementById('room-name-input').value.trim();
        const maxPlayers = parseInt(document.getElementById('room-max-players').value);
        const password = document.getElementById('room-password-input').value.trim();

        Network.send({
            type: 'createRoom',
            name: name || undefined,
            maxPlayers,
            password: password || undefined
        });
    }

    function createTournament() {
        const name = document.getElementById('tournament-name-input').value.trim();
        const teamCount = parseInt(document.getElementById('tournament-team-count').value);

        Network.send({
            type: 'createTournament',
            name: name || undefined,
            teamCount
        });
    }

    function renderRooms() {
        const container = document.getElementById('room-list');

        if (rooms.length === 0) {
            container.innerHTML = '<div class="empty-state">Henüz oda yok. İlk odayı oluştur!</div>';
            return;
        }

        container.innerHTML = rooms.map(room => `
      <div class="room-card" onclick="Lobby.joinRoom('${room.id}', ${room.hasPassword})">
        <div class="room-card-info">
          <div class="room-card-name">${escapeHtml(room.name)} ${room.hasPassword ? '🔒' : ''}</div>
          <div class="room-card-details">
            <span>👥 ${room.playerCount}/${room.maxPlayers}</span>
            <span>⚽ ${room.teamLeftCount} vs ${room.teamRightCount}</span>
          </div>
        </div>
        <span class="room-card-status ${room.state === 'waiting' ? 'status-waiting' : 'status-playing'}">
          ${room.state === 'waiting' ? 'Bekliyor' : 'Oyunda'}
        </span>
      </div>
    `).join('');
    }

    function renderTournaments() {
        const container = document.getElementById('tournament-list');

        if (tournaments.length === 0) {
            container.innerHTML = '<div class="empty-state">Aktif turnuva yok</div>';
            return;
        }

        container.innerHTML = tournaments.map(t => `
      <div class="room-card" onclick="Lobby.viewTournament('${t.id}')">
        <div class="room-card-info">
          <div class="room-card-name">🏆 ${escapeHtml(t.name)}</div>
          <div class="room-card-details">
            <span>👥 ${t.registeredTeams}/${t.teamCount} takım</span>
          </div>
        </div>
        <span class="room-card-status ${t.state === 'registration' ? 'status-waiting' : t.state === 'finished' ? 'status-playing' : 'status-playing'}">
          ${t.state === 'registration' ? 'Kayıt Açık' : t.state === 'inProgress' ? 'Devam Ediyor' : 'Tamamlandı'}
        </span>
      </div>
    `).join('');
    }

    function joinRoom(roomId, hasPassword) {
        if (hasPassword) {
            const password = prompt('Oda şifresini girin:');
            if (password === null) return;
            Network.send({ type: 'joinRoom', roomId, password });
        } else {
            Network.send({ type: 'joinRoom', roomId });
        }
    }

    function viewTournament(tournamentId) {
        Network.send({ type: 'getTournamentState', tournamentId });
        Network.on('tournamentState', function handler(msg) {
            Network.off('tournamentState', handler);
            if (msg.state) {
                Tournament.setState(msg.state);
                Main.showScreen('tournament');
            }
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return { init, joinRoom, viewTournament, renderRooms, renderTournaments };
})();
