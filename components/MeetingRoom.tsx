
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Loader2, MonitorUp, LogOut, BrainCircuit } from 'lucide-react';
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
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // ICE Candidates Queue: Guarda candidatos que chegam antes da descrição remota estar pronta
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);

  // Lock de negociação
  const isNegotiating = useRef(false);

  // --- STATE ---
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // --- 1. INICIALIZAÇÃO ---
  useEffect(() => {
    const init = async () => {
      try {
        console.log("📷 [Init] Solicitando mídia...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Só conecta no socket depois de ter a mídia pronta
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

  // --- 2. SOCKET & WEBRTC ---
  const connectSocket = () => {
    if (socketRef.current) return;

    console.log("🔌 [Socket] Conectando...");
    const socket = io();
    socketRef.current = socket;

    socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');

    socket.on('user-connected', (userId) => {
      console.log("👋 [Socket] Novo usuário entrou:", userId);
      // Pequeno delay para garantir que o outro lado inicializou os listeners
      setTimeout(() => startNegotiation(), 1000);
    });

    socket.on('signal', async (data) => {
      await handleSignalMessage(data);
    });

    socket.on('screen-toggle', (isRemoteSharing) => {
       console.log("📺 [Socket] Remote screen sharing:", isRemoteSharing);
       // Refresh hack para vídeo travado
       if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
           const stream = remoteVideoRef.current.srcObject as MediaStream;
           remoteVideoRef.current.srcObject = null;
           setTimeout(() => {
               if(remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
           }, 50);
       }
    });

    socket.on('user-disconnected', () => {
      console.log("❌ [Socket] Usuário saiu");
      setRemoteStream(null);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      setConnectionStatus('disconnected');
      
      // Resetar PC para permitir nova conexão
      if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
      }
    });
    
    // Anuncia presença
    socket.emit('ready', roomId);
  };

  const getPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    console.log("🛠️ [WebRTC] Criando RTCPeerConnection");
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Adiciona tracks locais
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE Candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('signal', {
          roomId, // Envia para a sala
          signal: { candidate }
        });
      }
    };

    // Recebimento de Stream Remoto
    pc.ontrack = (event) => {
      console.log("📡 [WebRTC] Track remoto recebido");
      const stream = event.streams[0];
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      setConnectionStatus('connected');
    };

    pc.onconnectionstatechange = () => {
       console.log("Stats WebRTC:", pc.connectionState);
       if (pc.connectionState === 'connected') setConnectionStatus('connected');
       if (pc.connectionState === 'failed') {
           setConnectionStatus('disconnected');
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
    // Evita processar sinais do próprio usuário (caso o servidor faça echo broadcast)
    if (socketRef.current && sender === socketRef.current.id) return;

    const pc = getPeerConnection();

    try {
        if (signal.type === 'offer') {
            console.log("📥 [WebRTC] Oferta recebida");
            // Se já estamos conectados ou negociando, pode haver conflito.
            // Para simplificar, aceitamos a oferta resetando se necessário
            if (pc.signalingState !== "stable") {
                console.warn("⚠️ Rollback: Recebeu oferta em estado instável. Ignorando conflito para priorizar nova oferta.");
                await Promise.all([
                    pc.setLocalDescription({type: "rollback"}),
                    pc.setRemoteDescription(new RTCSessionDescription(signal))
                ]);
            } else {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
            }
            
            // Processa fila de candidatos
            processIceQueue(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log("📤 [WebRTC] Enviando Resposta");
            socketRef.current?.emit('signal', { 
                roomId,
                target: sender, // Resposta vai direto para quem enviou
                signal: pc.localDescription 
            });

        } else if (signal.type === 'answer') {
            console.log("📥 [WebRTC] Resposta recebida");
            if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                processIceQueue(pc);
            }

        } else if (signal.candidate) {
            // Buffer de candidatos ICE
            if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } catch(e) { console.error("Erro ao add ICE:", e); }
            } else {
                console.log("⏳ [WebRTC] Bufferizando ICE Candidate");
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
          if (candidate) {
              try {
                  await pc.addIceCandidate(candidate);
                  console.log("✅ [WebRTC] Candidato ICE processado do buffer");
              } catch (e) { console.error("Erro buffer ICE:", e); }
          }
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
            
            // Replace Track
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                await sender.replaceTrack(screenTrack);
                if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
                
                screenTrack.onended = () => stopScreenShare();
                setIsScreenSharing(true);
                socketRef.current?.emit('screen-toggle', { roomId, isSharing: true });
                
                // Força renegociação leve (opcional, mas ajuda)
                startNegotiation();
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
        // Volta para câmera
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = camStream.getVideoTracks()[0];
        
        // Atualiza ref
        if (localStreamRef.current) {
             const oldTrack = localStreamRef.current.getVideoTracks()[0];
             localStreamRef.current.removeTrack(oldTrack);
             localStreamRef.current.addTrack(camTrack);
        }

        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(camTrack);
        
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        
        setIsScreenSharing(false);
        socketRef.current?.emit('screen-toggle', { roomId, isSharing: false });
    } catch(e) { console.error("Erro stop screen:", e); }
  };

  // --- CONTROLES DE MÍDIA ---
  const toggleMic = () => {
      localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !isMicOn);
      setIsMicOn(!isMicOn);
  };
  const toggleCamera = () => {
      localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = !isCameraOn);
      setIsCameraOn(!isCameraOn);
  };

  return (
    <div className={`flex gap-4 bg-[#111623] relative ${isGuest ? 'h-[100dvh] p-2' : 'h-[calc(100vh-140px)]'}`}>
        <div className="flex-1 bg-black rounded-2xl relative overflow-hidden flex flex-col border border-[#1687cb]/10 shadow-2xl">
            {/* VÍDEO REMOTO */}
            <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-cover transition-opacity duration-500 ${remoteStream ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* STATUS DE CARREGAMENTO */}
            {!remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0 bg-[#111623]">
                    {connectionStatus === 'connecting' ? (
                        <>
                            <Loader2 size={48} className="animate-spin mb-4 text-[#20bbe3]" />
                            <p className="font-medium text-white">Buscando participantes...</p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 rounded-full bg-[#1e2e41] flex items-center justify-center mb-4 animate-pulse">
                                <VideoIcon size={32} className="text-slate-600" />
                            </div>
                            <p>Aguardando participante...</p>
                            {isGuest && <p className="text-xs mt-2 text-[#20bbe3]">O organizador será notificado.</p>}
                        </>
                    )}
                </div>
            )}

            {/* VÍDEO LOCAL */}
            <div className="absolute bottom-6 right-6 w-32 h-48 md:w-56 md:h-40 bg-[#1e2e41] rounded-2xl border-2 border-[#1687cb]/30 overflow-hidden shadow-2xl z-20 group">
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
