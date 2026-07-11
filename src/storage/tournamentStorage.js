import { STORAGE_KEY } from '../constants/tournament'
import { createTournamentState, mergeSavedState } from '../utils/tournament'

export function readTournamentState() {
  try {
    return mergeSavedState(JSON.parse(localStorage.getItem(STORAGE_KEY)))
  } catch {
    return createTournamentState()
  }
}

export function saveTournamentState(tournament) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournament))
  } catch {
    // Uploaded icons can be large; scores still work even if the browser refuses storage.
  }
}
