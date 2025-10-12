const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WORKFLOW_ID = process.env.WORKFLOW_ID;

async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'chatkit_beta=v1',
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function pollRunStatus(sessionId, runId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const run = await makeRequest(
      `https://api.openai.com/v1/chatkit/sessions/${sessionId}/runs/${runId}`,
      { method: 'GET' }
    );
    
    if (run.status === 'completed') {
      return run;
    } else if (run.status === 'failed' || run.status === 'cancelled') {
      throw new Error(`Run ${run.status}: ${run.error || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Timeout waiting for run completion');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!OPENAI_API_KEY || !WORKFLOW_ID) {
    console.error('Missing environment variables:', { 
      hasApiKey: !!OPENAI_API_KEY, 
      hasWorkflowId: !!WORKFLOW_ID 
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Configuration manquante. Vérifiez les variables d'environnement OPENAI_API_KEY et WORKFLOW_ID dans Netlify.",
        results: [],
        showCalendly: true
      })
    };
  }

  try {
    const { message, userProfile, sessionId } = JSON.parse(event.body);
    
    if (!message?.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "Merci d'écrire un message 😊",
          results: [],
          showCalendly: false
        })
      };
    }

    let currentSessionId = sessionId;

    // 1. Créer une session si nécessaire
    if (!currentSessionId) {
      console.log('Creating new session...');
      const session = await makeRequest(
        'https://api.openai.com/v1/chatkit/sessions',
        {
          method: 'POST',
          body: JSON.stringify({
            workflow: { id: WORKFLOW_ID },
            user: `user_${Date.now()}`
          })
        }
      );
      currentSessionId = session.id;
      console.log('Session created:', currentSessionId);
    }

    // 2. Envoyer le message avec le profil utilisateur inclus
    let fullMessage = message;
    if (userProfile && !sessionId) {
      fullMessage = `[Profil utilisateur: ${userProfile}] ${message}`;
    }

    console.log('Sending message to session:', currentSessionId);
    await makeRequest(
      `https://api.openai.com/v1/chatkit/sessions/${currentSessionId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: fullMessage
        })
      }
    );

    // 3. Lancer le workflow
    console.log('Starting workflow run...');
    const run = await makeRequest(
      `https://api.openai.com/v1/chatkit/sessions/${currentSessionId}/runs`,
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );
    console.log('Run started:', run.id);

    // 4. Attendre la réponse
    console.log('Waiting for run completion...');
    await pollRunStatus(currentSessionId, run.id);
    console.log('Run completed');

    // 5. Récupérer les messages
    console.log('Fetching response messages...');
    const messages = await makeRequest(
      `https://api.openai.com/v1/chatkit/sessions/${currentSessionId}/messages?limit=1&order=desc`,
      { method: 'GET' }
    );

    const assistantMessage = messages.data?.[0]?.content || "Désolé, je n'ai pas pu générer de réponse.";
    console.log('Assistant response received:', assistantMessage.substring(0, 100) + '...');

    // 6. Parser le JSON si possible
    let response;
    try {
      const cleaned = assistantMessage.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      response = JSON.parse(cleaned);
      
      if (!response.message) response.message = cleaned;
      if (!Array.isArray(response.results)) response.results = [];
      if (typeof response.showCalendly !== 'boolean') response.showCalendly = false;
      
    } catch (e) {
      // Si ce n'est pas du JSON, retourner le texte brut
      response = {
        message: assistantMessage,
        results: [],
        showCalendly: false
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sessionId: currentSessionId,
        ...response
      })
    };

  } catch (error) {
    console.error('Erreur détaillée:', error);
    console.error('Stack trace:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Désolé, problème technique. Pouvez-vous réessayer ? 🙏",
        results: [],
        showCalendly: true,
        error: error.message
      })
    };
  }
};
