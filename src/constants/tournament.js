export const STORAGE_KEY = 'efootball-world-cup-state-v1'
export const TEAM_COUNT = 4
export const TROPHY_SRC = `${import.meta.env.BASE_URL}efootball-cup.png`

export const TEAM_IDS = Array.from({ length: TEAM_COUNT }, (_, index) => `team-${index + 1}`)

export const GROUP_MATCHES = TEAM_IDS.flatMap((homeId, homeIndex) =>
  TEAM_IDS.slice(homeIndex + 1).map((awayId) => ({
    id: `${homeId}-${awayId}`,
    homeId,
    awayId,
  })),
)
