import { useEffect, useRef } from 'react'

export default function Confetti({ active, onDone }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      size: Math.random() * 8 + 4,
      color: ['#2E86AB','#E84855','#F5A623','#4CAF50','#9B59B6','#FFD700'][Math.floor(Math.random() * 6)],
      speed: Math.random() * 4 + 2,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
      drift: (Math.random() - 0.5) * 2,
    }))

    let frame
    let done = false

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let allGone = true

      pieces.forEach(p => {
        if (p.y < canvas.height + 20) {
          allGone = false
          p.y += p.speed
          p.x += p.drift
          p.angle += p.spin
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.angle)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
          ctx.restore()
        }
      })

      if (allGone && !done) {
        done = true
        onDone?.()
        return
      }
      frame = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(frame)
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}