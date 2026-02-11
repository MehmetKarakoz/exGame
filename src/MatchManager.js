// ============================================
// Match Manager – timer, scoring, match flow
// ============================================
const C = require('./Constants');

class MatchManager {
    constructor(room) {
        this.room = room;
        this.scoreLeft = 0;
        this.scoreRight = 0;
        this.duration = room.matchDuration || C.DEFAULT_MATCH_DURATION;
        this.timeRemaining = this.duration;
        this.state = 'waiting'; // waiting | countdown | playing | goalPause | finished
        this.timerId = null;
        this.onTimeUpdate = null;
        this.onMatchEnd = null;
        this.onCountdown = null;
        this.countdownValue = 3;
    }

    startCountdown(callback) {
        this.state = 'countdown';
        this.countdownValue = 3;

        const countdownTick = () => {
            if (this.onCountdown) this.onCountdown(this.countdownValue);

            if (this.countdownValue <= 0) {
                this.state = 'playing';
                if (callback) callback();
                this.startTimer();
                return;
            }

            this.countdownValue--;
            setTimeout(countdownTick, 1000);
        };

        countdownTick();
    }

    startTimer() {
        this.timerId = setInterval(() => {
            if (this.state !== 'playing') return;

            this.timeRemaining--;

            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.timeRemaining, this.scoreLeft, this.scoreRight);
            }

            if (this.timeRemaining <= 0) {
                this.endMatch();
            }
        }, 1000);
    }

    goal(team) {
        if (team === 'left') {
            this.scoreLeft++;
        } else {
            this.scoreRight++;
        }

        this.state = 'goalPause';

        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.timeRemaining, this.scoreLeft, this.scoreRight);
        }

        return {
            team,
            scoreLeft: this.scoreLeft,
            scoreRight: this.scoreRight
        };
    }

    resumeAfterGoal() {
        this.state = 'playing';
    }

    endMatch() {
        this.state = 'finished';
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }

        let winner = null;
        if (this.scoreLeft > this.scoreRight) winner = 'left';
        else if (this.scoreRight > this.scoreLeft) winner = 'right';
        else winner = 'draw';

        const result = {
            winner,
            scoreLeft: this.scoreLeft,
            scoreRight: this.scoreRight,
            duration: this.duration
        };

        if (this.onMatchEnd) this.onMatchEnd(result);
        return result;
    }

    getState() {
        return {
            scoreLeft: this.scoreLeft,
            scoreRight: this.scoreRight,
            timeRemaining: this.timeRemaining,
            duration: this.duration,
            state: this.state
        };
    }

    destroy() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }
}

module.exports = MatchManager;
