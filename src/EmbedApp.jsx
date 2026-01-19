import React, { useState, useEffect } from 'react'
import HormurWidget from './HormurWidget'

function EmbedApp() {
  const [bottomOffset, setBottomOffset] = useState(20)

  // Écouter les messages du parent pour ajuster le positionnement
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'HORMUR_WIDGET_CONFIG') {
        if (typeof event.data.bottomOffset === 'number') {
          setBottomOffset(event.data.bottomOffset)
        }
      }
    }

    window.addEventListener('message', handleMessage)

    // Notifier le parent que l'embed est prêt
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'HORMUR_WIDGET_READY' }, '*')
    }

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <div style={{
      background: 'transparent',
      backgroundColor: 'transparent',
      width: '100%',
      height: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      pointerEvents: 'none'
    }}>
      <div style={{ pointerEvents: 'auto', background: 'transparent', backgroundColor: 'transparent' }}>
        <HormurWidget isEmbed={true} bottomOffset={bottomOffset} />
      </div>
    </div>
  )
}

export default EmbedApp
