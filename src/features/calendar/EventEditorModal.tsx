import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { createEvent, deleteEvent, restoreEvent, updateEvent } from '@/db/seed'
import { combineDateAndTime, formatTime, toDateInput } from '@/lib/dates'
import type { CalendarEvent } from '@/types/models'

const COLORS = ['#0d9488', '#4f46e5', '#7c3aed', '#b45309', '#be123c', '#4d7c0f', '#0891b2', '#c2410c']

interface EventEditorProps {
  open: boolean
  event: CalendarEvent | null
  defaultDate: string
  onClose: () => void
}

export function EventEditorModal({ open, event, defaultDate, onClose }: EventEditorProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [color, setColor] = useState(COLORS[0]!)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (event) {
      setTitle(event.title)
      setDate(toDateInput(event.start) || defaultDate)
      setStartTime(formatTime(event.start) || '09:00')
      setEndTime(formatTime(event.end) || '10:00')
      setAllDay(event.allDay)
      setDescription(event.description)
      setLocation(event.location)
      setColor(event.color || COLORS[0]!)
    } else {
      setTitle('')
      setDate(defaultDate)
      setStartTime('09:00')
      setEndTime('10:00')
      setAllDay(false)
      setDescription('')
      setLocation('')
      setColor(COLORS[0]!)
    }
  }, [open, event, defaultDate])

  const save = () => {
    if (!title.trim()) {
      setError('Il titolo è obbligatorio.')
      return
    }
    if (!date) {
      setError('Scegli una data.')
      return
    }
    const start = allDay ? `${date}T00:00` : combineDateAndTime(date, startTime || '00:00')
    const end = allDay ? `${date}T23:59` : combineDateAndTime(date, endTime || startTime || '00:00')
    if (!allDay && Date.parse(end) <= Date.parse(start)) {
      setError('L’orario di fine deve essere dopo l’inizio.')
      return
    }
    const payload = {
      title: title.trim(),
      description,
      start,
      end,
      allDay,
      location,
      color,
      linkedNoteId: event?.linkedNoteId ?? null,
    }
    if (event) {
      void updateEvent(event.id, payload).then(() => {
        toast.success('Evento aggiornato')
        onClose()
      })
    } else {
      void createEvent(payload).then(() => {
        toast.success('Evento creato')
        onClose()
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Modifica evento' : 'Nuovo evento'}
      description={event ? undefined : 'Aggiungi un appuntamento al calendario.'}
      footer={
        <>
          {event ? (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                void deleteEvent(event.id).then(() => {
                  toast('Evento eliminato', {
                    action: { label: 'Annulla', onClick: () => void restoreEvent(event.id) },
                  })
                  onClose()
                })
              }}
            >
              Elimina
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={save}>{event ? 'Salva' : 'Crea'}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label="Titolo" htmlFor="event-title">
          <Input
            id="event-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError('')
            }}
            placeholder="Es. Riunione, visita, compleanno…"
            autoFocus
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" htmlFor="event-date">
            <Input
              id="event-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Colore">
            <div className="flex h-11 items-center gap-1.5">
              {COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Colore ${swatch}`}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    color === swatch ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                  }`}
                  style={{ background: swatch }}
                />
              ))}
            </div>
          </Field>
        </div>

        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm font-medium">Tutto il giorno</span>
        </label>

        {!allDay ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inizio" htmlFor="event-start">
              <Input
                id="event-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </Field>
            <Field label="Fine" htmlFor="event-end">
              <Input
                id="event-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        <Field label="Luogo" htmlFor="event-location">
          <Input
            id="event-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Dove? (opzionale)"
          />
        </Field>

        <Field label="Descrizione" htmlFor="event-description">
          <Textarea
            id="event-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Dettagli, note, partecipanti…"
            rows={3}
          />
        </Field>
      </div>
    </Modal>
  )
}
