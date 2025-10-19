import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Mic, Square } from 'lucide-react';

const HormurWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const CACHE_DURATION = 10 * 60 * 1000;

  const getCacheKey = (message, profile) => {
    const normalized = message.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).sort().join('_');
    return `hormur_cache_${profile}_${normalized}`;
  };

  const getCachedResponse = (message, profile) => {
    try {
      const cacheKey = getCacheKey(message, profile);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_DURATION) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  };

  const setCachedResponse = (message, profile, data) => {
    try {
      const cacheKey = getCacheKey(message, profile);
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('hormur_cache_'));
      if (allKeys.length > 50) {
        allKeys.slice(0, allKeys.length - 50).forEach(k => localStorage.removeItem(k));
      }
    } catch (e) {}
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(Math.min(100, average / 1.28));
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      analyzeAudio();
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setInputValue('');
    } catch (error) {
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions.');
    }
  };

  const stopRecordingOnly = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      
      setTimeout(async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            setIsTranscribing(true);
            const response = await fetch('/.netlify/functions/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: '',
                audioData: reader.result.split(',')[1],
                userProfile: userProfile || 'spectateur',
                sessionId: sessionId,
                timestamp: new Date().toISOString()
              })
            });
            const data = await response.json();
            setIsTranscribing(false);
            if (data.transcribedText) setInputValue(data.transcribedText);
          };
          reader.readAsDataURL(audioBlob);
        } catch (error) {
          setIsTranscribing(false);
          setInputValue('[Erreur de transcription]');
        }
        audioChunksRef.current = [];
      }, 100);
    }
  };

  const sendRecordingDirectly = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      setTimeout(() => handleSendMessage(true), 100);
    }
  };

  const handleSendMessage = async (isFromRecording = false) => {
    const hasAudio = isFromRecording && audioChunksRef.current.length > 0;
    const hasText = inputValue.trim().length > 0;
    if ((!hasText && !hasAudio) || isLoading) return;

    const userMessage = hasText ? inputValue.trim() : '🎤 Transcription...';
    setInputValue('');
    setMessages(prev => [...prev, { type: 'user', content: userMessage, isVocal: hasAudio }]);
    setIsLoading(true);
    if (hasAudio) setIsTranscribing(true);

    try {
      if (hasText && !hasAudio) {
        const cached = getCachedResponse(userMessage, userProfile || 'spectateur');
        if (cached) {
          setMessages(prev => [...prev, { type: 'bot', content: cached.message, results: cached.results || [], showCalendly: cached.showCalendly || false }]);
          setIsLoading(false);
          return;
        }
      }

      let audioData = null;
      if (hasAudio) {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: hasText ? userMessage : '',
          audioData: audioData,
          userProfile: userProfile || 'spectateur',
          sessionId: sessionId || null,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.transcribedText && hasAudio) {
        setMessages(prev => prev.map((msg, idx) => idx === prev.length - 1 ? { ...msg, content: data.transcribedText } : msg));
      }
      
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      if (hasText && !hasAudio && data.results && data.results.length > 0) {
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

      audioChunksRef.current = [];
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'bot',
        content: "Problème technique. Pouvez-vous réessayer ?",
        results: [],
        showCalendly: true
      }]);
      audioChunksRef.current = [];
    } finally {
      setIsLoading(false);
      setIsTranscribing(false);
    }
  };

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
      artiste: "Génial ! Quel type de lieu pour votre art ?",
      hote: "Parfait ! Quel type d'artiste recherchez-vous ?"
    };
    setMessages(prev => [...prev, { type: 'bot', content: profileMessages[profile] }]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(false);
    }
  };

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/);
    return (match && match[7].length === 11) ? match[7] : null;
  };

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
        transition: 'transform 0.2s',
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
          <div style={{ width: '100%', paddingBottom: '56.25%', position: 'relative', backgroundColor: '#000', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', overflow: 'hidden' }}>
            <iframe style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              src={'https://www.youtube.com/embed/' + youtubeId} allowFullScreen />
          </div>
        ) : result.image_url ? (
          <img src={result.image_url} alt={result.title} style={{ width: '100%', height: '180px', objectFit: 'cover', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <div style={{ width: '100%', height: '180px', background: 'linear-gradient(135deg, #FCE5DD 0%, #F8DDD2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>✨</div>
        )}
        <div style={{ padding: '16px' }}>
          <h4 style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '17px', color: '#323242', marginBottom: '10px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {result.title || 'Sans titre'}
          </h4>
          {(result.city || result.date) && (
            <p style={{ fontSize: '14px', color: '#5E5E8F', margin: '0 0 8px 0', fontWeight: '500' }}>
              {result.city}{result.city && result.date ? ' • ' : ''}{result.date}
            </p>
          )}
          {result.genre && <p style={{ fontSize: '13px', color: '#7E7EA5', marginTop: '6px', marginBottom: '10px' }}>{result.genre}</p>}
          {result.visualPrice && <p style={{ fontSize: '14px', color: '#EE7951', marginTop: '10px', marginBottom: '14px', fontWeight: '600' }}>{result.visualPrice}</p>}
          {result.url && (
            <a href={result.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', width: '100%', marginTop: '14px', background: 'linear-gradient(to right, #ef4444, #f97316)', color: 'white', padding: '12px 20px', borderRadius: '9999px', fontSize: '14px', fontWeight: '600', textAlign: 'center', textDecoration: 'none', transition: 'all 0.3s' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
              onClick={(e) => e.stopPropagation()}>
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
          <a key={idx} href={btn.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', padding: '10px 16px', borderRadius: '9999px', fontSize: '14px', fontWeight: '500', textDecoration: 'none', border: '2px solid #EE6553', color: '#EE6553', backgroundColor: 'transparent', transition: 'all 0.3s' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EE6553'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#EE6553'; }}>
            {btn.label}
          </a>
        ))}
      </div>
    );
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <>
      <style>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes wave { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
        .hormur-scrollbar::-webkit-scrollbar { width: 6px; }
        .hormur-scrollbar::-webkit-scrollbar-track { background: #F8DDD2; borderRadius: 10px; }
        .hormur-scrollbar::-webkit-scrollbar-thumb { background: #EE6553; borderRadius: 10px; }
        .hormur-floating-btn { animation: pulse 2s ease-in-out infinite; }
        .hormur-modal { animation: slideUp 0.3s ease-out; }
        .audio-bar { animation: wave 0.5s ease-in-out infinite; }
      `}</style>

      <div style={{ position: 'fixed', zIndex: 9999, fontFamily: 'system-ui, sans-serif' }}>
        <button onClick={() => setIsOpen(!isOpen)} className="hormur-floating-btn"
          style={{ position: 'fixed', bottom: '20px', right: '20px', width: '64px', height: '64px', borderRadius: '50%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)', border: 'none', cursor: 'pointer', transform: isOpen ? 'scale(0)' : 'scale(1)', opacity: isOpen ? 0 : 1 }}>
          <MessageCircle color="white" size={28} />
        </button>

        {isOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', zIndex: 9998 }} onClick={() => setIsOpen(false)} />
            
            <div className="hormur-modal" style={{
              position: 'fixed',
              ...(isMobile ? { top: 0, bottom: 0, right: 0, left: 0, width: '100%', borderRadius: '0' } : { bottom: '20px', right: '20px', width: 'min(420px, 90vw)', height: 'min(600px, 85vh)', borderRadius: '24px' }),
              backgroundColor: 'white',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 9999
            }}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #DFDFE9', backgroundColor: '#FEF6F4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#EE6553', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🎭</div>
                  <div>
                    <h3 style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '17px', color: '#323242', margin: 0 }}>Hormur</h3>
                    <p style={{ fontSize: '12px', opacity: 0.7, color: '#323242', margin: 0 }}>L'art où on ne l'attend pas</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} style={{ padding: '8px', borderRadius: '50%', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>
                  <X size={22} color="#323242" />
                </button>
              </div>

              <div className="hormur-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#FFFFFF' }}>
                {messages.map((message, idx) => (
                  <div key={idx} style={{ marginBottom: '16px' }}>
                    {message.type === 'bot' ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCE0DD', flexShrink: 0 }}>
                          <Sparkles size={16} color="#EE6553" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ background: '#FCE5DD', borderRadius: '16px', padding: '14px 16px' }}>
                            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#323242', margin: 0, whiteSpace: 'pre-line' }}>{message.content}</p>
                          </div>
                          
                          {message.showProfileButtons && !userProfile && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                              {['spectateur', 'artiste', 'hote'].map((profile, i) => (
                                <button key={profile} onClick={() => handleProfileSelect(profile)}
                                  style={{ backgroundColor: 'white', border: `2px solid ${['#F5D398', '#F5AF97', '#F5A398'][i]}`, borderRadius: '12px', padding: '12px 8px', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>{['🎟️', '🎵', '🏡'][i]}</div>
                                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#323242' }}>{['Événements', 'Artistes', 'Lieux'][i]}</div>
                                </button>
                              ))}
                            </div>
                          )}

                          {message.results && message.results.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                              {message.results.map((result, ridx) => <ResultCard key={ridx} result={result} />)}
                            </div>
                          )}

                          {message.showCalendly && <CalendlyButtons profile={userProfile} />}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ background: '#7E7EA5', color: 'white', borderRadius: '16px', padding: '14px 16px', maxWidth: '80%' }}>
                          <p style={{ fontSize: '14px', margin: 0 }}>{message.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCE0DD' }}>
                      <Sparkles size={16} color="#EE6553" />
                    </div>
                    <div style={{ background: '#FCE5DD', borderRadius: '16px', padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {[0, 0.15, 0.3].map((delay, i) => (
                          <div key={i} style={{ width: '8px', height: '8px', backgroundColor: '#7E7EA5', borderRadius: '50%', animation: `bounce 1s infinite ${delay}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: '16px', borderTop: '1px solid #DFDFE9', backgroundColor: '#FEF6F4' }}>
                {isRecording ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '24px', backgroundColor: 'white', border: '2px solid #EE6553', minHeight: '48px' }}>
                    <button onClick={stopRecordingOnly} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: '#323242', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <Square size={16} color="white" fill="white" />
                    </button>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', height: '24px' }}>
                      {[...Array(30)].map((_, i) => (
                        <div key={i} className="audio-bar" style={{ width: '3px', height: `${Math.max(20, Math.min(100, audioLevel + (Math.random() * 30)))}%`, backgroundColor: '#EE6553', borderRadius: '2px', transition: 'height 0.1s', animationDelay: `${i * 0.05}s` }} />
                      ))}
                    </div>
                    <button onClick={sendRecordingDirectly} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'linear-gradient(to right, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <Send size={18} color="white" />
                    </button>
                  </div>
                ) : isTranscribing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '24px', backgroundColor: 'white', border: '2px solid #DFDFE9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7E7EA5', fontSize: '14px', flex: 1 }}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {[0, 0.15, 0.3].map((delay, i) => (
                          <div key={i} style={{ width: '6px', height: '6px', backgroundColor: '#7E7EA5', borderRadius: '50%', animation: `bounce 1s infinite ${delay}s` }} />
                        ))}
                      </div>
                      <span>Transcription...</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={startRecording} disabled={isLoading} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #DFDFE9', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isLoading ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: isLoading ? 0.5 : 1 }}>
                      <Mic size={20} color="#5E5E8F" />
                    </button>
                    <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={handleKeyPress} placeholder="Écrivez votre message..." disabled={isLoading}
                      style={{ flex: 1, padding: '12px 16px', borderRadius: '9999px', border: '2px solid #DFDFE9', fontSize: '16px', outline: 'none', backgroundColor: isLoading ? '#f9fafb' : 'white' }}
                      onFocus={(e) => (e.target.style.borderColor = '#7E7EA5')} onBlur={(e) => (e.target.style.borderColor = '#DFDFE9')} />
                    <button onClick={() => handleSendMessage(false)} disabled={!inputValue.trim() || isLoading}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: 'none', cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed', background: inputValue.trim() && !isLoading ? 'linear-gradient(to right, #ef4444, #f97316)' : '#DFDFE9', opacity: inputValue.trim() && !isLoading ? 1 : 0.6, flexShrink: 0 }}
                      onMouseEnter={(e) => inputValue.trim() && !isLoading && (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = inputValue.trim() && !isLoading ? '1' : '0.6')}>
                      <Send size={20} />
                    </button>
                  </div>
                )}
                <p style={{ textAlign: 'center', fontSize: '11px', marginTop: '10px', opacity: 0.6, color: '#323242' }}>Hormur - L'art où on ne l'attend pas</p>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default HormurWidget;
