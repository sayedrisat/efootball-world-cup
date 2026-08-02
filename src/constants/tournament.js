export const STORAGE_KEY = 'efootball-world-cup-state-v1'
export const TEAM_COUNT = 6
export const TROPHY_SRC = `${import.meta.env.BASE_URL}efootball-cup.png`

export const TEAM_IDS = Array.from({ length: TEAM_COUNT }, (_, index) => `team-${index + 1}`)

export const GROUPS = [
  {
    id: 'A',
    name: 'Group A',
    teamIds: TEAM_IDS.slice(0, 3),
  },
  {
    id: 'B',
    name: 'Group B',
    teamIds: TEAM_IDS.slice(3, 6),
  },
]

export const GROUP_MATCHES = GROUPS.flatMap((group) =>
  group.teamIds.flatMap((homeId, homeIndex) =>
    group.teamIds.slice(homeIndex + 1).map((awayId) => ({
      id: `${group.id}-${homeId}-${awayId}`,
      groupId: group.id,
      homeId,
      awayId,
    })),
  ),
)
