const fetch = require('node-fetch');
const FormData = require('form-data');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Répondre aux requêtes OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Vérifier que N8N_WEBHOOK_URL existe
  if (!N8N_WEBHOOK_URL) {
    console.error('❌ N8N_WEBHOOK_URL manquant dans les variables d\'environnement');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Erreur de configuration. Contactez l'administrateur.",
        results: [],
        showCalendly: true
      })
    };
  }

  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { message, userProfile, sessionId, audioData } = requestBody;
    
    let finalMessage = message?.trim() || '';

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🎤 TRANSCRIPTION AUDIO AVEC WHISPER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    if (audioData) {
      console.log('🎙️ Audio reçu, transcription en cours...');
      
      // Vérifier que la clé OpenAI existe
      if (!OPENAI_API_KEY) {
        console.warn('⚠️ OPENAI_API_KEY manquant - transcription impossible');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            message: "La transcription vocale n'est pas encore configurée. Veuillez écrire votre message.",
            results: [],
            showCalendly: false
          })
        };
      }
      
      try {
        // Décoder le base64 en Buffer
        const audioBuffer = Buffer.from(audioData, 'base64');
        console.log(`📦 Taille audio: ${Math.round(audioBuffer.length / 1024)}KB`);
        
        // Préparer le FormData pour l'API Whisper
        const formData = new FormData();
        formData.append('file', audioBuffer, {
          filename: 'audio.webm',
          contentType: 'audio/webm'
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'fr'); // Force français
        formData.append('response_format', 'json');

        // Appel à l'API Whisper d'OpenAI
        console.log('🌐 Envoi vers Whisper API...');
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            ...formData.getHeaders()
          },
          body: formData
        });

        if (!whisperResponse.ok) {
          const errorBody = await whisperResponse.text();
          console.error('❌ Erreur Whisper:', whisperResponse.status, errorBody);
          throw new Error(`Whisper API error: ${whisperResponse.status}`);
        }

        const transcription = await whisperResponse.json();
        finalMessage = transcription.text?.trim() || '';
        
        if (!finalMessage) {
          throw new Error('Transcription vide');
        }
        
        console.log('✅ Transcription réussie:', finalMessage.substring(0, 100));

      } catch (transcriptionError) {
        console.error('❌ Erreur transcription:', transcriptionError.message);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            message: "Impossible de transcrire l'audio. Parlez plus fort ou réessayez.",
            results: [],
            showCalendly: false
          })
        };
      }
    }

    // Vérifier qu'on a bien un message
    if (!finalMessage) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Merci d'envoyer un message ou un audio 😊",
          results: [],
          showCalendly: false
        })
      };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📤 ENVOI VERS N8N
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('📤 Envoi vers n8n:', {
      message: finalMessage.substring(0, 50),
      userProfile: userProfile || 'indefini',
      sessionId: sessionId || 'nouveau'
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s max

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: finalMessage,
        userProfile: userProfile || 'indefini',
        sessionId: sessionId || null,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('❌ Erreur n8n:', n8nResponse.status, errorText);
      throw new Error(`n8n error: ${n8nResponse.status}`);
    }

    const n8nData = await n8nResponse.json();
    console.log('✅ Réponse n8n reçue avec succès');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📦 RÉPONSE FINALE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        sessionId: n8nData.sessionId || sessionId,
        message: n8nData.message || "Réponse reçue",
        transcribedText: audioData ? finalMessage : undefined, // Renvoyer la transcription
        results: Array.isArray(n8nData.results) ? n8nData.results : [],
        showCalendly: n8nData.showCalendly || false,
        redirect_url: n8nData.redirect_url || null
      })
    };

  } catch (error) {
    console.error('❌ Erreur globale:', error.message);
    
    // Message d'erreur selon le type
    let errorMessage = "Problème technique. Réessayez dans un instant 🙏";
    let statusCode = 500;
    
    if (error.name === 'AbortError') {
      errorMessage = "La requête a pris trop de temps. Réessayez avec une question plus courte.";
      statusCode = 504;
    } else if (error.message.includes('Whisper')) {
      errorMessage = "Erreur de transcription audio. Réessayez ou écrivez votre message.";
      statusCode = 400;
    } else if (error.message.includes('n8n')) {
      errorMessage = "Le service n8n ne répond pas. Contactez l'administrateur.";
      statusCode = 502;
    }
    
    return {
      statusCode: statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        message: errorMessage,
        results: [],
        showCalendly: true,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
