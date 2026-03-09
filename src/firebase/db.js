import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from './config'

// ─── Spelare ───────────────────────────────────────────────────────────────

export async function getPlayers() {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createPlayer(name, emoji, color) {
  // Skapa spelaren
  const playerRef = await addDoc(collection(db, 'players'), {
    name,
    emoji,
    color,
    createdAt: serverTimestamp(),
  })

  // Slumpa 24 rutor från poolen (25 med gratis-rutan i mitten)
  const shuffled = [...SQUARES].sort(() => Math.random() - 0.5).slice(0, 24)

  // Lägg in gratis-rutan på position 12 (mitten i 5x5)
  shuffled.splice(12, 0, { id: 'free', label: '⭐ Gratisfruta', isFree: true })

  // Spara brickan som en subcollection under spelaren
  const boardRef = collection(db, 'players', playerRef.id, 'board')
  for (let i = 0; i < shuffled.length; i++) {
    await setDoc(doc(boardRef, String(i)), {
      position: i,
      squareId: shuffled[i].id,
      label: shuffled[i].label,
      isFree: shuffled[i].isFree || false,
      checked: shuffled[i].isFree || false,
      checkedAt: null,
    })
  }

  return playerRef.id
}

export async function deletePlayer(playerId) {
  // Radera alla board-dokument först
  const boardSnap = await getDocs(collection(db, 'players', playerId, 'board'))
  for (const d of boardSnap.docs) {
    await deleteDoc(doc(db, 'players', playerId, 'board', d.id))
  }
  // Radera spelaren
  await deleteDoc(doc(db, 'players', playerId))
}

export function subscribeToPlayers(callback) {
  return onSnapshot(collection(db, 'players'), snap => {
    const players = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(players)
  })
}

// ─── Bricka ────────────────────────────────────────────────────────────────

export async function getBoard(playerId) {
  const snap = await getDocs(
    query(collection(db, 'players', playerId, 'board'), orderBy('position'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function subscribeToBoard(playerId, callback) {
  return onSnapshot(
    query(collection(db, 'players', playerId, 'board'), orderBy('position')),
    snap => {
      const board = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      callback(board)
    }
  )
}

export async function toggleSquare(playerId, squareDocId, checked) {
  // Uppdaterar bara Firebase – chat-meddelanden hanteras i BingoBoard.handleToggle
  // så vi kan garantera rätt ordning (avbockning → bingo → fullhouse)
  const squareRef = doc(db, 'players', playerId, 'board', squareDocId)
  await updateDoc(squareRef, {
    checked: !checked,
    checkedAt: !checked ? serverTimestamp() : null,
  })
}

// ─── Bingo-koll ────────────────────────────────────────────────────────────

export function checkBingo(board) {
  // board är en array med 25 element (5x5)
  const size = 5
  const checked = board.map(s => s.checked)

  // Rader
  for (let r = 0; r < size; r++) {
    if ([0,1,2,3,4].every(c => checked[r * size + c])) return true
  }
  // Kolumner
  for (let c = 0; c < size; c++) {
    if ([0,1,2,3,4].every(r => checked[r * size + c])) return true
  }
  // Diagonaler
  if ([0,6,12,18,24].every(i => checked[i])) return true
  if ([4,8,12,16,20].every(i => checked[i])) return true

  return false
}

export function checkFullHouse(board) {
  return board.every(s => s.checked)
}

// ─── Chatt ─────────────────────────────────────────────────────────────────

export async function sendChatMessage(playerId, text, type = 'manual') {
  await addDoc(collection(db, 'chat'), {
    playerId,
    text,
    type, // 'manual' | 'auto' | 'bingo' | 'fullhouse'
    reactions: {},
    createdAt: serverTimestamp(),
  })
}

const CHAT_PAGE_SIZE = 30

// Lyssnar på de senaste N meddelandena i realtid
export function subscribeToRecentChat(callback) {
  return onSnapshot(
    query(collection(db, 'chat'), orderBy('createdAt', 'desc'), limit(CHAT_PAGE_SIZE)),
    snap => {
      // desc-ordning från Firebase, vänd för att få äldst → nyast i UI
      const messages = snap.docs.reverse().map(d => ({ id: d.id, ...d.data() }))
      callback(messages, snap.docs[snap.docs.length - 1]) // skicka med äldsta doc som cursor
    }
  )
}

// Hämtar äldre meddelanden (en gång, inte realtid) baserat på en cursor-doc
export async function loadOlderMessages(cursorDoc) {
  const snap = await getDocs(
    query(
      collection(db, 'chat'),
      orderBy('createdAt', 'desc'),
      startAfter(cursorDoc),
      limit(CHAT_PAGE_SIZE)
    )
  )
  const messages = snap.docs.reverse().map(d => ({ id: d.id, ...d.data() }))
  const hasMore = snap.docs.length === CHAT_PAGE_SIZE
  const newCursor = snap.docs[snap.docs.length - 1] ?? null
  return { messages, hasMore, newCursor }
}

export async function addReaction(messageId, emoji, playerId) {
  const msgRef = doc(db, 'chat', messageId)
  const msgSnap = await getDoc(msgRef)
  if (!msgSnap.exists()) return

  const reactions = msgSnap.data().reactions || {}
  const current = reactions[emoji] || []

  // Toggle – lägg till eller ta bort spelaren från reaktionen
  const updated = current.includes(playerId)
    ? current.filter(id => id !== playerId)
    : [...current, playerId]

  await updateDoc(msgRef, {
    [`reactions.${emoji}`]: updated,
  })
}

// ─── Bingo-rutor (pool) ────────────────────────────────────────────────────

export const SQUARES = [
  { id: 's1',  label: 'Sett en älg' },
  { id: 's2',  label: 'Sett ett vildsvin' },
  { id: 's3',  label: 'Klagat på hur någon annan valt att bygga/måla sitt hus' },
  { id: 's4',  label: 'Badat i kallare än 10 grader' },
  { id: 's5',  label: 'Skvallrat på byn' },
  { id: 's6',  label: 'Sett en Fares-brorsa' },
  { id: 's7',  label: 'Äger något från Pelle P' },
  { id: 's8',  label: 'Ätit på Dalarö Mat' },
  { id: 's9',  label: 'Tagit en öl på Tullhuset' },
  { id: 's10', label: 'Spelat minigolf på Dalarö' },
  { id: 's11', label: 'Sprungit motionsspåret på Dalarö' },
  { id: 's12', label: 'Besökt Smådalarö Gård' },
  { id: 's13', label: 'Spelat golf på Smådalarö Gård' },
  { id: 's14', label: 'Åkt Dalarö-bussen' },
  { id: 's15', label: 'Handlat på torget' },
  { id: 's16', label: 'Sett en Strömstedt' },
  { id: 's17', label: 'Kvällsbadat på Dalarö' },
  { id: 's18', label: 'Åkt båt på Dalarö' },
  { id: 's19', label: 'Handlat på Gålö lanthandel' },
  { id: 's20', label: 'Bastat på Dalarö' },
  { id: 's21', label: 'Firat jul på Dalarö' },
  { id: 's22', label: 'Dansat runt en midsommarstång på Dalarö' },
  { id: 's23', label: 'Ätit glass från Dalarö Glass' },
  { id: 's24', label: 'Ätit ett bakverk från bageriet' },
  { id: 's25', label: 'Sett en säl' },
  { id: 's26', label: 'Spelat kubb' },
  { id: 's27', label: 'Paddlat vid Dalarö' },
  { id: 's28', label: 'Tagit en tupplur utomhus' },
  { id: 's29', label: 'Näckat' },
  { id: 's30', label: 'Kört barn i skottkärra' },
]