// ============================================
// Tournament Manager – bracket / elimination
// ============================================
const { v4: uuidv4 } = require('uuid');

class TournamentManager {
    constructor() {
        this.tournaments = new Map();
    }

    createTournament(name, ownerId, teamCount) {
        // teamCount must be power of 2: 4, 8
        const validCounts = [4, 8];
        if (!validCounts.includes(teamCount)) {
            return { error: 'Takım sayısı 4 veya 8 olmalıdır' };
        }

        const id = uuidv4().slice(0, 8);
        const tournament = {
            id,
            name,
            ownerId,
            teamCount,
            teams: [],
            bracket: [],
            currentRound: 0,
            state: 'registration', // registration | inProgress | finished
            champion: null
        };

        this.tournaments.set(id, tournament);
        return { success: true, tournament };
    }

    registerTeam(tournamentId, teamName, players) {
        const t = this.tournaments.get(tournamentId);
        if (!t) return { error: 'Turnuva bulunamadı' };
        if (t.state !== 'registration') return { error: 'Kayıt süresi kapandı' };
        if (t.teams.length >= t.teamCount) return { error: 'Turnuva dolu' };

        const team = {
            id: uuidv4().slice(0, 8),
            name: teamName,
            players: players
        };

        t.teams.push(team);
        return { success: true, team };
    }

    startTournament(tournamentId, requesterId) {
        const t = this.tournaments.get(tournamentId);
        if (!t) return { error: 'Turnuva bulunamadı' };
        if (t.ownerId !== requesterId) return { error: 'Yetkiniz yok' };
        if (t.teams.length < t.teamCount) return { error: `En az ${t.teamCount} takım gerekli` };

        t.state = 'inProgress';
        t.bracket = this.generateBracket(t.teams);
        t.currentRound = 0;

        return { success: true, bracket: t.bracket };
    }

    generateBracket(teams) {
        // Shuffle teams
        const shuffled = [...teams].sort(() => Math.random() - 0.5);
        const rounds = [];
        let currentTeams = shuffled;

        while (currentTeams.length > 1) {
            const matches = [];
            for (let i = 0; i < currentTeams.length; i += 2) {
                matches.push({
                    id: uuidv4().slice(0, 8),
                    teamA: currentTeams[i],
                    teamB: currentTeams[i + 1],
                    winner: null,
                    scoreA: 0,
                    scoreB: 0,
                    roomId: null,
                    state: 'pending' // pending | playing | finished
                });
            }
            rounds.push(matches);
            currentTeams = matches.map(() => null); // placeholder for next round
        }

        return rounds;
    }

    getCurrentMatches(tournamentId) {
        const t = this.tournaments.get(tournamentId);
        if (!t || t.state !== 'inProgress') return [];
        return t.bracket[t.currentRound] || [];
    }

    reportMatchResult(tournamentId, matchId, winner, scoreA, scoreB) {
        const t = this.tournaments.get(tournamentId);
        if (!t) return { error: 'Turnuva bulunamadı' };

        const round = t.bracket[t.currentRound];
        if (!round) return { error: 'Geçersiz tur' };

        const match = round.find(m => m.id === matchId);
        if (!match) return { error: 'Maç bulunamadı' };

        match.winner = winner;
        match.scoreA = scoreA;
        match.scoreB = scoreB;
        match.state = 'finished';

        // Check if all matches in round are finished
        const allFinished = round.every(m => m.state === 'finished');

        if (allFinished) {
            const winners = round.map(m => m.winner);
            t.currentRound++;

            if (t.currentRound < t.bracket.length) {
                // Populate next round
                const nextRound = t.bracket[t.currentRound];
                winners.forEach((w, i) => {
                    const matchIndex = Math.floor(i / 2);
                    if (nextRound[matchIndex]) {
                        if (i % 2 === 0) nextRound[matchIndex].teamA = w;
                        else nextRound[matchIndex].teamB = w;
                    }
                });
            } else {
                // Tournament finished
                t.state = 'finished';
                t.champion = winners[0];
            }
        }

        return { success: true, allFinished, champion: t.champion };
    }

    listTournaments() {
        const list = [];
        for (const [id, t] of this.tournaments) {
            list.push({
                id,
                name: t.name,
                teamCount: t.teamCount,
                registeredTeams: t.teams.length,
                state: t.state,
                champion: t.champion ? t.champion.name : null
            });
        }
        return list;
    }

    getTournamentState(tournamentId) {
        const t = this.tournaments.get(tournamentId);
        if (!t) return null;
        return {
            id: t.id,
            name: t.name,
            teamCount: t.teamCount,
            teams: t.teams,
            bracket: t.bracket,
            currentRound: t.currentRound,
            state: t.state,
            champion: t.champion
        };
    }
}

module.exports = TournamentManager;
