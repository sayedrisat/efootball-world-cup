import TeamLogo from './TeamLogo'
import TeamStars from './TeamStars'

function TeamSetup({ teams, onTeamChange, onIconUpload, onClearIcon }) {
  return (
    <section className="panel team-setup">
      <div className="section-heading">
        <p>Team Setup</p>
        <span>{teams.filter((team) => team.name.trim()).length}/4 ready</span>
      </div>

      <div className="team-grid">
        {teams.map((team) => (
          <div className="team-editor" key={team.id}>
            <div className="team-editor__preview">
              <TeamLogo team={team} />
              <TeamStars team={team} />
            </div>
            <div className="team-editor__fields">
              <label>
                Team Name
                <input
                  type="text"
                  value={team.name}
                  placeholder={`Team ${team.seed}`}
                  onChange={(event) => onTeamChange(team.id, 'name', event.target.value)}
                />
              </label>

              <label>
                Icon URL
                <input
                  type="url"
                  value={team.icon.startsWith('data:') ? '' : team.icon}
                  placeholder="https://..."
                  onChange={(event) => onTeamChange(team.id, 'icon', event.target.value)}
                />
              </label>

              <div className="team-editor__actions">
                <label className="file-button">
                  Upload Icon
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => onIconUpload(team.id, event)}
                  />
                </label>
                <button type="button" onClick={() => onClearIcon(team.id)}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default TeamSetup
