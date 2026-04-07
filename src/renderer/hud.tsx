import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function Hud() {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);

  const params = new URLSearchParams(window.location.search);
  const webcamDeviceId = params.get("webcam");
  const webcamSize = parseInt(params.get("size") || "280", 10);

  useEffect(() => {
    const t = setInterval(() => {
      if (!paused) setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    if (!webcamDeviceId || !webcamVideoRef.current) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({
        video: webcamDeviceId ? { deviceId: { exact: webcamDeviceId } } : true,
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = s;
          webcamVideoRef.current.play();
        }
      })
      .catch(console.error);
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [webcamDeviceId]);

  const stop = () => window.electronAPI.sendHudStop();
  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    window.electronAPI.sendHudPause(next);
  };

  // Webcam-only window
  if (webcamDeviceId) {
    return (
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", border: "3px solid rgba(255,255,255,0.25)", background: "#111" }}>
        <video ref={webcamVideoRef} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    )
  }

  // Controls-only window
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(15,15,15,0.92)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 32,
          padding: "10px 16px",
          backdropFilter: "blur(12px)",
          WebkitAppRegion: "drag" as any,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: paused ? "#888" : "#ff3b30", boxShadow: paused ? "none" : "0 0 6px #ff3b30", animation: paused ? "none" : "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
        <span style={{ color: "#f0f0f0", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 42 }}>
          {formatTime(elapsed)}
        </span>
        <button onClick={togglePause} style={{ WebkitAppRegion: "no-drag" as any, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#f0f0f0", fontSize: 12, flexShrink: 0 }} title={paused ? "Resume" : "Pause"}>
          {paused ? "▶" : "⏸"}
        </button>
        <button onClick={stop} style={{ WebkitAppRegion: "no-drag" as any, background: "#ff3b30", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }} title="Stop recording">
          ■
        </button>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("hud-root")!).render(<Hud />);
