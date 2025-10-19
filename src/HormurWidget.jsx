import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Mic, StopCircle, XCircle } from 'lucide-react';

const HormurWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasAudioReady, setHasAudioReady] = useState(false); // NOUVEAU: pour forcer le re-render
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 💾 SYSTÈME DE CACHE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  const getCacheKey = (message, profile) => {
    const normalized = message.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .sort()
      .join('_');
    return `hormur_cache_${profile}_${normalized}`;
  };

  const getCachedResponse = (message, profile) => {
    try {
      const cacheKey = getCacheKey(message, profile);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      if (age > CACHE_DURATION) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      console.log('✅ Cache hit:', message.substring(0, 50));
      return data;
    } catch (e) {
      return null;
    }
  };

  const setCachedResponse = (message, profile, data) => {
    try {
      const cacheKey = getCacheKey(message, profile);
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('hormur_cache_'));
      if (allKeys.length > 50) {
        allKeys.slice(0, allKeys.length - 50).forEach(k => localStorage.removeItem(k));
      }
    } catch (e) {
      console.warn('Cache storage failed:', e);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎤 GESTION AUDIO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const startRecording = async () => {
    try {
      // IMPORTANT : Vider l'input avant d'enregistrer
      setInputValue('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setHasAudioReady(false);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log('📼 Chunk audio reçu:', e.data.size, 'bytes');
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('🛑 Enregistrement arrêté. Total chunks:', audioChunksRef.current.length);
        setHasAudioReady(audioChunksRef.current.length > 0);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000); // Enregistre par tranches de 1 seconde
      setIsRecording(true);
      console.log('🎙️ Enregistrement démarré');
    } catch (error) {
      console.error('Erreur microphone:', error);
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // État pour savoir si un audio est prêt
  const hasRecordedAudio = audioChunksRef.current.length > 0;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📤 ENVOI DE MESSAGE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleSendMessage = async () => {
    const hasAudioToSend = hasAudioReady && audioChunksRef.current.length > 0;
    const hasTextToSend = inputValue.trim().length > 0;
    
    console.log('📤 handleSendMessage appelé:', { hasAudioToSend, hasTextToSend, chunksLength: audioChunksRef.current.length });
    
    if ((!hasTextToSend && !hasAudioToSend) || isLoading) {
      console.log('❌ Rien à envoyer ou déjà en cours');
      return;
    }

    const startTime = performance.now();
    const userMessage = hasTextToSend ? inputValue.trim() : '🎤 Message vocal';
    
    setInputValue('');
    
    setMessages(prev => [...prev, {
      type: 'user',
      content: userMessage,
      isVocal: hasAudioToSend
    }]);

    setIsLoading(true);

    try {
      // 🚀 VÉRIFIER LE CACHE (seulement pour texte)
      if (hasTextToSend && !hasAudioToSend) {
        const cached = getCachedResponse(userMessage, userProfile || 'spectateur');
        if (cached) {
          const cacheTime = performance.now() - startTime;
          console.log(`⚡ Cache hit: ${cacheTime.toFixed(0)}ms`);
          
          setMessages(prev => [...prev, {
            type: 'bot',
            content: cached.message,
            results: cached.results || [],
            showCalendly: cached.showCalendly || false
          }]);
          
          setIsLoading(false);
          return;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000);

      // 🎤 CONVERTIR L'AUDIO EN BASE64
      let audioDataToSend = null;
      if (hasAudioToSend) {
        console.log('🎤 Conversion audio en base64...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('📦 Taille blob audio:', Math.round(audioBlob.size / 1024) + 'KB');
        
        audioDataToSend = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            console.log('✅ Audio converti en base64, longueur:', base64.length);
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
      }

      console.log('🌐 Envoi vers backend:', {
        hasMessage: hasTextToSend,
        hasAudio: !!audioDataToSend,
        audioLength: audioDataToSend?.length || 0
      });

      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          message: hasTextToSend ? userMessage : '', // Vide si audio
          audioData: audioDataToSend,
          userProfile: userProfile || 'spectateur',
          sessionId: sessionId || null,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const data = await response.json();
      const totalTime = performance.now() - startTime;
      
      console.log(`✅ Réponse reçue: ${totalTime.toFixed(0)}ms`, data);
      
      // 📝 MISE À JOUR DE LA TRANSCRIPTION SI AUDIO
      if (data.transcribedText && hasAudioToSend) {
        console.log('📝 Mise à jour avec transcription:', data.transcribedText);
        setMessages(prev => prev.map((msg, idx) => 
          idx === prev.length - 1 ? { ...msg, content: data.transcribedText } : msg
        ));
      }
      
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      // 💾 METTRE EN CACHE (seulement si texte et résultats)
      if (hasTextToSend && !hasAudioToSend && data.results && data.results.length > 0) {
        setCachedResponse(userMessage, userProfile || 'spectateur', {
          message: data.message,
          results: data.results,
          showCalendly: data.showCalendly
        });
      }

      setMessages(prev => [...prev, {
        type: 'bot',
        content: data.message || "Désolé, je n'ai pas de réponse.",
        results: Array.isArray(data.results) ? data.results : [],
        showCalendly: data.showCalendly === true
      }]);

      // 🧹 NETTOYAGE
      audioChunksRef.current = [];
      setHasAudioReady(false);

    } catch (error) {
      console.error('❌ Erreur:', error);
      
      const errorMessage = error.name === 'AbortError' 
        ? "La requête a pris trop de temps. Réessayez avec une question plus simple"
        : "Problème technique. Pouvez-vous réessayer ?";
      
      setMessages(prev => [...prev, {
        type: 'bot',
        content: errorMessage,
        results: [],
        showCalendly: true
      }]);
      
      audioChunksRef.current = [];
      setHasAudioReady(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎯 AUTRES HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setTimeout(() => {
        setMessages([{
          type: 'bot',
          content: "Bonjour ! Je suis l'assistant Hormur. Vous cherchez un événement, un artiste ou un lieu ?",
          showProfileButtons: true
        }]);
      }, 300);
    }
  }, [isOpen, messages.length]);

  const handleProfileSelect = (profile) => {
    setUserProfile(profile);
    const profileMessages = {
      spectateur: "Super ! Quelle ville vous intéresse, et pour quand ?",
      artiste: "Génial ! Quel type de lieu pour votre art ? (appartement, jardin, galerie...)",
      hote: "Parfait ! Quel type d'artiste recherchez-vous ? (musique, théâtre, arts visuels...)"
    };
    
    setMessages(prev => [...prev, {
      type: 'bot',
      content: profileMessages[profile],
      profile: profile
    }]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎨 COMPOSANTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const ResultCard = ({ result }) => {
    const youtubeId = extractYouTubeId(result.video_url);

    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #DFDFE9',
        marginBottom: '12px',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        width: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      }}>
        
        {youtubeId ? (
          <div style={{
            width: '100%',
            paddingBottom: '56.25%',
            position: 'relative',
            backgroundColor: '#000',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            overflow: 'hidden'
          }}>
            <iframe
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              src={'https://www.youtube.com/embed/' + youtubeId}
              title="Vidéo de présentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : result.image_url ? (
          <img 
            src={result.image_url} 
            alt={result.title}
            style={{
              width: '100%',
              height: '180px',
              objectFit: 'cover',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '180px',
            background: 'linear-gradient(135deg, #FCE5DD 0%, #F8DDD2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px'
          }}>
            {result.type === 'artiste' ? '🎨' : result.type === 'lieu' ? '🏡' : '✨'}
          </div>
        )}

        <div style={{ padding: '16px' }}>
          <h4 style={{
            fontFamily: 'Georgia, serif',
            fontWeight: 'bold',
            fontSize: '17px',
            color: '#323242',
            marginBottom: '10px',
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {result.title || 'Sans titre'}
          </h4>
          
          {(result.city || result.date) && (
            <p style={{ fontSize: '14px', color: '#5E5E8F', margin: '0 0 8px 0', fontWeight: '500' }}>
              {result.city}{result.city && result.date ? ' • ' : ''}{result.date}
            </p>
          )}
          
          {result.genre && (
            <p style={{ 
              fontSize: '13px', 
              color: '#7E7EA5', 
              marginTop: '6px',
              marginBottom: '10px'
            }}>
              {result.genre}
            </p>
          )}
          
          {result.visualPrice && (
            <p style={{ 
              fontSize: '14px', 
              color: '#EE7951', 
              marginTop: '10px',
              marginBottom: '14px',
              fontWeight: '600' 
            }}>
              {result.visualPrice}
            </p>
          )}
          
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                width: '100%',
                marginTop: '14px',
                background: 'linear-gradient(to right, #ef4444, #f97316)',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center',
                textDecoration: 'none',
                transition: 'all 0.3s',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Voir les détails
            </a>
          )}
        </div>
      </div>
    );
  };

  const CalendlyButtons = ({ profile }) => {
    const buttons = profile === 'artiste' 
      ? [{ label: 'Discuter avec Éléonore', url: 'https://calendly.com/eleonore-hormur/15min' }] 
      : [{ label: 'Échanger avec Martin', url: 'https://calendly.com/martin-jeudy/15min' }];

    return (
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {buttons.map((btn, idx) => (
          <a
            key={idx}
            href={btn.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '10px 16px',
              borderRadius: '9999px',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.3s',
              textDecoration: 'none',
              border: '2px solid #EE6553',
              color: '#EE6553',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#EE6553';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#EE6553';
            }}
          >
            {btn.label}
          </a>
        ))}
      </div>
    );
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎨 RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes recordPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .hormur-scrollbar::-webkit-scrollbar { width: 6px; }
        .hormur-scrollbar::-webkit-scrollbar-track {
          background: #F8DDD2;
          border-radius: 10px;
        }
        .hormur-scrollbar::-webkit-scrollbar-thumb {
          background: #EE6553;
          border-radius: 10px;
        }
        .hormur-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #EE7951;
        }
        .hormur-floating-btn { animation: pulse 2s ease-in-out infinite; }
        .hormur-modal { animation: slideUp 0.3s ease-out; }
        .recording-indicator { animation: recordPulse 1s ease-in-out infinite; }
      `}</style>

      <div style={{ position: 'fixed', zIndex: 9999, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hormur-floating-btn"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s',
            background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)',
            border: 'none',
            cursor: 'pointer',
            transform: isOpen ? 'scale(0)' : 'scale(1)',
            opacity: isOpen ? 0 : 1
          }}
          aria-label="Ouvrir l'assistant Hormur"
        >
          <MessageCircle color="white" size={28} />
        </button>

        {isOpen && (
          <>
            <div 
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                transition: 'opacity 0.3s',
                zIndex: 9998
              }}
              onClick={() => setIsOpen(false)}
            />
            
            <div 
              className="hormur-modal"
              style={{
                position: 'fixed',
                ...(isMobile ? {
                  top: 0,
                  bottom: 0,
                  right: 0,
                  left: 0,
                  width: '100%',
                  height: 'auto',
                  borderRadius: '0'
                } : {
                  bottom: '20px',
                  right: '20px',
                  width: 'min(420px, 90vw)',
                  height: 'min(600px, 85vh)',
                  borderRadius: '24px'
                }),
                backgroundColor: 'white',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s',
                zIndex: 9999
              }}
            >
              {/* Header */}
              <div style={{
                flexShrink: 0,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #DFDFE9',
                backgroundColor: '#FEF6F4',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden'
                  }}>
                    <img 
                      src="/icone logo hormur.svg" 
                      alt="Logo Hormur" 
                      style={{ 
                        width: '42px', 
                        height: '42px',
                        display: 'block',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.style.backgroundColor = '#EE6553';
                        e.target.parentElement.innerHTML = '<svg width="42" height="42" viewBox="0 0 100 100" fill="white"><path d="M20,20 L20,80 L35,80 L35,55 L50,65 L50,80 L65,80 L65,20 L50,20 L50,45 L35,35 L35,20 Z" /><circle cx="80" cy="50" r="15" fill="white" /><circle cx="80" cy="50" r="8" fill="#EE6553" /></svg>';
                      }}
                    />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '17px', color: '#323242', margin: 0 }}>
                      Hormur
                    </h3>
                    <p style={{ fontSize: '12px', opacity: 0.7, color: '#323242', margin: 0 }}>
                      L'art où on ne l'attend pas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: '8px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FCE5DD'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  aria-label="Fermer"
                >
                  <X size={22} color="#323242" />
                </button>
              </div>

              {/* Messages */}
              <div className="hormur-scrollbar" style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '20px',
                backgroundColor: '#FFFFFF',
                WebkitOverflowScrolling: 'touch'
              }}>
                {messages.map((message, idx) => (
                  <div key={idx} style={{ marginBottom: '16px' }}>
                    {message.type === 'bot' ? (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#FCE0DD',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}>
                          <Sparkles size={16} color="#EE6553" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                          <div style={{
                            background: '#FCE5DD',
                            borderRadius: '16px',
                            borderTopLeftRadius: '4px',
                            padding: '14px 16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                          }}>
                            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#323242', margin: 0, whiteSpace: 'pre-line' }}>
                              {message.content}
                            </p>
                          </div>
                          
                          {message.showProfileButtons && !userProfile && (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: '8px',
                              marginTop: '12px'
                            }}>
                              <button
                                onClick={() => handleProfileSelect('spectateur')}
                                style={{
                                  backgroundColor: 'white',
                                  border: '2px solid #F5D398',
                                  borderRadius: '12px',
                                  padding: '12px 8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.borderColor = '#EEB653';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.borderColor = '#F5D398';
                                }}
                              >
                                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🎟️</div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#323242' }}>Événements</div>
                              </button>
                              <button
                                onClick={() => handleProfileSelect('artiste')}
                                style={{
                                  backgroundColor: 'white',
                                  border: '2px solid #F5AF97',
                                  borderRadius: '12px',
                                  padding: '12px 8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.borderColor = '#EE7951';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.borderColor = '#F5AF97';
                                }}
                              >
                                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🎵</div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#323242' }}>Artistes</div>
                              </button>
                              <button
                                onClick={() => handleProfileSelect('hote')}
                                style={{
                                  backgroundColor: 'white',
                                  border: '2px solid #F5A398',
                                  borderRadius: '12px',
                                  padding: '12px 8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.borderColor = '#F18475';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.borderColor = '#F5A398';
                                }}
                              >
                                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🏡</div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#323242' }}>Lieux</div>
                              </button>
                            </div>
                          )}

                          {message.results && message.results.length > 0 && (
                            <div style={{ marginTop: '16px', width: '100%' }}>
                              {message.results.map((result, ridx) => (
                                <ResultCard key={ridx} result={result} />
                              ))}
                            </div>
                          )}

                          {message.showCalendly && (
                            <CalendlyButtons profile={userProfile} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          background: '#7E7EA5',
                          color: 'white',
                          borderRadius: '16px',
                          borderTopRightRadius: '4px',
                          padding: '14px 16px',
                          maxWidth: '80%',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word'
                        }}>
                          <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                            {message.content}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#FCE0DD',
                      flexShrink: 0
                    }}>
                      <Sparkles size={16} color="#EE6553" />
                    </div>
                    <div style={{
                      background: '#FCE5DD',
                      borderRadius: '16px',
                      borderTopLeftRadius: '4px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#7E7EA5', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#7E7EA5', borderRadius: '50%', animation: 'bounce 1s infinite 0.15s' }} />
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#7E7EA5', borderRadius: '50%', animation: 'bounce 1s infinite 0.3s' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                flexShrink: 0,
                padding: '16px',
                borderTop: '1px solid #DFDFE9',
                backgroundColor: '#FEF6F4',
                position: 'sticky',
                bottom: 0
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isLoading}
                    className={isRecording ? 'recording-indicator' : ''}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      border: '2px solid #DFDFE9',
                      backgroundColor: isRecording ? '#EE6553' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                      opacity: isLoading ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => !isLoading && !isRecording && (e.currentTarget.style.borderColor = '#7E7EA5')}
                    onMouseLeave={(e) => !isRecording && (e.currentTarget.style.borderColor = '#DFDFE9')}
                  >
                    {isRecording ? (
                      <StopCircle size={20} color="white" />
                    ) : (
                      <Mic size={20} color="#5E5E8F" />
                    )}
                  </button>
                  
                  <input
                    type="text"
                    value={isRecording ? '🎤 Enregistrement en cours...' : (hasAudioReady && !inputValue ? '🎤 Audio prêt - Cliquez sur Envoyer' : inputValue)}
                    onChange={(e) => {
                      // Ne pas permettre de taper pendant l'enregistrement ou si audio prêt
                      if (!isRecording && !hasAudioReady) {
                        setInputValue(e.target.value);
                      }
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder={isRecording ? 'Parlez maintenant...' : (hasAudioReady ? 'Audio enregistré - Envoyez ou écrivez' : 'Écrivez votre message...')}
                    disabled={isLoading || isRecording || hasAudioReady}
                    readOnly={isRecording || hasAudioReady}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '9999px',
                      border: isRecording ? '2px solid #EE6553' : (hasAudioReady ? '2px solid #10b981' : '2px solid #DFDFE9'),
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      backgroundColor: (isLoading || isRecording || hasAudioReady) ? '#FEF6F4' : 'white',
                      minWidth: 0,
                      color: isRecording ? '#EE6553' : (hasAudioReady && !inputValue ? '#10b981' : '#323242'),
                      cursor: (isRecording || hasAudioReady) ? 'not-allowed' : 'text'
                    }}
                    onFocus={(e) => !isRecording && !hasAudioReady && (e.target.style.borderColor = '#7E7EA5')}
                    onBlur={(e) => !isRecording && !hasAudioReady && (e.target.style.borderColor = '#DFDFE9')}
                  />
                  
                  <button
                    onClick={handleSendMessage}
                    disabled={(inputValue.trim().length === 0 && !hasAudioReady) || isLoading || isRecording}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      transition: 'all 0.3s',
                      border: 'none',
                      cursor: (inputValue.trim().length > 0 || hasAudioReady) && !isLoading && !isRecording ? 'pointer' : 'not-allowed',
                      background: (inputValue.trim().length > 0 || hasAudioReady) && !isLoading && !isRecording ? 'linear-gradient(to right, #ef4444, #f97316)' : '#DFDFE9',
                      opacity: (inputValue.trim().length > 0 || hasAudioReady) && !isLoading && !isRecording ? 1 : 0.6,
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => (inputValue.trim().length > 0 || hasAudioReady) && !isLoading && !isRecording && (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = (inputValue.trim().length > 0 || hasAudioReady) && !isLoading && !isRecording ? '1' : '0.6')}
                  >
                    <Send size={20} />
                  </button>
                </div>
                <p style={{
                  textAlign: 'center',
                  fontSize: '11px',
                  marginTop: '10px',
                  opacity: 0.6,
                  color: '#323242'
                }}>
                  Hormur - L'art où on ne l'attend pas
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default HormurWidget;
