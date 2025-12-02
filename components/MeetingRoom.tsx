import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Share, Captions, CircleDot, Loader2, RefreshCw, UserPlus, CheckCircle2, LogOut } from 'lucide-react';
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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
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

  // --- 1. SETUP LOCAL MEDIA ---
  useEffect(() => {
    const startLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        } catch (err: any) {
            console.error("Erro ao acessar mídia:", err);
            setError("Não foi possível acessar câmera ou microfone. Verifique as permissões.");
        }
    };

    if (!meetingEnded) {
        startLocalStream();
    }

    return () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [meetingEnded]);

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
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
          }
      };

      if (localStream) {
          localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
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

  // --- MEDIA CONTROLS ---

  useEffect(() => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
    }
  }, [isMicOn, localStream]);

  useEffect(() => {
    if (localStream) {
        localStream.getVideoTracks().forEach(track => track.enabled = isCameraOn);
    }
  }, [isCameraOn, localStream]);

  // --- SPEECH RECOGNITION (Keep Existing Logic) ---
  useEffect(() => {
      isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  useEffect(() => {
      const shouldListen = isTranscribing || isRecording;
      if (shouldListen && !meetingEnded) {
          if (!('webkitSpeechRecognition' in window)) return;
          const SpeechRecognition = (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'pt-BR';

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
          recognition.start();
          recognitionRef.current = recognition;
      } else {
          recognitionRef.current?.stop();
      }
      return () => recognitionRef.current?.stop();
  }, [isTranscribing, isRecording, meetingEnded]);

  const handleHangUp = async () => {
    localStream?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    socketRef.current?.disconnect();

    if (isGuest) {
        setMeetingEnded(true);
    } else {
        // Host Saving Logic
        if (isRecording && transcript.length > 0) {
            setIsProcessing(true);
            const fullText = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
            const analysis = await analyzeMeeting(fullText);
            const newRecord: RecordedMeeting = {
                id: `rec-${Date.now()}`,
                title: "Reunião Gravada - " + new Date().toLocaleDateString(),
                date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                duration: "XX min",
                participants: ["Você", "Participante"],
                fullTranscript: transcript,
                aiSummary: analysis.summary,
                aiActionPlan: analysis.actionPlan,
                createdBy: 'Usuário Atual'
            };
            onSaveMeeting(newRecord);
            setIsProcessing(false);
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
  
  if (isProcessing) return <div className="h-screen w-full flex items-center justify-center bg-[#111623] text-white"><Loader2 className="animate-spin mb-2" /> Processando IA...</div>;
  
  if (meetingEnded) return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111623] text-white text-center p-4">
          <CheckCircle2 size={48} className="text-[#20bbe3] mb-4" />
          <h2 className="text-3xl font-bold mb-2">Reunião Encerrada</h2>
          <p className="text-slate-400">Você pode fechar esta janela.</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-[#1e2e41] rounded-lg">Entrar Novamente</button>
      </div>
  );

  const containerClass = isGuest ? "h-screen w-full p-4" : "h-[calc(100vh-140px)]";

  return (
    <div className={`${containerClass} flex gap-4 animate-in fade-in duration-500 relative bg-[#111623]`}>
        {/* Toast */}
        {notification && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-[#1e2e41] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#20bbe3]/30 flex items-center gap-3 animate-in slide-in-from-top-4">
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

        {/* Video Area */}
        <div className="flex-1 bg-[#111623] rounded-2xl relative overflow-hidden flex flex-col shadow-2xl border border-[#1687cb]/10 group">
            <div className="flex-1 relative bg-[#0d1117] overflow-hidden">
                {error ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-400">
                        <VideoOff size={48} className="mb-4" />
                        <p>{error}</p>
                    </div>
                ) : (
                    <>
                        {/* MAIN VIDEO (Mostra o REMOTO se existir, senão mostra o LOCAL) */}
                        <video 
                            ref={remoteStream ? remoteVideoRef : localVideoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover transform scale-x-[-1]" 
                        />

                        {/* PIP VIDEO (Mostra o LOCAL se o remoto estiver na tela principal) */}
                        {remoteStream && (
                            <div className="absolute bottom-4 right-4 w-32 h-48 md:w-48 md:h-32 bg-[#1e2e41] rounded-xl border border-[#1687cb]/30 overflow-hidden shadow-2xl z-20">
                                <video 
                                    ref={localVideoRef} 
                                    autoPlay 
                                    muted 
                                    playsInline 
                                    className="w-full h-full object-cover transform scale-x-[-1]" 
                                />
                                <div className="absolute bottom-1 right-2 w-2 h-2 bg-emerald-500 rounded-full border border-black"></div>
                            </div>
                        )}
                    </>
                )}
                
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded text-white text-sm font-medium z-10 flex items-center gap-2">
                    {isMicOn ? <Mic size={14} className="text-emerald-400" /> : <MicOff size={14} className="text-red-400" />}
                    {remoteStream ? "Chamada em Andamento" : "Aguardando Participante..."}
                </div>
            </div>

            {/* Controls */}
            <div className="h-20 bg-[#1e2e41] flex items-center justify-between px-6 border-t border-[#1687cb]/10 relative z-20 shrink-0">
                <div className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
                    <button onClick={() => setIsMicOn(!isMicOn)} className={`p-4 rounded-full transition-all duration-200 shadow-lg ${isMicOn ? 'bg-[#2d3f57] hover:bg-[#3d5375] text-white' : 'bg-red-500 text-white'}`}>
                        {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>
                    <button onClick={() => setIsCameraOn(!isCameraOn)} className={`p-4 rounded-full transition-all duration-200 shadow-lg ${isCameraOn ? 'bg-[#2d3f57] hover:bg-[#3d5375] text-white' : 'bg-red-500 text-white'}`}>
                        {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>
                    
                    {!isGuest && (
                        <button onClick={() => setIsRecording(!isRecording)} className={`p-4 rounded-full transition-all duration-200 ${isRecording ? 'bg-white text-red-600 shadow-lg' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`}>
                            <CircleDot size={20} className={isRecording ? "animate-pulse fill-red-600" : ""} />
                        </button>
                    )}

                    <button onClick={() => setIsTranscribing(!isTranscribing)} className={`p-4 rounded-full transition-all duration-200 hidden sm:flex ${isTranscribing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`}>
                        <Captions size={20} />
                    </button>

                    <button onClick={handleShareLink} className="p-4 rounded-full bg-[#2d3f57] hover:bg-[#3d5375] text-white hidden sm:flex">
                        <Share size={20} />
                    </button>

                    <button onClick={handleHangUp} className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg">
                        {isGuest ? <LogOut size={24} /> : <PhoneOff size={24} />}
                    </button>
                </div>
            </div>
        </div>

        {/* Sidebar */}
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
                                <p className="text-sm font-bold text-white">Você</p>
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
                        {transcript.map((item) => (
                            <div key={item.id} className="bg-[#111623]/50 p-2.5 rounded-lg border border-[#1687cb]/10">
                                <p className="text-xs font-bold text-[#20bbe3] mb-1">{item.speaker} <span className="text-slate-500 font-normal">({item.timestamp})</span></p>
                                <p className="text-sm text-slate-200">{item.text}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MeetingRoom;
