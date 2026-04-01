import React from 'react'
import SettingsPage from './pages/SettingsPage'
import DonePage from './pages/DonePage'
import CountdownOverlay from './components/CountdownOverlay'
import ProcessingScreen from './components/ProcessingScreen'
import { useRecording } from './hooks/useRecording'

export default function App() {
  const { state, startCountdown, transcodeResult, progress } = useRecording()

  return (
    <div className="h-screen w-screen flex flex-col bg-bear-bg overflow-hidden">
      <div className="flex-1 overflow-hidden relative">
        {state === 'settings' && <SettingsPage onRecord={startCountdown} />}
        {state === 'countdown' && <CountdownOverlay />}
        {state === 'recording' && (
          <div className="h-full flex items-center justify-center text-bear-muted">
            <div className="text-center">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse mx-auto mb-3" style={{ boxShadow: '0 0 12px #ef4444' }} />
              <p className="text-sm">Recording in progress</p>
              <p className="text-xs mt-1 text-bear-muted">Use the floating toolbar to stop</p>
            </div>
          </div>
        )}
        {state === 'processing' && <ProcessingScreen progress={progress} />}
        {state === 'done' && transcodeResult && (
          <DonePage result={transcodeResult} onRecordAgain={() => window.location.reload()} />
        )}
      </div>
    </div>
  )
}
