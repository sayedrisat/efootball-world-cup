import LeagueSyncStatus from './LeagueSyncStatus'

function LeagueLiveStatusBar({ lastUpdated, status }) {
  return (
    <div className="league-live-bar">
      <LeagueSyncStatus status={status} />
      {lastUpdated && <span>Updated {new Date(lastUpdated).toLocaleString()}</span>}
    </div>
  )
}

export default LeagueLiveStatusBar
