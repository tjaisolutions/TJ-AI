
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Share, Captions, CircleDot, Loader2, MonitorUp, CheckCircle2, LogOut, RefreshCw } from 'lucide-react';
import { RecordedMeeting, TranscriptItem } from '../types';
import { analyzeMeeting } from '../services/geminiService';
import { io, Socket } from 'socket.io-client';

interface MeetingRoomProps {
    onLeave: () => void;
    onSaveMeeting: (meeting: RecordedMeeting) => void;
    isGuest?: boolean;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

const MeetingRoom: React.FC<MeetingRoomProps> = ({ onLeave, onSaveMeeting, isGuest = false }) => {
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const candidatesQueue = useRef<RTCIceCandidateInit[]>([]); // Queue for ICE candidates to prevent race conditions

  // State
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'waiting'>('waiting');
  const [notification, setNotification] = useState<string | null>(null);
  
  // Media Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  // Tools
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'PARTICIPANTS' | 'TRANSCRIPT'>('PARTICIPANTS');
  const recognitionRef = useRef<any>(null);

  const roomId = 'sala-padrao-tj';

  // --- 1. INITIALIZATION: Get Local Media ---
  useEffect(() => {
    const init = async () => {
        try {
            console.log("Solicitando mídia local...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Erro ao acessar câmera/mic:", err);
            setNotification("Erro: Permissão de câmera/microfone necessária.");
        }
    };

    if (!meetingEnded) {
        init();
    }

    return () => {
        // Cleanup media on unmount
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [meetingEnded]);

  // --- 2. SOCKET & WEBRTC CONNECTION ---
  useEffect(() => {
    // Only connect if we have local stream
    if (!localStream) return;

    console.log("Inicializando Socket.io...");
    const socket = io();
    socketRef.current = socket;

    socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');

    // Event Listeners
    socket.on('user-connected', async (userId) => {
        console.log("Novo usuário conectado:", userId);
        setConnectionStatus('connecting');
        setNotification("Usuário entrou. Conectando...");
        await createOffer(userId);
    });

    // Listener especial para atualizar o vídeo quando o outro compartilha tela
    socket.on('screen-toggle', (isSharing: boolean) => {
        console.log("Outro usuário alternou compartilhamento de tela:", isSharing);
        // Truque para forçar o navegador a recalibrar o decodificador de vídeo
        // Isso resolve a tela preta ao mudar de resolução (câmera -> tela)
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
            const currentStream = remoteVideoRef.current.srcObject;
            remoteVideoRef.current.srcObject = null;
            setTimeout(() => {
                 if (remoteVideoRef.current) {
                     remoteVideoRef.current.srcObject = currentStream;
                     remoteVideoRef.current.play().catch(console.error);
                 }
            }, 100);
        }
    });

    socket.on('signal', async (data) => {
        if (!peerConnectionRef.current && data.signal.type === 'offer') {
             // If receiving an offer and no PC exists, create one (Responder)
             createPeerConnection(data.sender);
        }

        const pc = peerConnectionRef.current;
        if (!pc) return;

        if (data.signal.type === 'offer') {
            console.log("Recebeu Oferta");
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            
            // Process queued candidates
            processCandidateQueue(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal', { target: data.sender, signal: answer });
        
        } else if (data.signal.type === 'answer') {
            console.log("Recebeu Resposta");
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            processCandidateQueue(pc);
            setConnectionStatus('connected');
        
        } else if (data.signal.candidate) {
            console.log("Recebeu ICE Candidate");
            if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            } else {
                // Queue candidate if remote description is not set yet
                candidatesQueue.current.push(data.signal.candidate);
            }
        }
    });

    socket.on('user-disconnected', () => {
        console.log("Usuário desconectou");
        setNotification("Usuário saiu da sala.");
        closeConnection();
    });

    // Send "ready" signal to ensure other peers know we are here if we joined late
    socket.emit('ready', roomId);

    return () => {
        socket.disconnect();
        closeConnection();
    };
  }, [localStream, isGuest]);

  const closeConnection = () => {
      if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
      }
      setRemoteStream(null);
      setConnectionStatus('disconnected');
  };

  const processCandidateQueue = async (pc: RTCPeerConnection) => {
      while (candidatesQueue.current.length > 0) {
          const candidate = candidatesQueue.current.shift();
          if (candidate) {
              try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                  console.error("Erro ao processar ICE candidate da fila", e);
              }
          }
      }
  };

