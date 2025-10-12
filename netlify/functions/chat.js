const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WORKFLOW_ID = process.env.WORKFLOW_ID;

async function makeOpenAIRequest(endpoint, options = {}) {
  const fullUrl = `https://api.openai.com${endpoint}`;
  
  const response = await fetch(fullUrl, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'chatkit_beta=v1'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    throw new Error(`OpenAI API Error (${response.status}): ${errorMsg}`);
  }

  return data;
}

async function waitForRunCompletion(sessionId, runId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const run = await makeOpenAIRequest(`/v1/chatkit/sessions/${sessionId}/runs/${runId}`);
    
    if (run.status === 'completed') {
      return run;
    }
    
    if (run.status === 'failed' || run.status === 'cancelled') {
      throw new Error(`Run ${run.status}: ${run.error || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Run timeout after 60 seconds');
}

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

  if (!OPENAI_API_KEY || !WORKFLOW_ID) {
    console.error('❌ Missing env vars:', { 
      hasKey: !!OPENAI_API_KEY, 
      hasWorkflow: !!WORKFLOW_ID 
    });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Configuration manquante. Vérifiez OPENAI_API_KEY et WORKFLOW_ID.",
        results: [],
        showCalendly: true
      })
    };
  }

  try {
    const { message, userProfile, sessionId } = JSON.parse(event.body || '{}');
    
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

    let currentSessionId = sessionId;

    // Créer une session si nécessaire
    if (!currentSessionId) {
      console.log('📝 Creating session...');
      const session = await makeOpenAIRequest('/v1/chatkit/sessions', {
        method: 'POST',
        body: {
          workflow: { id: WORKFLOW_ID },
          user: `user_${Date.now()}`
        }
      });
      currentSessionId = session.id;
      console.log('✅ Session created:', currentSessionId);
    }

    // Envoyer le message
    let fullMessage = message;
    if (userProfile && !sessionId) {
      fullMessage = `[Profil: ${userProfile}] ${message}`;
    }

    console.log('💬 Sending message...');
    await makeOpenAIRequest(`/v1/chatkit/sessions/${currentSessionId}/messages`, {
      method: 'POST',
      body: {
        role: 'user',
        content: fullMessage
      }
    });

    // Démarrer le workflow
    console.log('🚀 Starting run...');
    const run = await makeOpenAIRequest(`/v1/chatkit/sessions/${currentSessionId}/runs`, {
      method: 'POST',
      body: {}
    });

    // Attendre la completion
    console.log('⏳ Waiting for completion...');
    await waitForRunCompletion(currentSessionId, run.id);

    // Récupérer la réponse
    console.log('📥 Fetching response...');
    const messages = await makeOpenAIRequest(
      `/v1/chatkit/sessions/${currentSessionId}/messages?limit=1&order=desc`
    );

    const assistantMessage = messages.data?.[0]?.content || "Désolé, aucune réponse générée.";
    console.log('✅ Response received');

    // Parser le JSON si possible
    let response;
    try {
      const cleaned = assistantMessage
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      response = JSON.parse(cleaned);
      
      if (!response.message) response.message = cleaned;
      if (!Array.isArray(response.results)) response.results = [];
      if (typeof response.showCalendly !== 'boolean') response.showCalendly = false;
    } catch (e) {
      response = {
        message: assistantMessage,
        results: [],
        showCalendly: false
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        sessionId: currentSessionId,
        ...response
      })
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    
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
