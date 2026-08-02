import { ImagePlus, Plus, Upload } from 'lucide-react'
import { useState } from 'react'

function LeagueTeamForm({ onAddTeam }) {
  const [image, setImage] = useState('')
  const [name, setName] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!name.trim()) return

    onAddTeam({ image, name })
    setImage('')
    setName('')
  }

  const handleUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result || ''))
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <section className="league-card league-team-form">
      <div className="league-section-title">
        <div>
          <span>Squad Builder</span>
          <h2>Add Unlimited Teams</h2>
        </div>
        <ImagePlus size={22} />
      </div>

      <form className="league-add-form" onSubmit={handleSubmit}>
        <label>
          Team Name
          <input
            type="text"
            value={name}
            placeholder="Brazil Legends"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label>
          Image URL
          <input
            type="url"
            value={image.startsWith('data:') ? '' : image}
            placeholder="https://..."
            onChange={(event) => setImage(event.target.value)}
          />
        </label>

        <div className="league-add-actions">
          <label className="league-upload-button">
            <Upload size={16} />
            Upload Image
            <input type="file" accept="image/*" onChange={handleUpload} />
          </label>

          <button className="league-primary-action" type="submit">
            <Plus size={17} />
            Add Team
          </button>
        </div>
      </form>
    </section>
  )
}

export default LeagueTeamForm
