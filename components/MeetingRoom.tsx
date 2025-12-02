
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, CircleDot, Loader2, MonitorUp, LogOut, RefreshCw, Captions } from 'lucide-react';
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
  const candidatesQueue = useRef<RTCIceCandidateInit[]>([]); 

  // State
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  
  // States de Mídia
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

  // --- 1. CONFIGURAÇÃO DE VÍDEO (CRÍTICO: Forçar srcObject) ---
  // Isso garante que o vídeo não fique preto se o React renderizar novamente
  useEffect(() => {
    if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isScreenSharing]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // --- 2. INICIALIZAÇÃO DE MÍDIA ---
  useEffect(() => {
    const init = async () => {
        try {
            console.log("Solicitando mídia local...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
        } catch (err) {
            console.error("Erro ao acessar câmera/mic:", err);
            alert("Erro: Permissão de câmera/microfone necessária.");
        }
    };

    if (!meetingEnded) {
        init();
    }

    return () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [meetingEnded]);

  // --- 3. SOCKET & WEBRTC ---
  useEffect(() => {
    if (!localStream) return;

    console.log("Inicializando Socket.io...");
    const socket = io();
    socketRef.current = socket;

    socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');

    // Quando outro entra, eu (que já estou na sala) ligo para ele
    socket.on('user-connected', async (userId) => {
        console.log("Novo usuário conectado. Iniciando oferta...");
        await createOffer(userId);
    });

    socket.on('signal', async (data) => {
        if (!peerConnectionRef.current && data.signal.type === 'offer') {
             createPeerConnection(data.sender);
        }

        const pc = peerConnectionRef.current;
        if (!pc) return;

        try {
            if (data.signal.type === 'offer') {
                console.log("Recebeu Oferta");
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                processCandidateQueue(pc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('signal', { target: data.sender, signal: answer });
            
            } else if (data.signal.type === 'answer') {
                console.log("Recebeu Resposta");
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                processCandidateQueue(pc);
            
            } else if (data.signal.candidate) {
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
                } else {
                    candidatesQueue.current.push(data.signal.candidate);
                }
            }
        } catch (error) {
            console.error("Erro no processamento de sinal:", error);
        }
    });

    socket.on('user-disconnected', () => {
        setRemoteStream(null);
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
    });

    // Se entramos depois, avisamos que estamos prontos
    socket.emit('ready', roomId);

    return () => {
        socket.disconnect();
    };
  }, [localStream]);

  const processCandidateQueue = async (pc: RTCPeerConnection) => {
      while (candidatesQueue.current.length > 0) {
          const candidate = candidatesQueue.current.shift();
          if (candidate) {
              try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
          }
      }
  };

  const createPeerConnection = (targetUserId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      if (localStream) {
          localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
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
          console.log("Stream remoto recebido!", event.streams[0]);
          setRemoteStream(event.streams[0]);
      };

      // Failsafe para reconexão
      pc.onconnectionstatechange = () => {
          console.log("Estado da conexão:", pc.connectionState);
          if (pc.connectionState === 'failed') {
             // Tentar reiniciar ICE se falhar
             pc.restartIce();
          }
      };

      peerConnectionRef.current = pc;
      return pc;
  };

  const createOffer = async (targetUserId: string) => {
      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('signal', { target: targetUserId, signal: offer });
  };

  // --- 4. COMPARTILHAMENTO DE TELA ---
  const handleScreenShare = async () => {
    if (isScreenSharing) {
        stopScreenShare();
        return;
    }

    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = displayStream.getVideoTracks()[0];

        // Atualiza local
        setLocalStream(displayStream);

        // Substitui trilha para o remoto
        if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            
            if (videoSender) {
                videoSender.replaceTrack(screenTrack);
            } else {
                // Se não achou sender (bug raro), adiciona a track
                peerConnectionRef.current.addTrack(screenTrack, displayStream);
            }
        }

        screenTrack.onended = () => stopScreenShare();
        setIsScreenSharing(true);
    } catch (err) {
        console.error("Erro compartilhamento:", err);
    }
  };

  const stopScreenShare = async () => {
      try {
          // Pega câmera de volta
          const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const videoTrack = cameraStream.getVideoTracks()[0];

          setLocalStream(cameraStream); // Atualiza local

          // Atualiza remoto
          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            if (videoSender) videoSender.replaceTrack(videoTrack);
          }
      } catch (e) { console.error(e); }
      setIsScreenSharing(false);
  };

  // --- 5. CONTROLES DE MÍDIA ---
  const toggleMic = () => {
      if (localStream) {
          localStream.getAudioTracks().forEach(t => t.enabled = !isMicOn);
          setIsMicOn(!isMicOn);
      }
  };

  const toggleCamera = () => {
      if (localStream) {
          localStream.getVideoTracks().forEach(t => t.enabled = !isCameraOn);
          setIsCameraOn(!isCameraOn);
      }
  };

  const handleLeave = () => {
      localStream?.getTracks().forEach(t => t.stop());
      socketRef.current?.disconnect();
      onLeave();
  };

  // --- 6. RENDERIZAÇÃO ---
  // Se estiver processando IA
  if (isProcessing) return <div className="h-screen flex items-center justify-center bg-[#111623] text-white flex-col gap-4"><Loader2 className="animate-spin text-[#20bbe3]" size={48} /><p>Processando Resumo com IA...</p></div>;

  return (
    <div className={`flex gap-4 bg-[#111623] relative ${isGuest ? 'h-[100dvh] p-2' : 'h-[calc(100vh-140px)]'}`}>
        
        {/* ÁREA PRINCIPAL DE VÍDEO */}
        <div className="flex-1 bg-black rounded-2xl relative overflow-hidden flex flex-col border border-[#1687cb]/10">
            
            {/* VÍDEO REMOTO (O OUTRO) */}
            {remoteStream ? (
                <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                />
            ) : (
                // Tela de espera
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0 bg-[#111623]">
                    <Loader2 size={48} className="animate-spin mb-4 text-[#20bbe3]" />
                    <p>Aguardando participante...</p>
                    <p className="text-xs text-slate-600 mt-2">Envie o link ou aguarde a conexão.</p>
                </div>
            )}

            {/* VÍDEO LOCAL (EU) - PiP */}
            <div className={`absolute bottom-4 right-4 w-32 h-48 md:w-48 md:h-36 bg-[#1e2e41] rounded-xl border border-slate-700 overflow-hidden shadow-2xl z-20 transition-all hover:scale-105`}>
                 <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`w-full h-full object-cover ${isScreenSharing ? '' : 'scale-x-[-1]'}`} 
                 />
                 {!isCameraOn && !isScreenSharing && (
                     <div className="absolute inset-0 flex items-center justify-center bg-[#111623] text-slate-500">
                         <VideoOff size={24} />
                     </div>
                 )}
                 <div className="absolute bottom-1 left-2 text-[10px] bg-black/60 px-2 rounded text-white font-bold">
                    {isScreenSharing ? 'Sua Tela' : 'Você'}
                 </div>
            </div>

            {/* BARRA DE CONTROLES */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1e2e41]/90 backdrop-blur p-3 rounded-full border border-[#1687cb]/20 z-30 shadow-xl">
                 <button onClick={toggleMic} className={`p-3 rounded-full ${isMicOn ? 'bg-[#2d3f57] text-white' : 'bg-red-500 text-white'}`}>
                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                 </button>
                 <button onClick={toggleCamera} className={`p-3 rounded-full ${isCameraOn ? 'bg-[#2d3f57] text-white' : 'bg-red-500 text-white'}`}>
                    {isCameraOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
                 </button>
                 {!isGuest && (
                    <button onClick={() => setIsRecording(!isRecording)} className={`p-3 rounded-full ${isRecording ? 'bg-white text-red-600' : 'bg-[#2d3f57] text-white'}`}>
                        <CircleDot size={20} className={isRecording ? "animate-pulse fill-red-600" : ""} />
                    </button>
                 )}
                 <button onClick={handleScreenShare} className={`p-3 rounded-full ${isScreenSharing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] text-white'}`} title="Compartilhar Tela">
                    <MonitorUp size={20} />
                 </button>
                 <button onClick={handleLeave} className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 ml-2">
                    <LogOut size={20} />
                 </button>
            </div>
        </div>

        {/* SIDEBAR (Desktop) */}
        <div className="hidden lg:flex flex-col w-80 bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 overflow-hidden">
             <div className="p-4 bg-[#111623]/30 border-b border-[#1687cb]/20">
                 <h3 className="font-bold text-white">Participantes</h3>
             </div>
             <div className="p-4 space-y-4">
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-[#20bbe3] flex items-center justify-center text-[#111623] font-bold">EU</div>
                     <div>
                         <p className="text-sm font-bold text-white">Você</p>
                         <p className="text-xs text-emerald-400">Online</p>
                     </div>
                 </div>
                 {remoteStream && (
                     <div className="flex items-center gap-3 animate-in fade-in">
                         <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">P</div>
                         <div>
                             <p className="text-sm font-bold text-white">{isGuest ? 'Organizador' : 'Convidado'}</p>
                             <p className="text-xs text-emerald-400">Conectado</p>
                         </div>
                     </div>
                 )}
             </div>
        </div>
    </div>
  );
};

export default MeetingRoom;
