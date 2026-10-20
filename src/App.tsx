import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Logo } from '@/components/layout/Logo'
import { PwaManager } from '@/components/layout/PwaManager'
import { TimerWatcher } from '@/features/timer/TimerWatcher'
import { AlarmWatcher } from '@/features/alarms/AlarmWatcher'
import { CaptureBridge } from '@/components/layout/CaptureBridge'
import { WelcomePage } from '@/features/welcome/WelcomePage'
import { useSettings } from '@/hooks/useData'
import { useApplyTheme } from '@/hooks/useTheme'
import { seedIfNeeded } from '@/db/seed'

const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const NotesPage = lazy(() =>
  import('@/features/notes/NotesPage').then((module) => ({ default: module.NotesPage })),
)
const NoteEditorPage = lazy(() =>
  import('@/features/notes/NoteEditorPage').then((module) => ({ default: module.NoteEditorPage })),
)
const TodosPage = lazy(() =>
  import('@/features/todos/TodosPage').then((module) => ({ default: module.TodosPage })),
)
const BookmarksPage = lazy(() =>
  import('@/features/bookmarks/BookmarksPage').then((module) => ({ default: module.BookmarksPage })),
)
const ReaderPage = lazy(() =>
  import('@/features/reader/ReaderPage').then((module) => ({ default: module.ReaderPage })),
)
const CalendarPage = lazy(() =>
  import('@/features/calendar/CalendarPage').then((module) => ({ default: module.CalendarPage })),
)
const VoicePage = lazy(() =>
  import('@/features/voice/VoicePage').then((module) => ({ default: module.VoicePage })),
)
const SearchPage = lazy(() =>
  import('@/features/search/SearchPage').then((module) => ({ default: module.SearchPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const JournalPage = lazy(() =>
  import('@/features/journal/JournalPage').then((module) => ({ default: module.JournalPage })),
)
const HabitsPage = lazy(() =>
  import('@/features/habits/HabitsPage').then((module) => ({ default: module.HabitsPage })),
)
const TimerPage = lazy(() =>
  import('@/features/timer/TimerPage').then((module) => ({ default: module.TimerPage })),
)
const TimeAuditPage = lazy(() =>
  import('@/features/timer/TimeAuditPage').then((module) => ({ default: module.TimeAuditPage })),
)
const ExpensesPage = lazy(() =>
  import('@/features/expenses/ExpensesPage').then((module) => ({ default: module.ExpensesPage })),
)
const VaultPage = lazy(() =>
  import('@/features/vault/VaultPage').then((module) => ({ default: module.VaultPage })),
)
const WhiteboardsPage = lazy(() =>
  import('@/features/whiteboards/WhiteboardsPage').then((module) => ({ default: module.WhiteboardsPage })),
)
const WhiteboardEditorPage = lazy(() =>
  import('@/features/whiteboards/WhiteboardEditorPage').then((module) => ({
    default: module.WhiteboardEditorPage,
  })),
)
const AlarmsPage = lazy(() =>
  import('@/features/alarms/AlarmsPage').then((module) => ({ default: module.AlarmsPage })),
)

function PageLoader() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
    </div>
  )
}

function App() {
  const { settings, loaded } = useSettings()
  const resolvedTheme = useApplyTheme(settings, loaded)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void seedIfNeeded()
      .catch(() => undefined)
      .then(() => {
        setReady(true)
        if (navigator.storage?.persist) {
          void navigator.storage.persist().catch(() => undefined)
        }
      })
  }, [])

  if (!ready || !loaded) return <BootScreen />

  if (!settings.onboarded) return <WelcomePage />

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="notes/:id" element={<NoteEditorPage />} />
          <Route path="todos" element={<TodosPage />} />
          <Route path="bookmarks" element={<BookmarksPage />} />
          <Route path="reader/:id" element={<ReaderPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="voice" element={<VoicePage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="habits" element={<HabitsPage />} />
          <Route path="timer" element={<TimerPage />} />
          <Route path="time" element={<TimeAuditPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="vault" element={<VaultPage />} />
          <Route path="whiteboards" element={<WhiteboardsPage />} />
          <Route path="whiteboards/:id" element={<WhiteboardEditorPage />} />
          <Route path="alarms" element={<AlarmsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        </Routes>
      </Suspense>
      <Toaster
        theme={resolvedTheme}
        position="top-center"
        closeButton
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            borderRadius: '14px',
          },
        }}
      />
      <PwaManager />
      <TimerWatcher />
      <AlarmWatcher />
      <CaptureBridge />
    </>
  )
}

function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas">
      <div className="animate-pop-in flex flex-col items-center gap-3">
        <Logo size={64} />
        <p className="text-lg font-semibold tracking-tight">BinHub</p>
      </div>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="text-xs text-faint">Apertura del tuo hub locale…</p>
    </div>
  )
}

export default App
