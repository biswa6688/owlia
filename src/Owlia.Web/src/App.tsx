import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { FlashScreen } from './pages/Flash/FlashScreen'
import { Landing } from './pages/Landing/Landing'
import { Playground } from './pages/Playground/Playground'
import { History } from './pages/History/History'
import Download from './pages/Download/Download'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FlashScreen />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/history" element={<History />} />
        <Route path="/download" element={<Download />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
