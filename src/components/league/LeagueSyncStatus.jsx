import { Cloud, CloudOff, LoaderCircle, Radio, TriangleAlert } from 'lucide-react'

const statusContent = {
  error: { icon: TriangleAlert, label: 'Sync error' },
  live: { icon: Radio, label: 'Live cloud sync' },
  loading: { icon: LoaderCircle, label: 'Loading live data' },
  local: { icon: CloudOff, label: 'Local preview mode' },
  saving: { icon: Cloud, label: 'Publishing update' },
}

function LeagueSyncStatus({ status }) {
  const content = statusContent[status] || statusContent.local
  const Icon = content.icon

  return (
    <span className={`league-sync-status league-sync-status--${status}`}>
      <Icon className={status === 'loading' || status === 'saving' ? 'spin' : ''} size={15} />
      {content.label}
    </span>
  )
}

export default LeagueSyncStatus
