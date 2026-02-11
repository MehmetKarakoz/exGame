// ============================================
// Game Constants
// ============================================

module.exports = {
  // Server
  PORT: process.env.PORT || 3000,
  TICK_RATE: 60,
  TICK_INTERVAL: 1000 / 60,

  // Field dimensions
  FIELD_WIDTH: 1200,
  FIELD_HEIGHT: 600,
  FIELD_PADDING: 40,

  // Goal
  GOAL_WIDTH: 12,
  GOAL_HEIGHT: 160,

  // Player
  PLAYER_RADIUS: 18,
  PLAYER_MAX_SPEED: 5,
  PLAYER_SPRINT_SPEED: 7.5, // 1.5x speed boost
  PLAYER_ACCELERATION: 0.6,
  PLAYER_FRICTION: 0.88,
  PLAYER_MASS: 1.0,

  // Stamina
  STAMINA_MAX: 100,
  STAMINA_DRAIN_RATE: 0.8, // per tick (approx 48/sec at 60Hz)
  STAMINA_REGEN_RATE: 0.3, // per tick
  STAMINA_MIN_TO_SPRINT: 20, // threshold to start sprinting again

  // Ball
  BALL_RADIUS: 10,
  BALL_FRICTION: 0.985,
  BALL_MAX_SPEED: 18,
  BALL_MASS: 0.3,

  // Shot
  SHOT_MIN_POWER: 5,
  SHOT_MAX_POWER: 18,
  SHOT_CHARGE_RATE: 12, // power per second of holding
  SHOT_RANGE: 35, // max distance from ball to shoot

  // Match
  MATCH_DURATIONS: [180, 300, 600], // 3, 5, 10 minutes in seconds
  DEFAULT_MATCH_DURATION: 300,
  GOAL_PAUSE_DURATION: 2000, // ms pause after goal
  COUNTDOWN_DURATION: 3000, // ms countdown before match start

  // Room
  MAX_PLAYERS_PER_ROOM: 10,
  MIN_PLAYERS_PER_ROOM: 2,
  BOT_REACTION_DELAY: 5, // Ticks (approx 80ms)
  BOT_ACCURACY: 0.95,

  // Team colors (defaults)
  TEAM_LEFT_DEFAULT: {
    jersey: '#3B82F6',
    shorts: '#1E40AF',
    number: '#FFFFFF',
    name: 'Mavi Takım'
  },
  TEAM_RIGHT_DEFAULT: {
    jersey: '#EF4444',
    shorts: '#991B1B',
    number: '#FFFFFF',
    name: 'Kırmızı Takım'
  },

  // Player starting positions
  getStartPositions(teamSide, playerCount) {
    const positions = [];
    const centerY = this.FIELD_HEIGHT / 2;
    const spacing = this.FIELD_HEIGHT / (playerCount + 1);

    for (let i = 0; i < playerCount; i++) {
      positions.push({
        x: teamSide === 'left'
          ? this.FIELD_PADDING + 100 + (i % 2) * 80
          : this.FIELD_WIDTH - this.FIELD_PADDING - 100 - (i % 2) * 80,
        y: spacing * (i + 1)
      });
    }
    return positions;
  }
};
