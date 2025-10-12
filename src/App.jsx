import React from 'react'
import HormurWidget from './HormurWidget'

function App() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #FEF6F4 0%, #FCE5DD 100%)',
      padding: '40px 20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          fontFamily: 'Georgia, serif',
          color: '#323242',
          fontSize: '48px',
          marginBottom: '20px'
        }}>
          Widget Hormur
        </h1>
        <p style={{ 
          color: '#323242',
          fontSize: '20px',
          marginBottom: '40px',
          opacity: 0.8
        }}>
          L'art où on ne l'attend pas ✨
        </p>
        
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: '0 4px 20px rgba(50,50,66,0.1)',
          textAlign: 'left'
        }}>
          <h2 style={{ 
            fontFamily: 'Georgia, serif',
            color: '#323242',
            marginBottom: '20px'
          }}>
            Testez le widget 👇
          </h2>
          <p style={{ color: '#323242', marginBottom: '15px' }}>
            Cliquez sur le bouton flottant en bas à droite pour ouvrir l'assistant conversationnel.
          </p>
          <p style={{ color: '#323242', marginBottom: '15px' }}>
            🎟️ Trouvez des événements culturels uniques<br/>
            🎨 Découvrez des artistes talentueux<br/>
            🏡 Explorez des lieux non conventionnels
          </p>
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: '#FCE5DD',
            borderRadius: '12px',
            borderLeft: '4px solid #EE6553'
          }}>
            <strong style={{ color: '#323242' }}>Note :</strong> 
            <span style={{ color: '#323242', opacity: 0.8 }}>
              {' '}Cette démo utilise des données de test. Connectez votre Agent Builder OpenAI pour les données réelles.
            </span>
          </div>
        </div>
      </div>
      
      <HormurWidget />
    </div>
  )
}

export default App
