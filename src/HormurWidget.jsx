import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Calendar, Sparkles, Music, Home, Ticket } from 'lucide-react';

const HormurWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null); // ← AJOUTÉ
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Message d'accueil initial
      setTimeout(() => {
        setMessages([{
          type: 'bot',
          content: "Bonjour 👋 Je suis l'assistant Hormur. Vous voulez découvrir un événement, trouver un artiste ou repérer un lieu ?",
          showProfileButtons: true
        }]);
      }, 300);
    }
  }, [isOpen]);

  const handleProfileSelect = (profile) => {
    setUserProfile(profile);
    const profileMessages = {
      spectateur: "Super ! Je vais vous aider à trouver un événement. Plutôt concert, expo ou atelier ? Et dans quelle ville ? ✨",
      hote: "Parfait ! Quel type d'artiste cherchez-vous pour votre événement ? (musique, théâtre, arts visuels…)",
      artiste: "Génial ! Quel type de lieu recherchez-vous pour votre art ? (appartement, jardin, galerie, commerce…)"
    };
    
    setMessages(prev => [...prev, {
      type: 'bot',
      content: profileMessages[profile],
      profile: profile
    }]);
  };

  // ← FONCTION MODIFIÉE
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue('');
    
    setMessages(prev => [...prev, {
      type: 'user',
      content: userMessage
    }]);

    setIsLoading(true);

    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          userProfile: userProfile,
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Sauvegarder la session
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      setMessages(prev => [...prev, {
        type: 'bot',
        content: data.message,
        results: data.results || [],
        showCalendly: data.showCalendly || false
      }]);

    } catch (error) {
      console.error('Erreur:', error);
      setMessages(prev => [...prev, {
        type: 'bot',
        content: "Désolé, je rencontre un problème technique. Pouvez-vous réessayer ? 🙏",
        results: [],
        showCalendly: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const ResultCard = ({ result }) => {
    const typeColors = {
      'événement': '#EEB653',
      'artiste': '#EE7951',
      'lieu': '#F18475'
    };

    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #f3f4f6',
        marginBottom: '12px',
        transition: 'box-shadow 0.3s'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            background: 'linear-gradient(135deg, #fce7f3 0%, #fed7aa 100%)'
          }}>
            {result.image}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500',
              color: 'white',
              backgroundColor: typeColors[result.type],
              marginBottom: '8px'
            }}>
              {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
            </div>
            <h4 style={{
              fontFamily: 'Georgia, serif',
              fontWeight: 'bold',
              fontSize: '14px',
              color: '#1f2937',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {result.title}
            </h4>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>
              {result.city} {result.date && `• ${result.date}`}
            </p>
            {result.genre && (
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{result.genre}</p>
            )}
          </div>
        </div>
        <button style={{
          width: '100%',
          marginTop: '12px',
          background: 'linear-gradient(to right, #ef4444, #f97316)',
          backgroundColor: '#EE6553',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '9999px',
          fontSize: '14px',
          fontWeight: '500',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }}>
          Voir les détails
        </button>
      </div>
    );
  };

  const CalendlyButtons = ({ profile }) => {
    const buttons = profile === 'artiste' ? [
      { label: '💬 Discuter avec Éléonore (15 min)', url: 'https://calendly.com/eleonore-hormur/15min' }
    ] : [
      { label: '💬 Échanger avec Martin (15 min)', url: 'https://calendly.com/martin-jeudy/15min' },
      { label: '🤝 Rendez-vous stratégique (30 min)', url: 'https://calendly.com/martin-jeudy/30min', secondary: true }
    ];

    return (
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {buttons.map((btn, idx) => (
          
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
              backgroundColor: btn.secondary ? 'transparent' : 'transparent'
            }}
          >
            {btn.label}
          </a>
        ))}
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
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

        .hormur-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .hormur-scrollbar::-webkit-scrollbar-track {
          background: #FCE5DD;
          border-radius: 10px;
        }

        .hormur-scrollbar::-webkit-scrollbar-thumb {
          background: #EE6553;
          border-radius: 10px;
        }

        .hormur-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #EE7951;
        }

        .hormur-floating-btn {
          animation: pulse 2s ease-in-out infinite;
        }

        .hormur-modal {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>

      <div style={{ position: 'fixed', zIndex: 9999, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Bouton flottant (état discret) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hormur-floating-btn"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '56px',
            height: '56px',
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
          <MessageCircle color="white" size={24} />
        </button>

        {/* Modale (état ouvert) */}
        {isOpen && (
          <>
            {/* Overlay */}
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
            
            {/* Widget modal */}
            <div 
              className="hormur-modal"
              style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: '90vw',
                maxWidth: '420px',
                height: '85vh',
                maxHeight: '600px',
                backgroundColor: 'white',
                borderRadius: '24px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s',
                zIndex: 9999
              }}
            >
              {/* En-tête */}
              <div style={{
                flexShrink: 0,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #DFDFE9',
                backgroundColor: '#FEF6F4'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)'
                  }}>
                    H
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '16px', color: '#323242', margin: 0 }}>
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
                    transition: 'background-color 0.2s'
                  }}
                  aria-label="Fermer"
                >
                  <X size={20} color="#323242" />
                </button>
              </div>

              {/* Zone de messages scrollable */}
              <div className="hormur-scrollbar" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                backgroundColor: '#FFFFFF'
              }}>
                {messages.map((message, idx) => (
                  <div key={idx} style={{ marginBottom: '16px' }}>
                    {message.type === 'bot' ? (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          flexShrink: 0,
                          background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)'
                        }}>
                          <Sparkles size={16} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            background: 'linear-gradient(135deg, #fce7f3 0%, #fed7aa 100%)',
                            borderRadius: '16px',
                            borderTopLeftRadius: '4px',
                            padding: '16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#323242', margin: 0 }}>
                              {message.content}
                            </p>
                          </div>
                          
                          {/* Boutons de profil */}
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
                                  border: '2px solid #EEB653',
                                  borderRadius: '12px',
                                  padding: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎟️</div>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: '#323242' }}>Événements</div>
                              </button>
                              <button
                                onClick={() => handleProfileSelect('artiste')}
                                style={{
                                  backgroundColor: 'white',
                                  border: '2px solid #EE7951',
                                  borderRadius: '12px',
                                  padding: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎨</div>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: '#323242' }}>Artistes</div>
                              </button>
                              <button
                                onClick={() => handleProfileSelect('hote')}
                                style={{
                                  backgroundColor: 'white',
                                  border: '2px solid #F18475',
                                  borderRadius: '12px',
                                  padding: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                <div style={{ fontSize: '24px', marginBottom: '4px' }}>🏡</div>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: '#323242' }}>Lieux</div>
                              </button>
                            </div>
                          )}

                          {/* Résultats */}
                          {message.results && (
                            <div style={{ marginTop: '16px' }}>
                              {message.results.map((result, ridx) => (
                                <ResultCard key={ridx} result={result} />
                              ))}
                            </div>
                          )}

                          {/* Boutons Calendly */}
                          {message.showCalendly && (
                            <CalendlyButtons profile={userProfile} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          background: 'linear-gradient(to right, #ef4444, #f97316)',
                          backgroundColor: '#EE6553',
                          color: 'white',
                          borderRadius: '16px',
                          borderTopRightRadius: '4px',
                          padding: '16px',
                          maxWidth: '75%',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)'
                    }}>
                      <Sparkles size={16} />
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #fce7f3 0%, #fed7aa 100%)',
                      borderRadius: '16px',
                      borderTopLeftRadius: '4px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1s infinite 0.15s' }} />
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1s infinite 0.3s' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Zone de saisie */}
              <div style={{
                flexShrink: 0,
                padding: '16px',
                borderTop: '1px solid #DFDFE9',
                backgroundColor: '#FCE5DD'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Écrivez votre message..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '9999px',
                      border: '2px solid #DFDFE9',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
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
                      cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                      background: inputValue.trim() ? 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)' : '#DFDFE9',
                      opacity: inputValue.trim() ? 1 : 0.5
                    }}
                  >
                    <Send size={18} />
                  </button>
                </div>
                <p style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  marginTop: '8px',
                  opacity: 0.6,
                  color: '#323242'
                }}>
                  Hormur — L'art où on ne l'attend pas
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
