import { useState, useEffect } from 'react'
import { subscribeToPlayers } from './firebase/db'
import { useSession } from './hooks/useSession'
import LoginScreen from './components/LoginScreen'
import BingoBoard from './components/BingoBoard'
import Chat from './components/Chat'
import Confetti from './components/Confetti'
import './styles/app.css'

export default function App() {
  const { currentPlayer, login } = useSession()
  const [players, setPlayers] = useState([])
  const [tab, setTab] = useState('min') // 'min' | 'alla' | 'chatt'
  const [confetti, setConfetti] = useState(false)
  const [bingoMsg, setBingoMsg] = useState('')

  useEffect(() => {
    const unsub = subscribeToPlayers(setPlayers)
    return unsub
  }, [])

  const [bingoType, setBingoType] = useState('')

  function handleBingo(type) {
    setConfetti(true)
    setBingoMsg(type === 'fullhouse' ? '🏆 FULL HOUSE!' : '🎉 BINGO!')
    setBingoType(type)
    setTimeout(() => { setBingoMsg(''); setBingoType('') }, 4000)
  }

  if (!currentPlayer) {
    return <LoginScreen onLogin={login} />
  }

  return (
    <div className="app">
      <Confetti active={confetti} onDone={() => setConfetti(false)} />

      {bingoMsg && (
        <div className={`bingo-toast ${bingoType}`}>{bingoMsg}</div>
      )}

      {/* Header */}
      <header className="app-header">
        <span className="app-logo">⚓ Dalarö Bingo</span>
        <span className="app-header-player">
          {currentPlayer.emoji} {currentPlayer.name}
        </span>
      </header>

      {/* Content */}
      <main className="app-main">
        {tab === 'min' && (
          <div className="tab-content">
            <BingoBoard
              player={currentPlayer}
              currentPlayer={currentPlayer}
              onBingo={handleBingo}
            />
          </div>
        )}

        {tab === 'alla' && (
          <div className="tab-content">
            {players
              .filter(p => p.id !== currentPlayer.id)
              .map(player => (
                <BingoBoard
                  key={player.id}
                  player={player}
                  currentPlayer={currentPlayer}
                  onBingo={() => {}}
                />
              ))}
            {players.length <= 1 && (
              <p className="empty-msg">Inga andra spelare än 👀</p>
            )}
          </div>
        )}

        {tab === 'chatt' && (
          <div className="tab-content chat-tab">
            <Chat currentPlayer={currentPlayer} players={players} />
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        <button
          className={`nav-btn ${tab === 'min' ? 'active' : ''}`}
          onClick={() => setTab('min')}
        >
          <span className="nav-icon">🎯</span>
          <span className="nav-label">Min bricka</span>
        </button>
        <button
          className={`nav-btn ${tab === 'alla' ? 'active' : ''}`}
          onClick={() => setTab('alla')}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">Alla</span>
        </button>
        <button
          className={`nav-btn ${tab === 'chatt' ? 'active' : ''}`}
          onClick={() => setTab('chatt')}
        >
          <span className="nav-icon">💬</span>
          <span className="nav-label">Chatt</span>
        </button>
      </nav>
    </div>
  )
}