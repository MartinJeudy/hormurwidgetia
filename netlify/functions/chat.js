const fetch = require('node-fetch');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gestion CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Vérification de la configuration
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
    const { message, userProfile, sessionId } = JSON.parse(event.body || '{}');
    
    // Validation du message
    if (!message?.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Merci d'écrire un message 😊",
          results: [],
          showCalendly: false
        })
      };
    }

    console.log('📤 Envoi vers n8n:', { message, userProfile, sessionId });

    // Appel vers n8n
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.trim(),
        userProfile: userProfile || null,
        sessionId: sessionId || null,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`n8n error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Réponse de n8n reçue');

    // Formatage de la réponse (n8n doit renvoyer ce format)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        sessionId: data.sessionId || sessionId,
        message: data.message || "Réponse reçue",
        results: Array.isArray(data.results) ? data.results : [],
        showCalendly: data.showCalendly || false
      })
    };

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Problème technique. Réessayez dans un instant 🙏",
        results: [],
        showCalendly: true,
        error: error.message
      })
    };
  }
};
