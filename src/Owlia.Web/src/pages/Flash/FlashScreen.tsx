import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const FLASH_DURATION_MS = 5000

export function FlashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/landing', { replace: true }), FLASH_DURATION_MS)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[var(--bg)] text-[var(--text)]">
      <img src="/owlia.svg" alt="OWLIA" className="h-24 w-24" />
      <h1 className="mt-6 text-3xl font-semibold tracking-wide">OWLIA</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Offline Voice &amp; Language Intelligence Analytics
      </p>
    </div>
  )
}
