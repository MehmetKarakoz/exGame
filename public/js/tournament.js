// ============================================
// Tournament – bracket display
// ============================================
const Tournament = (() => {
    let currentState = null;

    function init() {
        document.getElementById('leave-tournament-btn').addEventListener('click', () => {
            Main.showScreen('lobby');
        });

        Network.on('tournamentStarted', (msg) => {
            Network.send({ type: 'getTournamentState', tournamentId: msg.tournamentId });
        });

        Network.on('tournamentState', (msg) => {
            if (msg.state) {
                setState(msg.state);
            }
        });
    }

    function setState(state) {
        currentState = state;
        render();
    }

    function render() {
        if (!currentState) return;

        document.getElementById('tournament-title').textContent = `🏆 ${currentState.name}`;
        const container = document.getElementById('tournament-bracket');
        container.innerHTML = '';

        if (currentState.state === 'registration') {
            container.innerHTML = `
        <div style="text-align:center; padding:40px;">
          <h3 style="margin-bottom:16px;">Kayıt Açık</h3>
          <p style="color:var(--text-secondary); margin-bottom:16px;">
            ${currentState.teams.length} / ${currentState.teamCount} takım kayıtlı
          </p>
          <div style="display:flex; flex-direction:column; gap:8px; max-width:300px; margin:0 auto;">
            ${currentState.teams.map(t => `
              <div class="player-item">
                <span>${escapeHtml(t.name)}</span>
                <span style="font-size:11px; color:var(--text-muted);">${t.players.length} oyuncu</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
            return;
        }

        // Draw bracket
        const roundNames = getRoundNames(currentState.bracket.length);

        currentState.bracket.forEach((round, ri) => {
            const roundEl = document.createElement('div');
            roundEl.className = 'bracket-round';

            const titleEl = document.createElement('div');
            titleEl.className = 'bracket-round-title';
            titleEl.textContent = roundNames[ri] || `Tur ${ri + 1}`;
            roundEl.appendChild(titleEl);

            round.forEach(match => {
                const matchEl = document.createElement('div');
                matchEl.className = 'bracket-match';

                const teamAName = match.teamA ? match.teamA.name : '???';
                const teamBName = match.teamB ? match.teamB.name : '???';
                const isFinished = match.state === 'finished';

                matchEl.innerHTML = `
          <div class="bracket-team ${isFinished && match.winner && match.winner.name === teamAName ? 'winner' : ''}">
            <span>${escapeHtml(teamAName)}</span>
            ${isFinished ? `<span>${match.scoreA}</span>` : ''}
          </div>
          <div class="bracket-vs">VS</div>
          <div class="bracket-team ${isFinished && match.winner && match.winner.name === teamBName ? 'winner' : ''}">
            <span>${escapeHtml(teamBName)}</span>
            ${isFinished ? `<span>${match.scoreB}</span>` : ''}
          </div>
        `;

                roundEl.appendChild(matchEl);
            });

            container.appendChild(roundEl);
        });

        // Champion
        const champEl = document.getElementById('tournament-champion');
        if (currentState.champion) {
            champEl.style.display = 'block';
            document.getElementById('champion-name').textContent = currentState.champion.name;
        } else {
            champEl.style.display = 'none';
        }
    }

    function getRoundNames(totalRounds) {
        const names = [];
        for (let i = 0; i < totalRounds; i++) {
            const remaining = totalRounds - i;
            if (remaining === 1) names.push('Final');
            else if (remaining === 2) names.push('Yarı Final');
            else if (remaining === 3) names.push('Çeyrek Final');
            else names.push(`Tur ${i + 1}`);
        }
        return names;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return { init, setState };
})();
