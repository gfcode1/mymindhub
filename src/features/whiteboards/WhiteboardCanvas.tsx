import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { uid } from '@/lib/utils'
import { drawWhiteboardStroke } from '@/lib/whiteboard'
import type { WhiteboardPoint, WhiteboardStroke, WhiteboardTool } from '@/types/models'

export function WhiteboardCanvas({
  width,
  height,
  strokes,
  tool,
  color,
  strokeWidth,
  onCommit,
}: {
  width: number
  height: number
  strokes: WhiteboardStroke[]
  tool: WhiteboardTool
  color: string
  strokeWidth: number
  onCommit: (strokes: WhiteboardStroke[]) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef<WhiteboardStroke | null>(null)
  const lastPointRef = useRef<WhiteboardPoint | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, width, height)
    for (const stroke of strokes) drawWhiteboardStroke(context, stroke)
  }, [strokes, width, height])

  useEffect(() => {
    redraw()
  }, [redraw])

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): WhiteboardPoint => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.min(width, Math.max(0, ((event.clientX - rect.left) / rect.width) * width)),
      y: Math.min(height, Math.max(0, ((event.clientY - rect.top) / rect.height) * height)),
    }
  }

  const drawSegment = (from: WhiteboardPoint, to: WhiteboardPoint) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!context) return
    context.save()
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    context.strokeStyle = color
    context.lineWidth = strokeWidth
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
    context.restore()
  }

  const handleDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // pointer capture may be unavailable
    }
    const point = pointFromEvent(event)
    const stroke: WhiteboardStroke = {
      id: uid(),
      color,
      width: strokeWidth,
      tool,
      points: [point],
    }
    activeRef.current = stroke
    lastPointRef.current = point
    drawSegment(point, { x: point.x + 0.01, y: point.y + 0.01 })
  }

  const handleMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current
    const last = lastPointRef.current
    if (!active || !last) return
    event.preventDefault()
    const point = pointFromEvent(event)
    if (Math.abs(point.x - last.x) < 0.4 && Math.abs(point.y - last.y) < 0.4) return
    active.points.push(point)
    drawSegment(last, point)
    lastPointRef.current = point
  }

  const handleUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current
    if (!active) return
    activeRef.current = null
    lastPointRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onCommit([...strokes, active])
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-line bg-white shadow-inner"
      style={{
        backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        className="block h-auto w-full cursor-crosshair"
        style={{ touchAction: 'none', aspectRatio: `${width} / ${height}` }}
      />
    </div>
  )
}