  const createPeerConnection = (targetUserId: string) => {
      console.log("Criando PeerConnection...");
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add Local Tracks
      if (localStream) {
          localStream.getTracks().forEach(track => {
              pc.addTrack(track, localStream);
          });
      }

      pc.onicecandidate = (event) => {
          if (event.candidate) {
              socketRef.current?.emit('signal', {
                  target: targetUserId,
                  signal: { candidate: event.candidate }
              });
          }
      };

      pc.ontrack = (event) => {
          console.log("Stream remoto recebido!");
          setRemoteStream(event.streams[0]);
          setConnectionStatus('connected');
          if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
          }
      };

      pc.onconnectionstatechange = () => {
          console.log("Connection State:", pc.connectionState);
          if (pc.connectionState === 'connected') setConnectionStatus('connected');
          if (pc.connectionState === 'disconnected') setConnectionStatus('disconnected');
          if (pc.connectionState === 'failed') setConnectionStatus('disconnected');
      };

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

  // --- 3. SCREEN SHARE ---
  const handleScreenShare = async () => {
    // Se já estiver compartilhando, parar
    if (isScreenSharing) {
        stopScreenShare();
        return;
    }

    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: {
                // Tenta forçar uma resolução padrão para evitar incompatibilidades extremas
                // embora o navegador geralmente gerencie isso.
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 15 }
            }, 
            audio: false 
        });
        const screenTrack = displayStream.getVideoTracks()[0];

        // 1. Atualizar visualização local
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = displayStream;
        }

        // 2. Substituir track no WebRTC (enviar para o outro)
        if (peerConnectionRef.current) {
            const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                console.log("Substituindo track de vídeo por tela...");
                await sender.replaceTrack(screenTrack);
                
                // Avisa o socket para o outro atualizar o player
                socketRef.current?.emit('screen-toggle', { roomId, isSharing: true });
            }
        }

        // Listener para quando o usuário clica em "Parar" na barra do navegador
        screenTrack.onended = () => {
            stopScreenShare();
        };

        setIsScreenSharing(true);
    } catch (err) {
        console.error("Erro ao compartilhar tela:", err);
    }
  };

  const stopScreenShare = async () => {
      try {
          // Recuperar stream da câmera
          let cameraStream = localStream;
          
          // Verifica se o track de vídeo do localStream ainda está ativo
          // Se o usuário parou a câmera antes, ou se o navegador matou o track, pegamos um novo
          const videoTrack = localStream?.getVideoTracks()[0];
          if (!videoTrack || videoTrack.readyState === 'ended') {
              console.log("Reiniciando câmera...");
              cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              setLocalStream(cameraStream);
          }

          const cameraTrackToUse = cameraStream?.getVideoTracks()[0];

          // Volta o preview local para a câmera
          if (localVideoRef.current && cameraStream) {
              localVideoRef.current.srcObject = cameraStream;
          }

          // Substitui o track no WebRTC
          if (peerConnectionRef.current && cameraTrackToUse) {
              const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
              if (sender) {
                  console.log("Voltando para track de câmera...");
                  await sender.replaceTrack(cameraTrackToUse);
                  // Avisa o socket para o outro atualizar o player
                  socketRef.current?.emit('screen-toggle', { roomId, isSharing: false });
              }
          }
      } catch (e) {
          console.error("Erro ao voltar para câmera:", e);
      }

      setIsScreenSharing(false);
  };

  // --- 4. MEDIA CONTROLS ---
  useEffect(() => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
        localStream.getVideoTracks().forEach(track => {
            // Se estiver compartilhando tela, não queremos desativar o track da tela com o botão da câmera
            // Mas se estiver usando a câmera, obedecemos o botão.
            if (!isScreenSharing) {
                track.enabled = isCameraOn;
            }
        });
    }
  }, [isMicOn, isCameraOn, localStream, isScreenSharing]);

  // --- 5. TRANSCRIPTION & AI ---
  // (Mantido igual, simplificado para foco no WebRTC)
  useEffect(() => {
    if ((isTranscribing || isRecording) && !meetingEnded) {
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'pt-BR';
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onresult = (event: any) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        const newItem: TranscriptItem = {
                            id: Date.now().toString(),
                            speaker: isGuest ? 'Convidado' : 'Organizador',
                            text: event.results[i][0].transcript,
                            timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                            isFinal: true
                        };
                        setTranscript(prev => [...prev, newItem]);
                    }
                }
            };
            try { recognition.start(); } catch(e) {}
            recognitionRef.current = recognition;
        }
    } else {
        recognitionRef.current?.stop();
    }
    return () => recognitionRef.current?.stop();
  }, [isTranscribing, isRecording]);

  const handleLeave = async () => {
    // 1. Stop Tracks
    localStream?.getTracks().forEach(track => track.stop());
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    
    // 2. Process AI
    if (isRecording && transcript.length > 0 && !isGuest) {
        setIsProcessing(true);
        try {
            const text = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
            const analysis = await analyzeMeeting(text);
            const record: RecordedMeeting = {
                id: `rec-${Date.now()}`,
                title: "Reunião Gravada",
                date: new Date().toLocaleDateString(),
                duration: "XX min",
                participants: ["Você", "Convidado"],
                fullTranscript: transcript,
                aiSummary: analysis.summary,
                aiActionPlan: analysis.actionPlan
            };
            onSaveMeeting(record);
        } catch (e) {
            console.error(e);
            onLeave();
        } finally {
            setIsProcessing(false);
        }
    } else {
        onLeave();
    }
  };

  const handleRetryConnection = () => {
      socketRef.current?.emit('join-room', roomId, isGuest ? 'guest' : 'host');
      setNotification("Tentando reconectar...");
  };

  // --- RENDER ---
  if (isProcessing) return <div className="h-screen flex items-center justify-center bg-[#111623] text-white flex-col gap-4"><Loader2 className="animate-spin text-[#20bbe3]" size={48} /><p>Processando Resumo com IA...</p></div>;

  return (
    <div className={`flex gap-4 bg-[#111623] relative ${isGuest ? 'h-[100dvh] p-2' : 'h-[calc(100vh-140px)]'}`}>
        
        {/* Notification Toast */}
        {notification && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1e2e41] text-white px-4 py-2 rounded-lg shadow-lg border border-[#20bbe3]/30 animate-in slide-in-from-top-2 text-sm">
                {notification}
            </div>
        )}

        {/* --- MAIN VIDEO AREA --- */}
        <div className="flex-1 bg-black rounded-2xl relative overflow-hidden flex flex-col border border-[#1687cb]/10">
            {/* Remote Video (Full Size) */}
            <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-cover ${connectionStatus === 'connected' ? 'opacity-100' : 'opacity-0'}`}
            />
            
            {/* Placeholder if waiting */}
            {connectionStatus !== 'connected' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0">
                    <Loader2 size={48} className="animate-spin mb-4 text-[#20bbe3]" />
                    <p>Aguardando participante...</p>
                    <button onClick={handleRetryConnection} className="mt-4 px-4 py-2 bg-[#1e2e41] rounded-lg text-xs hover:bg-[#20bbe3]/20 flex items-center gap-2">
                        <RefreshCw size={14} /> Tentar Reconectar
                    </button>
                </div>
            )}

            {/* Local Video (PiP) */}
            <div className={`absolute bottom-4 right-4 w-32 h-48 md:w-48 md:h-36 bg-[#111623] rounded-xl border border-slate-700 overflow-hidden shadow-2xl transition-all z-20 hover:scale-105 ${connectionStatus === 'connected' ? '' : 'w-full h-full inset-0 border-none rounded-none'}`}>
                 <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`w-full h-full object-cover ${isScreenSharing ? '' : 'scale-x-[-1]'}`}
                 />
                 <div className="absolute bottom-2 left-2 text-[10px] bg-black/50 px-2 py-0.5 rounded text-white font-bold">
                    {isScreenSharing ? 'Sua Tela' : 'Você'}
                 </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1e2e41]/90 backdrop-blur p-3 rounded-full border border-[#1687cb]/20 z-30 shadow-xl">
                 <button onClick={() => setIsMicOn(!isMicOn)} className={`p-3 rounded-full ${isMicOn ? 'bg-[#2d3f57] text-white' : 'bg-red-500 text-white'}`}>
                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                 </button>
                 <button onClick={() => setIsCameraOn(!isCameraOn)} className={`p-3 rounded-full ${isCameraOn ? 'bg-[#2d3f57] text-white' : 'bg-red-500 text-white'}`}>
                    {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                 </button>
                 {!isGuest && (
                    <button onClick={() => setIsRecording(!isRecording)} className={`p-3 rounded-full ${isRecording ? 'bg-white text-red-600' : 'bg-[#2d3f57] text-white'}`}>
                        <CircleDot size={20} className={isRecording ? "animate-pulse fill-red-600" : ""} />
                    </button>
                 )}
                 <button onClick={handleScreenShare} className={`p-3 rounded-full ${isScreenSharing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] text-white'}`} title="Compartilhar Tela">
                    <MonitorUp size={20} />
                 </button>
                 <button onClick={() => setIsTranscribing(!isTranscribing)} className={`p-3 rounded-full hidden sm:block ${isTranscribing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] text-white'}`}>
                    <Captions size={20} />
                 </button>
                 <button onClick={handleLeave} className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 ml-2">
                    <LogOut size={20} />
                 </button>
            </div>
        </div>

        {/* Sidebar (Participants/Transcript) - Desktop Only */}
        <div className="hidden lg:flex flex-col w-80 bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 overflow-hidden">
             <div className="flex border-b border-[#1687cb]/20">
                <button onClick={() => setSidebarMode('PARTICIPANTS')} className={`flex-1 py-3 text-xs font-bold ${sidebarMode === 'PARTICIPANTS' ? 'text-[#20bbe3] bg-[#111623]/30' : 'text-slate-400'}`}>PARTICIPANTES</button>
                <button onClick={() => setSidebarMode('TRANSCRIPT')} className={`flex-1 py-3 text-xs font-bold ${sidebarMode === 'TRANSCRIPT' ? 'text-[#20bbe3] bg-[#111623]/30' : 'text-slate-400'}`}>TRANSCRIÇÃO</button>
             </div>
             <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
                 {sidebarMode === 'PARTICIPANTS' ? (
                     <>
                        <div className="flex items-center gap-3 p-2 bg-[#111623]/30 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-[#20bbe3] flex items-center justify-center text-[#111623] font-bold">EU</div>
                            <div>
                                <p className="text-sm font-bold text-white">Você</p>
                                <p className="text-xs text-emerald-400">Online</p>
                            </div>
                        </div>
                        {connectionStatus === 'connected' && (
                            <div className="flex items-center gap-3 p-2 bg-[#111623]/30 rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">P</div>
                                <div>
                                    <p className="text-sm font-bold text-white">{isGuest ? 'Organizador' : 'Convidado'}</p>
                                    <p className="text-xs text-emerald-400">Conectado</p>
                                </div>
                            </div>
                        )}
                     </>
                 ) : (
                     <div className="space-y-3">
                         {transcript.map(t => (
                             <div key={t.id} className="bg-[#111623]/50 p-2 rounded-lg border border-[#1687cb]/10">
                                 <p className="text-xs font-bold text-[#20bbe3] mb-1">{t.speaker}</p>
                                 <p className="text-sm text-slate-300">{t.text}</p>
                             </div>
                         ))}
                         {isListening && <p className="text-xs text-slate-500 italic animate-pulse">Ouvindo...</p>}
                     </div>
                 )}
             </div>
        </div>
    </div>
  );
};

export default MeetingRoom;
