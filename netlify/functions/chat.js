const fetch = require('node-fetch');
const FormData = require('form-data');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // À ajouter dans Netlify

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (!N8N_WEBHOOK_URL) {
    console.error('❌ N8N_WEBHOOK_URL manquant');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Configuration manquante. Vérifiez N8N_WEBHOOK_URL dans Netlify.",
        results: [],
        showCalendly: true
      })
    };
  }

  try {
    const { message, userProfile, sessionId, audioData } = JSON.parse(event.body || '{}');
    
    let finalMessage = message?.trim() || '';

    // 🎤 TRANSCRIPTION AUDIO SI PRÉSENT
    if (audioData && OPENAI_API_KEY) {
      console.log('🎙️ Transcription audio en cours...');
      
      try {
        // Convertir base64 → Buffer
        const audioBuffer = Buffer.from(audioData, 'base64');
        
        // Créer un FormData pour Whisper
        const formData = new FormData();
        formData.append('file', audioBuffer, {
          filename: 'audio.webm',
          contentType: 'audio/webm'
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'fr'); // Force le français
        formData.append('response_format', 'json');

        // Appel Whisper API
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            ...formData.getHeaders()
          },
          body: formData
        });

        if (!whisperResponse.ok) {
          throw new Error(`Whisper error: ${whisperResponse.status}`);
        }

        const transcription = await whisperResponse.json();
        finalMessage = transcription.text.trim();
        console.log('✅ Transcription:', finalMessage.substring(0, 100));

      } catch (transcriptionError) {
        console.error('❌ Erreur transcription:', transcriptionError.message);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            message: "Impossible de transcrire l'audio. Réessayez ou écrivez votre message.",
            results: [],
            showCalendly: false
          })
        };
      }
    }

    if (!finalMessage) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Merci d'écrire un message ou d'enregistrer un audio 😊",
          results: [],
          showCalendly: false
        })
      };
    }

    console.log('📤 Envoi vers n8n:', { 
      message: finalMessage.substring(0, 50), 
      userProfile, 
      sessionId
    });

    // Envoi vers n8n avec timeout de 25s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: finalMessage,
        userProfile: userProfile || 'spectateur',
        sessionId: sessionId || null,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`n8n error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Réponse de n8n reçue');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        sessionId: data.sessionId || sessionId,
        message: data.message || "Réponse reçue",
        transcribedText: audioData ? finalMessage : undefined, // Renvoie la transcription
        results: Array.isArray(data.results) ? data.results : [],
        showCalendly: data.showCalendly || false
      })
    };

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    return {
      statusCode: error.name === 'AbortError' ? 504 : 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: error.name === 'AbortError' 
          ? "La requête a pris trop de temps. Réessayez avec une question plus simple."
          : "Problème technique. Réessayez dans un instant 🙏",
        results: [],
        showCalendly: true,
        error: error.message
      })
    };
  }
};
