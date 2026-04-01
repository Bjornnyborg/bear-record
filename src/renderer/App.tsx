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
      {/* Custom titlebar */}
      <div className="titlebar-drag flex items-center justify-between px-4 h-10 flex-shrink-0 border-b border-bear-border">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-bear-accent" />
          <span className="text-sm font-semibold text-bear-text tracking-wide">Bear Record</span>
        </div>
        <div className="titlebar-no-drag flex items-center gap-2">
          <button
            className="w-3 h-3 rounded-full bg-[#333] hover:bg-[#febc2e] transition-colors"
            title="Minimize"
            onClick={() => window.electronAPI.minimizeWindow()}
          />
          <button
            className="w-3 h-3 rounded-full bg-[#333] hover:bg-[#ff5f57] transition-colors"
            title="Close"
            onClick={() => window.electronAPI.closeWindow()}
          />
        </div>
      </div>

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
