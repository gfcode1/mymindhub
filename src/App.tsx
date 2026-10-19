import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Logo } from '@/components/layout/Logo'
import { PwaManager } from '@/components/layout/PwaManager'
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

  if (!ready) return <BootScreen />

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
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="voice" element={<VoicePage />} />
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
