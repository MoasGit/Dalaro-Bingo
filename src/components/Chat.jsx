import { useState, useEffect, useRef } from 'react'
import { subscribeToRecentChat, loadOlderMessages, sendChatMessage, addReaction } from '../firebase/db'

const REACTION_EMOJIS = ['👍', '😂', '🔥', '❤️', '😮', '👏']

export default function Chat({ currentPlayer, players }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [activeMsg, setActiveMsg] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [cursor, setCursor] = useState(null)       // äldsta doc vi har, för paginering
  const [hasMore, setHasMore] = useState(false)    // finns det äldre meddelanden?
  const [loadingMore, setLoadingMore] = useState(false)
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)
  const isFirstLoad = useRef(true)                 // håller koll på om det är första render
  const holdTimer = useRef(null)
  const leaveTimer = useRef(null)

  useEffect(() => {
    const unsub = subscribeToRecentChat((newMessages, oldestDoc) => {
      setMessages(newMessages)

      // Sätter cursor till det äldsta meddelandet vi fått
      // Om vi fick exakt 30 st finns det troligen fler
      setCursor(oldestDoc ?? null)
      setHasMore(newMessages.length === 30)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!scrollRef.current) return

    if (isFirstLoad.current && messages.length > 0) {
      // Första gången – hoppa direkt till botten utan animation
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      isFirstLoad.current = false
    } else if (!isFirstLoad.current) {
      // Nytt meddelande – scrolla smidigt dit
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    function handleOutside() { setActiveMsg(null); setTooltip(null) }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [])

  async function handleLoadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)

    // Spara scroll-position innan vi lägger till meddelanden
    // så sidan inte hoppar upp när gamla meddelanden prepend:as
    const container = scrollRef.current
    const scrollHeightBefore = container.scrollHeight

    const { messages: older, hasMore: more, newCursor } = await loadOlderMessages(cursor)

    setMessages(prev => [...older, ...prev])
    setHasMore(more)
    setCursor(newCursor)

    // Återställ scroll-position så man stannar på samma ställe
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight - scrollHeightBefore
    })

    setLoadingMore(false)
  }

  async function handleSend() {
    if (!text.trim() || !currentPlayer) return
    await sendChatMessage(currentPlayer.id, text.trim(), 'manual')
    setText('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTouchStart(e, msgId) {
    e.stopPropagation()
    holdTimer.current = setTimeout(() => {
      setActiveMsg(prev => prev === msgId ? null : msgId)
      setTooltip(null)
      navigator.vibrate?.(30)
    }, 400)
  }
  function handleTouchEnd() { clearTimeout(holdTimer.current) }

  function handleMouseEnter(msgId) {
    clearTimeout(leaveTimer.current)
    setActiveMsg(msgId)
  }
  function handleMouseLeave() {
    leaveTimer.current = setTimeout(() => setActiveMsg(null), 200)
  }
  function handlePickerEnter() { clearTimeout(leaveTimer.current) }
  function handlePickerLeave() {
    leaveTimer.current = setTimeout(() => setActiveMsg(null), 200)
  }

  function getPlayerById(id) { return players.find(p => p.id === id) }

  function formatTime(ts) {
    if (!ts) return ''
    const date = ts.toDate ? ts.toDate() : new Date(ts)
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  }

  function getReactorNames(ids) {
    return ids
      .map(id => id === currentPlayer?.id ? 'Du' : (getPlayerById(id)?.name || '?'))
      .join(', ')
  }

  return (
    <div className="chat-wrap">
      <div className="chat-messages" ref={scrollRef}>

        {/* Ladda äldre meddelanden */}
        {hasMore && (
          <div className="load-more-wrap">
            <button
              className="load-more-btn"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Laddar...' : '⬆ Ladda äldre meddelanden'}
            </button>
          </div>
        )}

        {messages.map(msg => {
          const sender = msg.playerId ? getPlayerById(msg.playerId) : null
          const isOwn = msg.playerId === currentPlayer?.id
          const isAuto = msg.type === 'auto' || msg.type === 'bingo' || msg.type === 'fullhouse'
          const isPicker = activeMsg === msg.id

          const activeReactions = REACTION_EMOJIS
            .map(e => ({ emoji: e, ids: msg.reactions?.[e] || [] }))
            .filter(r => r.ids.length > 0)

          return (
            <div
              key={msg.id}
              className={`chat-msg ${isAuto ? 'auto' : ''} ${isOwn ? 'own' : ''} ${msg.type === 'bingo' ? 'bingo-msg' : ''} ${msg.type === 'fullhouse' ? 'fullhouse-msg' : ''}`}
            >
              {!isAuto && sender && !isOwn && (
                <div className="chat-sender" style={{ color: sender.color }}>
                  {sender.emoji} {sender.name}
                </div>
              )}

              <div
                className="chat-bubble-wrap"
                onMouseEnter={!isAuto ? () => handleMouseEnter(msg.id) : undefined}
                onMouseLeave={!isAuto ? handleMouseLeave : undefined}
                onTouchStart={!isAuto ? (e) => handleTouchStart(e, msg.id) : undefined}
                onTouchEnd={!isAuto ? handleTouchEnd : undefined}
                onTouchMove={handleTouchEnd}
                onClick={e => e.stopPropagation()}
              >
                {!isAuto && isPicker && (
                  <div
                    className={`reaction-picker-popup ${isOwn ? 'own' : ''}`}
                    onMouseEnter={handlePickerEnter}
                    onMouseLeave={handlePickerLeave}
                  >
                    {REACTION_EMOJIS.map(e => (
                      <button
                        key={e}
                        className={`picker-btn ${(msg.reactions?.[e] || []).includes(currentPlayer?.id) ? 'picked' : ''}`}
                        onClick={() => {
                          addReaction(msg.id, e, currentPlayer?.id)
                          setActiveMsg(null)
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                <div className="chat-bubble-row">
                  <div
                    className="chat-bubble"
                    style={!isAuto && sender ? { '--sender-color': sender.color } : {}}
                  >
                    {msg.text}
                    <span className="chat-time">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>

                {activeReactions.length > 0 && (
                  <div className={`reaction-pills ${isOwn ? 'own' : ''}`}>
                    {activeReactions.map(({ emoji, ids }) => (
                      <div key={emoji} className="reaction-pill-wrap">
                        <button
                          className={`reaction-pill ${ids.includes(currentPlayer?.id) ? 'reacted' : ''}`}
                          onClick={() => addReaction(msg.id, emoji, currentPlayer?.id)}
                          onMouseEnter={() => setTooltip({ msgId: msg.id, emoji })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {emoji} {ids.length}
                        </button>
                        {tooltip?.msgId === msg.id && tooltip?.emoji === emoji && (
                          <div className="reaction-tooltip">
                            {getReactorNames(ids)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder={currentPlayer ? 'Skriv något...' : 'Logga in för att chatta'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!currentPlayer}
          maxLength={200}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!text.trim() || !currentPlayer}
        >
          ➤
        </button>
      </div>
    </div>
  )
}