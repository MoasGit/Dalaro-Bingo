import { useState, useEffect } from 'react'
import { subscribeToBoard, toggleSquare, checkBingo, checkFullHouse, sendChatMessage } from '../firebase/db'

export default function BingoBoard({ player, currentPlayer, onBingo }) {
  const [board, setBoard] = useState([])
  const isOwner = currentPlayer?.id === player.id

  const bingoKey     = `bingo_fired_${player.id}`
  const fullhouseKey = `fullhouse_fired_${player.id}`

  useEffect(() => {
    // Bara lyssna på board-ändringar och uppdatera UI – ingen bingo-logik här
    const unsub = subscribeToBoard(player.id, (newBoard) => {
      setBoard(newBoard)
    })
    return unsub
  }, [player.id])

  async function handleToggle(square) {
    if (!isOwner || square.isFree) return

    const isChecking = !square.checked

    // Beräkna hur brickan ser ut EFTER klicket
    const updatedBoard = board.map(s =>
      s.id === square.id ? { ...s, checked: isChecking } : s
    )

    const hasBingo     = checkBingo(updatedBoard)
    const hasFullHouse = checkFullHouse(updatedBoard)

    // 1. Skicka avbocknings-meddelande i chatten
    const action = isChecking ? 'bockade av' : 'ångrade'
    await sendChatMessage(null, `${player.name} ${action} "${square.label}" ✅`, 'auto')

    // 2. Uppdatera Firebase (ändrar inte chattordningen – chat skickades redan)
    await toggleSquare(player.id, square.id, square.checked)

    // 3. Skicka bingo/fullhouse i rätt ordning, bara om det är nytt
    if (isChecking) {
      if (hasBingo && !localStorage.getItem(bingoKey)) {
        localStorage.setItem(bingoKey, 'true')
        await sendChatMessage(null, `🎉 BINGO! ${player.name} fick bingo!`, 'bingo')
        onBingo('bingo')
      }
      if (hasFullHouse && !localStorage.getItem(fullhouseKey)) {
        localStorage.setItem(fullhouseKey, 'true')
        await sendChatMessage(null, `🏆 FULL HOUSE! ${player.name} har bockat av ALLT!`, 'fullhouse')
        onBingo('fullhouse')
      }
    }

    // Om man ångrar tillräckligt många – rensa flaggorna så det kan triggas igen
    if (!hasBingo)     localStorage.removeItem(bingoKey)
    if (!hasFullHouse) localStorage.removeItem(fullhouseKey)
  }

  const checkedCount = board.filter(s => s.checked && !s.isFree).length
  const total        = board.filter(s => !s.isFree).length

  return (
    <div className="board-wrap">
      <div className="board-player-header" style={{ '--player-color': player.color }}>
        <span className="board-player-emoji">{player.emoji}</span>
        <span className="board-player-name">{player.name}</span>
        <span className="board-player-count">{checkedCount}/{total}</span>
      </div>

      <div className="bingo-grid">
        {board.map(square => (
          <button
            key={square.id}
            className={`bingo-cell ${square.checked ? 'checked' : ''} ${square.isFree ? 'free' : ''} ${!isOwner ? 'readonly' : ''}`}
            style={{ '--player-color': player.color }}
            onClick={() => handleToggle(square)}
          >
            <span className="cell-label">{square.label}</span>
            {square.checked && <span className="cell-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}