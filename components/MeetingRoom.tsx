
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Loader2, MonitorUp, LogOut, BrainCircuit, Signal, AlertTriangle } from 'lucide-react';
import { RecordedMeeting } from '../types';
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
  const roomId = 'sala-padrao-tj';

  // --- REFS ---
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Usamos callbacks refs para garantir que o elemento de vídeo seja capturado corretamente após remontagem
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
  const isNegotiating = useRef(false);

  // --- STATE ---
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null); // State para forçar render do local
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // --- HELPER: Attach Stream to Video ---
  // Este hook garante que sempre que o elemento de vídeo ou o stream mudarem, a atribuição é feita
  const updateVideoSource = (videoEl: HTMLVideoElement | null, stream: MediaStream | null) => {
      if (videoEl && stream) {
          if (videoEl.srcObject !== stream) {
              console.log(`🎥 [Video] Atribuindo stream ${stream.id} ao elemento de vídeo`);
              videoEl.srcObject = stream;
              videoEl.play().catch(e => console.error("Erro autoplay:", e));
          }
      } else if (videoEl) {
          videoEl.srcObject = null;
      }
  };

  // --- 1. INICIALIZAÇÃO ---
  useEffect(() => {
    const init = async () => {
      try {
        console.log("📷 [Init] Solicitando mídia...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream); // Atualiza state para renderizar
        
        connectSocket();
      } catch (error) {
        console.error("Erro ao acessar mídia:", error);
        alert("Erro: Permita acesso à câmera e microfone para entrar na reunião.");
      }
    };

    init();

    return () => {
      console.log("🧹 [Cleanup] Limpando recursos...");
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  // Monitora mudanças no stream remoto para atualizar o vídeo
  useEffect(() => {
      updateVideoSource(remoteVideoRef.current, remoteStream);
  }, [remoteStream]);

  // Monitora mudanças no stream local para atualizar o vídeo
  useEffect(() => {
      updateVideoSource(localVideoRef.current, localStream);
  }, [localStream]);


  // --- 2. SOCKET & WEBRTC ---
  const connectSocket = () => {
    if (socketRef.current) return;

    console.log("🔌 [Socket] Conectando...");
    const socket = io();
    socketRef.current = socket;

    socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');

    socket.on('user-connected', (userId) => {
      console.log("👋 [Socket] Novo usuário entrou:", userId);
      setTimeout(() => startNegotiation(), 1500); // Delay maior para estabilidade mobile
    });

    socket.on('signal', async (data) => {
      await handleSignalMessage(data);
    });

    socket.on('screen-toggle', (isRemoteSharing) => {
       console.log("📺 [Socket] Remote screen sharing:", isRemoteSharing);
       // Força um re-render do componente para garantir que o vídeo remoto se ajuste
       if (remoteStream) {
           // Hack para forçar o navegador a recalcular o layout do vídeo
           const tracks = remoteStream.getVideoTracks();
           if (tracks.length > 0) {
               tracks[0].enabled = false;
               setTimeout(() => { tracks[0].enabled = true; }, 100);
           }
       }
    });

    socket.on('user-disconnected', () => {
      console.log("❌ [Socket] Usuário saiu");
      setRemoteStream(null);
      setConnectionState('disconnected');
      if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
      }
    });
    
    socket.emit('ready', roomId);
  };

  const getPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    console.log("🛠️ [WebRTC] Criando RTCPeerConnection");
    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('signal', {
          roomId,
          signal: { candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("📡 [WebRTC] Track remoto recebido:", event.track.kind);
      // Sempre pega o primeiro stream
      if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
      } else {
          // Fallback se não vier no array streams (comum em alguns navegadores)
          const newStream = new MediaStream();
          newStream.addTrack(event.track);
          setRemoteStream(newStream);
      }
      setConnectionState('connected');
    };

    pc.onconnectionstatechange = () => {
       console.log("Stats WebRTC:", pc.connectionState);
       setConnectionState(pc.connectionState);
       if (pc.connectionState === 'failed') {
           pc.restartIce();
       }
    };

    pcRef.current = pc;
    return pc;
  };

  const startNegotiation = async () => {
     if (isNegotiating.current) return;
     isNegotiating.current = true;

     const pc = getPeerConnection();
     try {
         const offer = await pc.createOffer();
         await pc.setLocalDescription(offer);
         console.log("📤 [WebRTC] Enviando Oferta");
         socketRef.current?.emit('signal', { 
             roomId,
             signal: pc.localDescription 
         });
     } catch (err) {
         console.error("Erro na negociação:", err);
     } finally {
         isNegotiating.current = false;
     }
  };

  const handleSignalMessage = async (data: any) => {
    const { signal, sender } = data;
    if (socketRef.current && sender === socketRef.current.id) return;

    const pc = getPeerConnection();

    try {
        if (signal.type === 'offer') {
            console.log("📥 [WebRTC] Oferta recebida");
            if (pc.signalingState !== "stable") {
                await Promise.all([
                    pc.setLocalDescription({type: "rollback"}),
                    pc.setRemoteDescription(new RTCSessionDescription(signal))
                ]);
            } else {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
            }
            
            processIceQueue(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketRef.current?.emit('signal', { 
                roomId,
                target: sender, 
                signal: pc.localDescription 
            });

        } else if (signal.type === 'answer') {
            console.log("📥 [WebRTC] Resposta recebida");
            if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                processIceQueue(pc);
            }

        } else if (signal.candidate) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } else {
                iceCandidatesQueue.current.push(new RTCIceCandidate(signal.candidate));
            }
        }
    } catch (error) {
        console.error("Erro fatal processando sinal:", error);
    }
  };

  const processIceQueue = async (pc: RTCPeerConnection) => {
      while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) await pc.addIceCandidate(candidate).catch(e => console.error(e));
      }
  };

  // --- COMPARTILHAMENTO DE TELA ---
  const handleScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (!isScreenSharing) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Substitui o track de vídeo enviado
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            
            if (videoSender) {
                await videoSender.replaceTrack(screenTrack);
                
                // Atualiza localmente
                localStreamRef.current = screenStream;
                setLocalStream(screenStream); // Força update do DOM
                
                screenTrack.onended = () => stopScreenShare();
                setIsScreenSharing(true);
                socketRef.current?.emit('screen-toggle', { roomId, isSharing: true });
                
                // Força renegociação para garantir que resoluções sejam aceitas
                setTimeout(() => startNegotiation(), 500);
            }
        } catch (err) { console.error("Erro screen share:", err); }
    } else {
        stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    
    try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const camTrack = camStream.getVideoTracks()[0];
        
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');

        if (videoSender) await videoSender.replaceTrack(camTrack);
        
        localStreamRef.current = camStream;
        setLocalStream(camStream); // Força update do DOM
        
        setIsScreenSharing(false);
        socketRef.current?.emit('screen-toggle', { roomId, isSharing: false });
        
        // Garante que o audio/video esteja no estado correto
        if (!isMicOn) toggleMic(); 
        if (!isCameraOn) toggleCamera();

    } catch(e) { console.error("Erro stop screen:", e); }
  };

  // --- CONTROLES DE MÍDIA ---
  const toggleMic = () => {
      if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !isMicOn);
          setIsMicOn(!isMicOn);
      }
  };
  const toggleCamera = () => {
      if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !isCameraOn);
          setIsCameraOn(!isCameraOn);
      }
  };

  return (
    <div className={`flex gap-4 bg-[#111623] relative ${isGuest ? 'h-[100dvh] p-2' : 'h-[calc(100vh-140px)]'}`}>
        <div className="flex-1 bg-black rounded-2xl relative overflow-hidden flex flex-col border border-[#1687cb]/10 shadow-2xl">
            {/* VÍDEO REMOTO */}
            <div className="w-full h-full relative">
                <video 
                    // KEY É CRUCIAL: Se o ID do stream mudar, o componente desmonta e remonta
                    key={remoteStream?.id || 'no-remote'}
                    ref={(el) => {
                        remoteVideoRef.current = el;
                        updateVideoSource(el, remoteStream);
                    }}
                    autoPlay 
                    playsInline 
                    className={`w-full h-full object-contain bg-black transition-opacity duration-500 ${remoteStream ? 'opacity-100' : 'opacity-0'}`}
                />
            </div>

            {/* OVERLAY DE STATUS/LOADING */}
            {(!remoteStream || connectionState !== 'connected') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10 bg-[#111623]/80 backdrop-blur-sm">
                    {connectionState === 'failed' ? (
                         <div className="text-center text-red-400">
                             <AlertTriangle size={48} className="mx-auto mb-2" />
                             <p>Falha na conexão.</p>
                             <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-500/20 rounded-lg text-sm border border-red-500/30">
                                 Recarregar Página
                             </button>
                         </div>
                    ) : connectionState === 'connected' && !remoteStream ? (
                        <div className="text-center">
                             <Loader2 size={48} className="animate-spin mb-4 text-[#20bbe3]" />
                             <p>Conectado! Aguardando vídeo...</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-[#1e2e41] flex items-center justify-center mb-4 animate-pulse mx-auto">
                                <Signal size={32} className="text-slate-600" />
                            </div>
                            <p className="font-medium text-white mb-2">Aguardando participante...</p>
                            <p className="text-xs text-slate-500">Status: {connectionState}</p>
                        </div>
                    )}
                </div>
            )}

            {/* VÍDEO LOCAL (PIP) */}
            <div className="absolute bottom-6 right-6 w-32 h-48 md:w-56 md:h-40 bg-[#1e2e41] rounded-2xl border-2 border-[#1687cb]/30 overflow-hidden shadow-2xl z-20 group transition-all hover:scale-105">
                 <video 
                    key={isScreenSharing ? 'local-screen' : 'local-cam'}
                    ref={(el) => {
                        localVideoRef.current = el;
                        updateVideoSource(el, localStream);
                    }}
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
                 <div className="absolute bottom-2 left-2 text-[10px] bg-black/70 px-2 py-0.5 rounded text-white font-bold flex items-center gap-1">
                    {isScreenSharing ? <MonitorUp size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>}
                    Você
                 </div>
            </div>

            {/* BARRA DE CONTROLES */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#1e2e41]/90 backdrop-blur-md p-3 px-6 rounded-full border border-[#1687cb]/20 z-30 shadow-2xl">
                 <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-[#2d3f57] text-white' : 'bg-red-500 text-white'}`}>
                    {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
                 </button>
                 <button onClick={toggleCamera} className={`p-4 rounded-full transition-all ${isCameraOn ? 'bg-[#2d3f57] text-white' : 'bg-red-500 text-white'}`}>
                    {isCameraOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
                 </button>
                 {!isGuest && (
                    <button onClick={() => setIsRecording(!isRecording)} className={`p-4 rounded-full transition-all ${isRecording ? 'bg-white text-red-600 animate-pulse' : 'bg-[#2d3f57] text-white'}`}>
                        <BrainCircuit size={22} />
                    </button>
                 )}
                 <button onClick={handleScreenShare} className={`p-4 rounded-full transition-all ${isScreenSharing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] text-white'}`}>
                    <MonitorUp size={22} />
                 </button>
                 <button onClick={onLeave} className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700">
                    <LogOut size={22} />
                 </button>
            </div>
        </div>
    </div>
  );
};

export default MeetingRoom;
