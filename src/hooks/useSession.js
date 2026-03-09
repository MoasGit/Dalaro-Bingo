import { useState } from 'react'

const SESSION_KEY = 'dalaro_bingo_player'

export function useSession() {
  const [currentPlayer, setCurrentPlayer] = useState(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    return saved ? JSON.parse(saved) : null
  })

  function login(player) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(player))
    setCurrentPlayer(player)
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setCurrentPlayer(null)
  }

  return { currentPlayer, login, logout }
}