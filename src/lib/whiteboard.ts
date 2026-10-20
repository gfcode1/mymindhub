import type { WhiteboardStroke } from '@/types/models'

export function drawWhiteboardStroke(
  context: CanvasRenderingContext2D,
  stroke: WhiteboardStroke,
): void {
  const points = stroke.points
  if (points.length === 0) return
  context.save()
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  context.strokeStyle = stroke.color
  context.fillStyle = stroke.color
  context.lineWidth = stroke.width
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (points.length === 1) {
    const point = points[0]!
    context.beginPath()
    context.arc(point.x, point.y, Math.max(1, stroke.width / 2), 0, Math.PI * 2)
    context.fill()
    context.restore()
    return
  }

  context.beginPath()
  context.moveTo(points[0]!.x, points[0]!.y)
  if (points.length === 2) {
    context.lineTo(points[1]!.x, points[1]!.y)
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index]!
      const next = points[index + 1]!
      context.quadraticCurveTo(
        current.x,
        current.y,
        (current.x + next.x) / 2,
        (current.y + next.y) / 2,
      )
    }
    const last = points[points.length - 1]!
    context.lineTo(last.x, last.y)
  }
  context.stroke()
  context.restore()
}
