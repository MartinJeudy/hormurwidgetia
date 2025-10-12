const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WORKFLOW_ID = process.env.WORKFLOW_ID;

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function pollRunStatus(sessionId, runId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const options = {
      hostname: 'api.openai.com',
      path: `/v1/chatkit/sessions/${sessionId}/runs/${runId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'chatkit_beta=v1'
      }
    };

    const run = await makeRequest(options);
    
    if (run.status === 'completed') {
      return run;
    } else if (run.status === 'failed' || run.status === 'cancelled') {
      throw new Error(`Run ${run.status}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Timeout');
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Configuration manquante. Vérifiez les variables Netlify.",
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
      const sessionOptions = {
        hostname: 'api.openai.com',
        path: '/v1/chatkit/sessions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'chatkit_beta=v1'
        }
      };

      const sessionData = JSON.stringify({
        workflow: { id: WORKFLOW_ID },
        user: `user_${Date.now()}`,
        metadata: { userProfile: userProfile || 'unknown' }
      });

      const session = await makeRequest(sessionOptions, sessionData);
      currentSessionId = session.id;
    }

    // 2. Envoyer le message
    const messageOptions = {
      hostname: 'api.openai.com',
      path: `/v1/chatkit/sessions/${currentSessionId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'chatkit_beta=v1'
      }
    };

    let fullMessage = message;
    if (userProfile && !sessionId) {
      fullMessage = `[Profil: ${userProfile}] ${message}`;
    }

    const messageData = JSON.stringify({
      role: 'user',
      content: fullMessage
    });

    const messageResponse = await makeRequest(messageOptions, messageData);

    // 3. Lancer le workflow
    const runOptions = {
      hostname: 'api.openai.com',
      path: `/v1/chatkit/sessions/${currentSessionId}/runs`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'chatkit_beta=v1'
      }
    };

    const run = await makeRequest(runOptions, JSON.stringify({}));

    // 4. Attendre la réponse
    await pollRunStatus(currentSessionId, run.id);

    // 5. Récupérer les messages
    const messagesOptions = {
      hostname: 'api.openai.com',
      path: `/v1/chatkit/sessions/${currentSessionId}/messages?limit=1&order=desc`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'chatkit_beta=v1'
      }
    };

    const messages = await makeRequest(messagesOptions);
    const assistantMessage = messages.data[0]?.content || "Désolé, je n'ai pas pu générer de réponse.";

    // 6. Parser le JSON si possible
    let response;
    try {
      const cleaned = assistantMessage.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
      headers,
      body: JSON.stringify({
        sessionId: currentSessionId,
        ...response
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Désolé, problème technique. Pouvez-vous réessayer ? 🙏",
        results: [],
        showCalendly: true
      })
    };
  }
};
