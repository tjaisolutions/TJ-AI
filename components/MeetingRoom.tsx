
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, CircleDot, Loader2, MonitorUp, LogOut, BrainCircuit } from 'lucide-react';
import { RecordedMeeting, TranscriptItem } from '../types';
// import { analyzeMeeting } from '../services/geminiService'; // Removido temporariamente para focar no WebRTC
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

  // --- REFS (Persistem entre renders sem causar re-render) ---
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Controle de Negociação para evitar "InvalidStateError"
  const isMakingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const processingQueue = useRef<Promise<void>>(Promise.resolve());

  // --- STATE (Causa re-render para UI) ---
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // States de Gravação/IA (Mantidos mas simplificados para focar no vídeo)
  const [isRecording, setIsRecording] = useState(false);

  // --- 1. SETUP INICIAL DE MÍDIA (Apenas uma vez) ---
  useEffect(() => {
    const startLocalStream = async () => {
      try {
        console.log("📷 Iniciando câmera...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        
        // Atachar ao vídeo local imediatamente
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Iniciar conexão socket APÓS ter a mídia
        connectSocket();
      } catch (error) {
        console.error("Erro ao acessar mídia:", error);
        alert("Erro: Não foi possível acessar câmera ou microfone.");
      }
    };

    startLocalStream();

    // Cleanup ao sair da tela
    return () => {
      console.log("🧹 Limpando recursos...");
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // --- 2. CONFIGURAÇÃO DE SOCKET E WEBRTC ---
  const connectSocket = () => {
    if (socketRef.current) return; // Já conectado

    console.log("🔌 Conectando ao Socket.io...");
    const socket = io();
    socketRef.current = socket;

    socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');

    // --- EVENTOS DE SINALIZAÇÃO ---

    socket.on('user-connected', async (userId) => {
      console.log("👋 Usuário entrou:", userId);
      // Se eu já estou na sala, eu inicio a chamada (Polite Peer strategy simplificada)
      startNegotiation();
    });

    socket.on('signal', async (data) => {
      handleSignalMessage(data);
    });

    socket.on('screen-toggle', (isRemoteSharing) => {
       console.log("📺 Remote mudou compartilhamento:", isRemoteSharing);
       // Forçar refresh do vídeo remoto se necessário
       if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
           const stream = remoteVideoRef.current.srcObject as MediaStream;
           // Pequeno hack para forçar o navegador a redesenhar o vídeo se travado
           remoteVideoRef.current.srcObject = null;
           setTimeout(() => {
               if(remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
           }, 50);
       }
    });

    socket.on('user-disconnected', () => {
      console.log("❌ Usuário saiu");
      setRemoteStream(null);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      // Reiniciar PC para estar pronto para próxima conexão
      if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
      }
      setConnectionStatus('disconnected');
    });

    // Avisar que cheguei
    socket.emit('ready', roomId);
  };

  // --- 3. LÓGICA DE WEBRTC (Chain Promise para evitar Race Conditions) ---
  
  const getPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    console.log("🛠️ Criando nova RTCPeerConnection");
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Adicionar tracks locais
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('signal', {
          target: 'broadcast', // Simplificado para broadcast na sala
          signal: { candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("📡 Stream remoto recebido");
      const stream = event.streams[0];
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      setConnectionStatus('connected');
    };

    pc.onconnectionstatechange = () => {
       console.log("Estado da conexão:", pc.connectionState);
       if (pc.connectionState === 'connected') setConnectionStatus('connected');
       if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setConnectionStatus('disconnected');
    };

    pcRef.current = pc;
    return pc;
  };

  const startNegotiation = async () => {
     const pc = getPeerConnection();
     isMakingOffer.current = true;
     try {
         const offer = await pc.createOffer();
         await pc.setLocalDescription(offer);
         console.log("📤 Enviando Oferta");
         socketRef.current?.emit('signal', { target: 'broadcast', signal: pc.localDescription });
     } catch (err) {
         console.error("Erro na negociação:", err);
     } finally {
         isMakingOffer.current = false;
     }
  };

  // Queue para processar sinais sequencialmente
  const handleSignalMessage = async (data: any) => {
    // Adiciona à fila de processamento
    processingQueue.current = processingQueue.current.then(async () => {
        const { signal, sender } = data;
        const pc = getPeerConnection();

        try {
            if (signal.type === 'offer') {
                // Colisão de ofertas (Glare)
                const offerCollision = isMakingOffer.current || pc.signalingState !== 'stable';
                if (offerCollision) {
                     // Se houver colisão, podemos ignorar se não formos o "polite peer".
                     // Aqui simplificamos: se já estamos negociando, ignoramos ofertas entrantes conflitantes
                     console.warn("⚠️ Colisão de ofertas detectada. Ignorando.");
                     return; 
                }
                
                console.log("📥 Recebeu Oferta");
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                console.log("📤 Enviando Resposta");
                socketRef.current?.emit('signal', { target: sender, signal: pc.localDescription });

            } else if (signal.type === 'answer') {
                console.log("📥 Recebeu Resposta");
                if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                } else {
                    console.warn("⚠️ Resposta ignorada. Estado incorreto:", pc.signalingState);
                }

            } else if (signal.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } catch (e) {
                    // Candidatos podem chegar antes da descrição remota, ignora erro
                    console.log("Candidato ICE pendente ou erro:", e);
                }
            }
        } catch (error) {
            console.error("Erro processando sinal:", error);
        }
    });
  };

  // --- 4. COMPARTILHAMENTO DE TELA (REPLACE TRACK) ---
  const handleScreenShare = async () => {
      const pc = pcRef.current;
      if (!pc) return;

      if (!isScreenSharing) {
          try {
              console.log("🖥️ Iniciando captura de tela...");
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
              const screenTrack = screenStream.getVideoTracks()[0];

              // Substituir o track de vídeo no sender atual
              const senders = pc.getSenders();
              const videoSender = senders.find(s => s.track?.kind === 'video');

              if (videoSender) {
                  console.log("🔄 Substituindo track de vídeo (Câmera -> Tela)");
                  await videoSender.replaceTrack(screenTrack);
                  
                  // Atualizar preview local
                  if (localVideoRef.current) {
                      localVideoRef.current.srcObject = screenStream;
                  }
                  
                  // Atualizar ref para manter vivo
                  // Nota: Não substituímos localStreamRef.current inteiro para não perder o áudio original do mic se o áudio da tela falhar
                  
                  // Listeners para quando o usuário parar pelo navegador
                  screenTrack.onended = () => stopScreenShare();
                  
                  setIsScreenSharing(true);
                  socketRef.current?.emit('screen-toggle', { roomId, isSharing: true });
              }
          } catch (err) {
              console.error("Erro ao compartilhar tela:", err);
          }
      } else {
          stopScreenShare();
      }
  };

  const stopScreenShare = async () => {
      const pc = pcRef.current;
      if (!pc) return;

      console.log("🔙 Voltando para câmera...");
      try {
          // Re-captura a câmera (pois o stream antigo pode ter pausado/parado)
          // Mas tentamos usar o ref primeiro se ativo
          let cameraTrack = localStreamRef.current?.getVideoTracks()[0];
          
          if (!cameraTrack || cameraTrack.readyState === 'ended') {
               const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
               cameraTrack = newStream.getVideoTracks()[0];
               // Atualiza o ref do stream local
               if (localStreamRef.current) {
                   localStreamRef.current.removeTrack(localStreamRef.current.getVideoTracks()[0]);
                   localStreamRef.current.addTrack(cameraTrack);
               }
          }

          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender && cameraTrack) {
              await videoSender.replaceTrack(cameraTrack);
          }

          // Atualiza preview local
          if (localVideoRef.current && localStreamRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
          }

          setIsScreenSharing(false);
          socketRef.current?.emit('screen-toggle', { roomId, isSharing: false });

      } catch (err) {
          console.error("Erro ao voltar para câmera:", err);
      }
  };

  // --- 5. CONTROLES DE MÍDIA ---
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
        
        {/* ÁREA PRINCIPAL DE VÍDEO */}
        <div className="flex-1 bg-black rounded-2xl relative overflow-hidden flex flex-col border border-[#1687cb]/10 shadow-2xl">
            
            {/* VÍDEO REMOTO */}
            <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-cover transition-opacity duration-500 ${remoteStream ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* LOADER / STATUS */}
            {!remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0 bg-[#111623]">
                    {connectionStatus === 'connecting' ? (
                        <>
                            <Loader2 size={48} className="animate-spin mb-4 text-[#20bbe3]" />
                            <p className="font-medium text-white">Conectando à sala segura...</p>
                        </>
                    ) : (
                        <>
                             <div className="w-20 h-20 rounded-full bg-[#1e2e41] flex items-center justify-center mb-4 animate-pulse">
                                 <VideoIcon size={32} className="text-slate-600" />
                             </div>
                            <p>Aguardando participante...</p>
                            <p className="text-xs text-slate-600 mt-2">O link pode ser compartilhado agora.</p>
                        </>
                    )}
                </div>
            )}

            {/* VÍDEO LOCAL (PiP) */}
            <div className={`absolute bottom-6 right-6 w-32 h-48 md:w-56 md:h-40 bg-[#1e2e41] rounded-2xl border-2 border-[#1687cb]/30 overflow-hidden shadow-2xl z-20 transition-all hover:scale-105 group`}>
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
                    {isScreenSharing ? 'Sua Tela' : 'Você'}
                 </div>
            </div>

            {/* CONTROLES */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#1e2e41]/90 backdrop-blur-md p-3 px-6 rounded-full border border-[#1687cb]/20 z-30 shadow-2xl">
                 <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-[#2d3f57] text-white hover:bg-[#3d526e]' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}>
                    {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
                 </button>
                 <button onClick={toggleCamera} className={`p-4 rounded-full transition-all ${isCameraOn ? 'bg-[#2d3f57] text-white hover:bg-[#3d526e]' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}>
                    {isCameraOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
                 </button>
                 
                 <div className="w-px h-8 bg-slate-600 mx-1"></div>

                 {!isGuest && (
                    <button onClick={() => setIsRecording(!isRecording)} className={`p-4 rounded-full transition-all ${isRecording ? 'bg-white text-red-600 shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'bg-[#2d3f57] text-white hover:bg-[#3d526e]'}`} title="Gravar e Transcrever">
                        <BrainCircuit size={22} className={isRecording ? "animate-pulse" : ""} />
                    </button>
                 )}
                 <button onClick={handleScreenShare} className={`p-4 rounded-full transition-all ${isScreenSharing ? 'bg-[#20bbe3] text-[#111623] shadow-[0_0_15px_rgba(32,187,227,0.4)]' : 'bg-[#2d3f57] text-white hover:bg-[#3d526e]'}`} title="Compartilhar Tela">
                    <MonitorUp size={22} />
                 </button>
                 
                 <div className="w-px h-8 bg-slate-600 mx-1"></div>

                 <button onClick={onLeave} className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20" title="Sair da Sala">
                    <LogOut size={22} />
                 </button>
            </div>
        </div>

        {/* SIDEBAR (Desktop) */}
        <div className="hidden lg:flex flex-col w-80 bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 overflow-hidden shadow-xl">
             <div className="p-5 bg-[#111623]/50 border-b border-[#1687cb]/20 flex justify-between items-center">
                 <h3 className="font-bold text-white">Participantes</h3>
                 <span className="bg-[#20bbe3]/10 text-[#20bbe3] text-xs px-2 py-1 rounded-full font-bold">
                     {remoteStream ? '2 Online' : '1 Online'}
                 </span>
             </div>
             <div className="p-4 space-y-4">
                 <div className="flex items-center gap-3 p-2 rounded-xl bg-[#111623]/30 border border-[#1687cb]/10">
                     <div className="w-10 h-10 rounded-full bg-[#20bbe3] flex items-center justify-center text-[#111623] font-bold shadow-lg shadow-[#20bbe3]/20">EU</div>
                     <div>
                         <p className="text-sm font-bold text-white">Você</p>
                         <div className="flex items-center gap-1.5">
                             <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                             <p className="text-xs text-slate-400">Conectado</p>
                         </div>
                     </div>
                     <div className="ml-auto flex gap-1">
                         {!isMicOn && <MicOff size={14} className="text-red-400" />}
                         {!isCameraOn && <VideoOff size={14} className="text-red-400" />}
                     </div>
                 </div>
                 
                 {remoteStream ? (
                     <div className="flex items-center gap-3 p-2 rounded-xl bg-[#111623]/30 border border-emerald-500/20 animate-in fade-in slide-in-from-right-4">
                         <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                            {isGuest ? 'O' : 'C'}
                         </div>
                         <div>
                             <p className="text-sm font-bold text-white">{isGuest ? 'Organizador' : 'Convidado'}</p>
                             <div className="flex items-center gap-1.5">
                                 <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                 <p className="text-xs text-emerald-400">Ao Vivo</p>
                             </div>
                         </div>
                     </div>
                 ) : (
                     <div className="text-center py-8 opacity-50 border-2 border-dashed border-slate-700 rounded-xl mx-2">
                         <p className="text-xs text-slate-400">Aguardando...</p>
                     </div>
                 )}
             </div>
             
             <div className="mt-auto p-4 border-t border-[#1687cb]/10 bg-[#111623]/30">
                 <p className="text-[10px] text-slate-500 text-center">Conexão Segura P2P • criptografada</p>
             </div>
        </div>
    </div>
  );
};

export default MeetingRoom;
