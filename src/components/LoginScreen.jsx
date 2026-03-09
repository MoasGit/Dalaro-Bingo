import { useState, useEffect } from 'react'
import { createPlayer, subscribeToPlayers, deletePlayer } from '../firebase/db'

const EMOJIS = [
  '🦭','⛵','🦀','🐟','🦆','🐚','🦞','🌿','🍦',
  '🌸','🌺','🌻','🍓','🦋','🐠','🌈','⭐','🎀',
  '🐙','🦈','🐬','☀️','🍉','🎸','🏄','🧁','🌷',
]
const COLORS = [
  '#F4A7B9','#F7C5A0','#FAE29C','#B8E0C8','#A8D8EA','#C9B8E8',
  '#F28B82','#FBBC04','#34A853','#4ECDC4','#A29BFE','#FD79A8',
]

export default function LoginScreen({ onLogin }) {
  const [players, setPlayers] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // player id
  const [name, setName] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('🦭')
  const [selectedColor, setSelectedColor] = useState('#F4A7B9')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = subscribeToPlayers(setPlayers)
    return unsub
  }, [])

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    try {
      const id = await createPlayer(name.trim(), selectedEmoji, selectedColor)
      onLogin({ id, name: name.trim(), emoji: selectedEmoji, color: selectedColor })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(playerId) {
    await deletePlayer(playerId)
    setConfirmDelete(null)
  }

  return (
    <div className="login-screen">
      <div className="login-header">
        <div className="login-title-wrap">
          <span className="login-icon">⚓</span>
          <h1 className="login-title">Dalarö<br/>Bingo</h1>
        </div>
        <p className="login-subtitle">Vem spelar?</p>
      </div>

      <div className="player-list">
        {players.map(player => (
          <div key={player.id} className="player-row">
            <button
              className="player-btn"
              style={{ '--player-color': player.color }}
              onClick={() => onLogin(player)}
            >
              <span className="player-btn-emoji">{player.emoji}</span>
              <span className="player-btn-name">{player.name}</span>
            </button>
            {confirmDelete === player.id ? (
              <div className="delete-confirm">
                <span className="delete-confirm-text">Radera?</span>
                <button className="delete-yes-btn" onClick={() => handleDelete(player.id)}>Ja</button>
                <button className="delete-no-btn" onClick={() => setConfirmDelete(null)}>Nej</button>
              </div>
            ) : (
              <button
                className="delete-btn"
                onClick={() => setConfirmDelete(player.id)}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      {!showCreate ? (
        <button className="create-btn" onClick={() => setShowCreate(true)}>
          + Ny spelare
        </button>
      ) : (
        <div className="create-form">
          <h2 className="create-form-title">Skapa profil</h2>

          <input
            className="create-input"
            placeholder="Ditt namn"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
          />

          <p className="create-label">Välj emoji</p>
          <div className="emoji-grid">
            {EMOJIS.map(e => (
              <button
                key={e}
                className={`emoji-btn ${selectedEmoji === e ? 'selected' : ''}`}
                onClick={() => setSelectedEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>

          <p className="create-label">Välj färg</p>
          <div className="color-grid">
            {COLORS.map(c => (
              <button
                key={c}
                className={`color-btn ${selectedColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setSelectedColor(c)}
              />
            ))}
          </div>

          <div className="create-actions">
            <button className="cancel-btn" onClick={() => setShowCreate(false)}>
              Avbryt
            </button>
            <button
              className="confirm-btn"
              onClick={handleCreate}
              disabled={!name.trim() || loading}
              style={{ backgroundColor: selectedColor }}
            >
              {loading ? 'Skapar...' : 'Skapa'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}