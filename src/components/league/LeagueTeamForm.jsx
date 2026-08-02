import { ImagePlus, Plus, Upload } from 'lucide-react'
import { useState } from 'react'

function LeagueTeamForm({ onAddTeam }) {
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [image, setImage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!name.trim()) return

    setError('')
    setIsSubmitting(true)

    try {
      await onAddTeam({ file, image, name })
      setFile(null)
      setImage('')
      setName('')
    } catch (submitError) {
      setError(submitError.message || 'Could not add this team.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpload = (event) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Team image must be 5 MB or smaller.')
      return
    }

    setError('')
    setFile(selectedFile)
    setImage('')
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
            value={image}
            placeholder="https://..."
            onChange={(event) => {
              setFile(null)
              setImage(event.target.value)
            }}
          />
        </label>

        {file && <span className="league-selected-file">{file.name}</span>}
        {error && <span className="admin-form-error">{error}</span>}

        <div className="league-add-actions">
          <label className="league-upload-button">
            <Upload size={16} />
            Upload Image
            <input type="file" accept="image/*" onChange={handleUpload} />
          </label>

          <button className="league-primary-action" disabled={isSubmitting} type="submit">
            <Plus size={17} />
            {isSubmitting ? 'Adding Team' : 'Add Team'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default LeagueTeamForm
