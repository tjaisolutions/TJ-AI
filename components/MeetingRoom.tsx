
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Share, Captions, CircleDot, Loader2, RefreshCw, UserPlus, CheckCircle2, LogOut, MonitorUp, X } from 'lucide-react';
import { RecordedMeeting, TranscriptItem } from '../types';
import { analyzeMeeting } from '../services/geminiService';
import { io, Socket } from 'socket.io-client';

interface MeetingRoomProps {
    onLeave: () => void;
    onSaveMeeting: (meeting: RecordedMeeting) => void;
    isGuest?: boolean;
}

// Configuração dos servidores STUN (Google Publis STUN) para permitir conexão P2P através de NATs
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

const MeetingRoom: React.FC<MeetingRoomProps> = ({ onLeave, onSaveMeeting, isGuest = false }) => {
  // Referências Fixas para os elementos de vídeo
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<string | null>(null);

  // Connection State
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const roomId = 'sala-padrao-tj'; 
  
  // Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null); // Stream da Câmera
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null); // Stream da Tela
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 

  // Transcription State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isTranscribingRef = useRef(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const recognitionRef = useRef<any>(null);
  const [sidebarMode, setSidebarMode] = useState<'PARTICIPANTS' | 'TRANSCRIPT'>('PARTICIPANTS');
  const [isListening, setIsListening] = useState(false); // Visual indicator for voice activity

  // --- 1. SETUP LOCAL MEDIA (CAMERA) ---
  useEffect(() => {
    const startLocalStream = async () => {
        try {
            // Solicita vídeo e áudio. Em mobile, idealmente usa a câmera frontal por padrão ('user')
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' }, 
                audio: true 
            });
            setLocalStream(stream);
        } catch (err: any) {
            console.error("Erro ao acessar mídia:", err);
            setError("Permissão de câmera/microfone negada ou indisponível.");
        }
    };

    if (!meetingEnded) {
        startLocalStream();
    }

    return () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [meetingEnded]);

  // Attach Stream to Video Element (Robust way)
  // Se estiver compartilhando tela, mostra a tela no "localVideo", senão mostra a câmera
  useEffect(() => {
    if (localVideoRef.current) {
        if (isScreenSharing && screenStream) {
            localVideoRef.current.srcObject = screenStream;
        } else if (localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }
  }, [localStream, screenStream, isScreenSharing]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);


  // --- 2. SOCKET & WEBRTC LOGIC ---
  useEffect(() => {
    if (!localStream) return; // Só conecta depois de ter a mídia local

    const socket = io();
    socketRef.current = socket;

    // Join Room
    socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');

    // Ao receber aviso que outro usuário entrou (Sou o Host/Iniciador)
    socket.on('user-connected', async (userId) => {
        console.log("Usuário conectado:", userId);
        setNotification("Novo participante conectando...");
        await createOffer(userId);
    });

    // Receber Sinais (Offer, Answer, ICE)
    socket.on('signal', async (data) => {
        if (data.signal.type === 'offer') {
            await handleOffer(data.signal, data.sender);
        } else if (data.signal.type === 'answer') {
            await handleAnswer(data.signal);
        } else if (data.signal.candidate) {
            await handleIceCandidate(data.signal.candidate);
        }
    });

    socket.on('user-disconnected', () => {
        setNotification("Participante desconectou.");
        setRemoteStream(null);
        // Reiniciar conexão se necessário, ou fechar PC
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
    });

    return () => {
        socket.disconnect();
    };
  }, [localStream, isGuest]);

  // --- WEBRTC HELPER FUNCTIONS ---

  const createPeerConnection = (targetUserId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      pc.onicecandidate = (event) => {
          if (event.candidate) {
              socketRef.current?.emit('signal', {
                  target: targetUserId,
                  signal: { candidate: event.candidate }
              });
          }
      };

      pc.ontrack = (event) => {
          console.log("Recebeu track remoto");
          // Verifica se o stream já existe para não resetar
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          }
      };

      // Adiciona tracks do stream ATUAL (seja camera ou tela)
      const currentStream = isScreenSharing && screenStream ? screenStream : localStream;
      if (currentStream) {
          // Importante: Adicionar track de áudio do microfone (localStream) mesmo se estiver compartilhando tela
          // Se estiver compartilhando tela, usamos o video da tela, mas o audio do mic (geralmente)
          
          if (isScreenSharing && screenStream) {
             screenStream.getVideoTracks().forEach(track => pc.addTrack(track, screenStream));
             if (localStream) localStream.getAudioTracks().forEach(track => pc.addTrack(track, screenStream));
          } else if (localStream) {
             localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
          }
      }

      peerConnectionRef.current = pc;
      return pc;
  };

  const createOffer = async (targetUserId: string) => {
      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current?.emit('signal', {
          target: targetUserId,
          signal: offer
      });
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, senderId: string) => {
      const pc = createPeerConnection(senderId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('signal', {
          target: senderId,
          signal: answer
      });
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
      if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
      if (peerConnectionRef.current) {
          try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
              console.error("Erro ao adicionar ICE Candidate", e);
          }
      }
  };

  // --- SCREEN SHARE LOGIC ---

  const stopScreenShare = () => {
      if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
      }
      setScreenStream(null);
      setIsScreenSharing(false);

      // Reverter para a câmera no WebRTC
      if (peerConnectionRef.current && localStream) {
          const videoTrack = localStream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender && videoTrack) {
              sender.replaceTrack(videoTrack);
          }
      }
  };

  const handleScreenShare = async () => {
      if (isScreenSharing) {
          stopScreenShare();
          return;
      }

      try {
          // Solicita compartilhamento de tela
          const displayMediaOptions = {
              video: {
                  displaySurface: "browser", // Tenta priorizar, mas o user escolhe
              },
              audio: false // Geralmente queremos manter o microfone, não o áudio do sistema, para evitar eco
          };
          
          // Cast para any pois typescript as vezes reclama de getDisplayMedia em navigator
          const stream = await (navigator.mediaDevices as any).getDisplayMedia(displayMediaOptions);
          
          setScreenStream(stream);
          setIsScreenSharing(true);

          // Detecta se o usuário parou o compartilhamento pela interface nativa do navegador
          stream.getVideoTracks()[0].onended = () => {
              stopScreenShare();
          };

          // Substituir a trilha de vídeo no PeerConnection atual
          if (peerConnectionRef.current) {
              const videoTrack = stream.getVideoTracks()[0];
              const sender = peerConnectionRef.current.getSenders().find((s: RTCRtpSender) => s.track?.kind === 'video');
              if (sender) {
                  sender.replaceTrack(videoTrack);
              }
          }

      } catch (err) {
          console.error("Erro ao compartilhar tela:", err);
          setNotification("Não foi possível compartilhar a tela (Permissão negada ou não suportado).");
          setTimeout(() => setNotification(null), 3000);
      }
  };

  // --- MEDIA CONTROLS ---

  useEffect(() => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
    }
  }, [isMicOn, localStream]);

  useEffect(() => {
    if (localStream && !isScreenSharing) {
        // Só desabilita o track da câmera se NÃO estiver compartilhando tela.
        // Se estiver compartilhando tela, a câmera já não está sendo enviada pelo replaceTrack, mas mantemos o estado.
        localStream.getVideoTracks().forEach(track => track.enabled = isCameraOn);
    }
  }, [isCameraOn, localStream, isScreenSharing]);

  // --- SPEECH RECOGNITION ---
  useEffect(() => {
      isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  useEffect(() => {
      const shouldListen = isTranscribing || isRecording;
      if (shouldListen && !meetingEnded) {
          if (!('webkitSpeechRecognition' in window)) {
              if (isTranscribing) alert("Seu navegador não suporta transcrição (Use Chrome).");
              return;
          }
          const SpeechRecognition = (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'pt-BR';

          recognition.onstart = () => setIsListening(true);
          recognition.onend = () => {
              setIsListening(false);
              // Auto restart if still supposed to be listening
              if (isTranscribingRef.current) {
                  try { recognition.start(); } catch(e) {}
              }
          };

          recognition.onresult = (event: any) => {
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  if (event.results[i].isFinal) {
                      const newItem: TranscriptItem = {
                          id: `tr-${Date.now()}-${Math.random()}`,
                          speaker: isGuest ? 'Convidado' : 'Organizador',
                          text: event.results[i][0].transcript,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          isFinal: true
                      };
                      setTranscript(prev => [...prev, newItem]);
                  }
              }
          };
          try {
            recognition.start();
          } catch(e) {
              console.log("Recognition already started");
          }
          recognitionRef.current = recognition;
      } else {
          recognitionRef.current?.stop();
          setIsListening(false);
      }
      return () => {
          recognitionRef.current?.stop();
      };
  }, [isTranscribing, isRecording, meetingEnded]);

  const handleHangUp = async () => {
    // 1. Stop Media
    localStream?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    socketRef.current?.disconnect();

    // 2. Process AI if recording
    if (isGuest) {
        setMeetingEnded(true);
    } else {
        if (isRecording && transcript.length > 0) {
            setIsProcessing(true);
            try {
                const fullText = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
                const analysis = await analyzeMeeting(fullText);
                const newRecord: RecordedMeeting = {
                    id: `rec-${Date.now()}`,
                    title: "Reunião Gravada - " + new Date().toLocaleDateString(),
                    date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                    duration: "XX min",
                    participants: ["Você", "Participante"],
                    fullTranscript: transcript,
                    aiSummary: analysis.summary || "Resumo não disponível",
                    aiActionPlan: analysis.actionPlan || "Plano não disponível",
                    createdBy: 'Usuário Atual'
                };
                onSaveMeeting(newRecord);
            } catch (err) {
                console.error("Erro na análise IA", err);
                onLeave(); // Sai mesmo com erro
            } finally {
                setIsProcessing(false);
            }
        } else {
            onLeave();
        }
    }
  };

  const handleShareLink = () => {
    const inviteLink = `${window.location.origin}?guest=true`;
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  // --- RENDER ---
  
  if (isProcessing) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111623] text-white gap-4">
        <div className="relative">
            <div className="absolute inset-0 bg-[#20bbe3] blur-xl opacity-20 rounded-full animate-pulse"></div>
            <Loader2 className="animate-spin text-[#20bbe3] relative z-10" size={64} />
        </div>
        <h2 className="text-xl font-bold">Processando Reunião...</h2>
        <p className="text-slate-400 text-sm">A IA está gerando o resumo e o plano de ação.</p>
    </div>
  );
  
  if (meetingEnded) return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111623] text-white text-center p-4">
          <CheckCircle2 size={48} className="text-[#20bbe3] mb-4" />
          <h2 className="text-3xl font-bold mb-2">Reunião Encerrada</h2>
          <p className="text-slate-400">Você pode fechar esta janela.</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-[#1e2e41] rounded-lg border border-[#1687cb]/20">Entrar Novamente</button>
      </div>
  );

  const containerClass = isGuest ? "h-[100dvh] w-full p-2 sm:p-4" : "h-[calc(100vh-140px)]";

  return (
    <div className={`${containerClass} flex gap-4 animate-in fade-in duration-500 relative bg-[#111623]`}>
        {/* Toast Notification */}
        {notification && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-[#1e2e41]/90 backdrop-blur text-white px-4 py-3 rounded-xl shadow-2xl border border-[#20bbe3]/30 flex items-center gap-3 animate-in slide-in-from-top-4 w-max max-w-[90%]">
                <div className="w-2 h-2 rounded-full bg-[#20bbe3] animate-pulse"></div>
                <span className="text-sm font-medium">{notification}</span>
            </div>
        )}
        
        {linkCopied && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-[#20bbe3] text-[#111623] px-4 py-2 rounded-lg font-bold shadow-lg shadow-[#20bbe3]/30 flex items-center gap-2 animate-in slide-in-from-top-2">
                <CheckCircle2 size={18} />
                Link copiado!
            </div>
        )}

        {/* --- MAIN VIDEO AREA --- */}
        <div className="flex-1 bg-[#111623] rounded-2xl relative overflow-hidden flex flex-col shadow-2xl border border-[#1687cb]/10 group">
            <div className="flex-1 relative bg-[#0d1117] overflow-hidden w-full h-full">
                {error ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-400">
                        <VideoOff size={48} className="mb-4" />
                        <p>{error}</p>
                    </div>
                ) : (
                    <>
                        {/* 
                           ESTRATÉGIA DE VÍDEO DUAL:
                           Renderizamos DOIS elementos de vídeo fixos.
                           Controlamos apenas a visibilidade (CSS) deles.
                           Isso impede que o React desmonte o componente e perca o stream no mobile.
                        */}

                        {/* 1. REMOTE VIDEO ELEMENT */}
                        <video 
                            ref={remoteVideoRef}
                            autoPlay 
                            playsInline 
                            className={`w-full h-full object-cover transition-opacity duration-500 absolute inset-0 ${remoteStream ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                        />

                        {/* 2. LOCAL VIDEO ELEMENT (Main or PiP) */}
                        <div className={`transition-all duration-500 absolute overflow-hidden rounded-xl border border-[#1687cb]/30 shadow-2xl
                            ${remoteStream 
                                ? 'bottom-4 right-4 w-28 h-40 md:w-48 md:h-32 z-20 hover:scale-105'  // PiP Mode
                                : 'inset-0 w-full h-full z-10 border-none rounded-none' // Fullscreen Mode
                            }
                        `}>
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                playsInline
                                muted // Sempre mudo para evitar eco local
                                className={`w-full h-full object-cover ${isScreenSharing ? '' : 'transform scale-x-[-1]'}`} // Não espelhar se for tela
                            />
                            {/* Dot indicator for PiP */}
                            {remoteStream && <div className="absolute bottom-1 right-2 w-2 h-2 bg-emerald-500 rounded-full border border-black"></div>}
                        </div>

                        {/* Placeholder when waiting */}
                        {!remoteStream && !error && (
                             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 text-center pointer-events-none">
                                <div className="w-16 h-16 border-4 border-[#20bbe3] border-t-transparent rounded-full animate-spin mx-auto mb-4 opacity-50"></div>
                                <p className="text-white/70 font-medium text-lg shadow-black drop-shadow-md">Aguardando participante...</p>
                             </div>
                        )}
                    </>
                )}
                
                {/* Status Bar Overlay */}
                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs font-medium z-30 flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        {isMicOn ? <Mic size={12} className="text-emerald-400" /> : <MicOff size={12} className="text-red-400" />}
                        {isListening && <span className="text-emerald-400 animate-pulse text-[10px]">Ouvindo...</span>}
                    </div>
                    <div className="w-px h-3 bg-white/20"></div>
                    <div>
                         {remoteStream ? <span className="text-emerald-400">Conectado</span> : <span className="text-slate-300">Aguardando</span>}
                    </div>
                    {isScreenSharing && (
                         <>
                            <div className="w-px h-3 bg-white/20"></div>
                            <span className="text-[#20bbe3] flex items-center gap-1"><MonitorUp size={10} /> Sua Tela</span>
                         </>
                    )}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="h-16 sm:h-20 bg-[#1e2e41] flex items-center justify-center sm:justify-between px-4 sm:px-6 border-t border-[#1687cb]/10 relative z-30 shrink-0">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button onClick={() => setIsMicOn(!isMicOn)} className={`p-3 sm:p-4 rounded-full transition-all duration-200 shadow-lg ${isMicOn ? 'bg-[#2d3f57] hover:bg-[#3d5375] text-white' : 'bg-red-500 text-white'}`}>
                        {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>
                    <button onClick={() => setIsCameraOn(!isCameraOn)} className={`p-3 sm:p-4 rounded-full transition-all duration-200 shadow-lg ${isCameraOn ? 'bg-[#2d3f57] hover:bg-[#3d5375] text-white' : 'bg-red-500 text-white'}`}>
                        {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>
                    
                    {!isGuest && (
                        <button onClick={() => setIsRecording(!isRecording)} className={`p-3 sm:p-4 rounded-full transition-all duration-200 ${isRecording ? 'bg-white text-red-600 shadow-lg' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`}>
                            <CircleDot size={20} className={isRecording ? "animate-pulse fill-red-600" : ""} />
                        </button>
                    )}

                    <button onClick={handleScreenShare} className={`p-3 sm:p-4 rounded-full transition-all duration-200 ${isScreenSharing ? 'bg-[#20bbe3] text-[#111623] shadow-[0_0_15px_rgba(32,187,227,0.3)]' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`} title="Compartilhar Tela">
                        <MonitorUp size={20} />
                    </button>

                    <button onClick={() => setIsTranscribing(!isTranscribing)} className={`p-3 sm:p-4 rounded-full transition-all duration-200 hidden sm:flex ${isTranscribing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`}>
                        <Captions size={20} />
                    </button>

                    <button onClick={handleShareLink} className="p-3 sm:p-4 rounded-full bg-[#2d3f57] hover:bg-[#3d5375] text-white hidden sm:flex">
                        <Share size={20} />
                    </button>

                    <button onClick={handleHangUp} className="p-3 sm:p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg ml-2">
                        {isGuest ? <LogOut size={24} /> : <PhoneOff size={24} />}
                    </button>
                </div>
            </div>
        </div>

        {/* --- SIDEBAR (Desktop Only) --- */}
        <div className="w-80 bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 hidden lg:flex flex-col shadow-xl">
             <div className="flex border-b border-[#1687cb]/10 bg-[#111623]/20 rounded-t-2xl">
                <button onClick={() => setSidebarMode('PARTICIPANTS')} className={`flex-1 py-3 text-sm font-bold transition-colors ${sidebarMode === 'PARTICIPANTS' ? 'text-white border-b-2 border-[#20bbe3]' : 'text-slate-500'}`}>Participantes</button>
                <button onClick={() => setSidebarMode('TRANSCRIPT')} className={`flex-1 py-3 text-sm font-bold transition-colors ${sidebarMode === 'TRANSCRIPT' ? 'text-white border-b-2 border-[#20bbe3]' : 'text-slate-500'}`}>Transcrição</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {sidebarMode === 'PARTICIPANTS' ? (
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 p-2 bg-[#111623]/50 rounded-lg border border-[#1687cb]/10">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1687cb] to-[#2d3f57] flex items-center justify-center text-white font-bold text-sm relative">
                                {isGuest ? 'VC' : 'EU'}
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#1e2e41] rounded-full"></div>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-white">Você {isScreenSharing && '(Compartilhando)'}</p>
                                <p className="text-xs text-emerald-400">Online</p>
                            </div>
                        </div>
                        {remoteStream && (
                            <div className="flex items-center gap-3 p-2 hover:bg-[#111623]/30 rounded-lg transition-colors">
                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm relative">
                                    P
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#1e2e41] rounded-full"></div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-white">Participante</p>
                                    <p className="text-xs text-emerald-400">Conectado</p>
                                </div>
                            </div>
                        )}
                        {!remoteStream && (
                             <div className="p-4 text-center border-2 border-dashed border-[#1687cb]/10 rounded-lg mt-4">
                                <Loader2 size={24} className="mx-auto text-[#20bbe3] animate-spin mb-2" />
                                <p className="text-xs text-slate-500">Aguardando participantes...</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {transcript.length === 0 && <p className="text-center text-slate-500 text-xs mt-4">Nenhuma fala detectada ainda.</p>}
                        {transcript.map((item) => (
                            <div key={item.id} className="bg-[#111623]/50 p-2.5 rounded-lg border border-[#1687cb]/10 animate-in fade-in slide-in-from-bottom-1">
                                <p className="text-xs font-bold text-[#20bbe3] mb-1">{item.speaker} <span className="text-slate-500 font-normal">({item.timestamp})</span></p>
                                <p className="text-sm text-slate-200">{item.text}</p>
                            </div>
                        ))}
                        {isListening && <div className="text-xs text-slate-500 italic text-center animate-pulse">Ouvindo...</div>}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MeetingRoom;
