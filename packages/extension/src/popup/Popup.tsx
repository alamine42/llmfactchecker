import { useState, useEffect } from 'preact/hooks'

export function Popup() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
    setVersion(manifest.version)
  }, [])

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>GroundCheck</h1>
      <p style={{ margin: '0 0 16px', color: '#666', fontSize: '14px' }}>Fact-check AI responses</p>
      <div
        style={{
          padding: '12px',
          background: '#f5f5f5',
          borderRadius: '8px',
          fontSize: '13px',
        }}
      >
        <strong>Status:</strong> Ready
        <br />
        <span style={{ color: '#888' }}>v{version}</span>
      </div>
    </div>
  )
}
