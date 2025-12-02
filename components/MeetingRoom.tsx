
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

// --- SUB-COMPONENTE DE VÍDEO (Isolado para evitar AbortError e erros de Render) ---
const VideoPlayer = ({ stream, isLocal = false, isMirror = false }: { stream: MediaStream | null, isLocal?: boolean, isMirror?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (stream) {
            video.srcObject = stream;
            // Tratamento robusto de Autoplay para evitar AbortError
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn("Autoplay prevenido (comum em browsers mobile):", error);
                });
            }
        } else {
            video.srcObject = null;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline // CRUCIAL PARA MOBILE
            muted={isLocal} // Sempre mutado se for local para evitar feedback
            className={`w-full h-full object-cover bg-black ${isMirror ? 'scale-x-[-1]' : ''}`}
        />
    );
};

const MeetingRoom: React.FC<MeetingRoomProps> = ({ onLeave, onSaveMeeting, isGuest = false }) => {
    const roomId = 'sala-padrao-tj';

    // --- REFS (Persistem entre renders) ---
    const socketRef = useRef<Socket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    
    // --- STATE ---
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
    
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    // --- 1. SETUP INICIAL ---
    useEffect(() => {
        const startUp = async () => {
            try {
                // 1. Pega Mídia Local
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                setLocalStream(stream);

                // 2. Conecta Socket
                const socket = io();
                socketRef.current = socket;

                // 3. Define Eventos do Socket
                setupSocketEvents(socket);

                // 4. Entra na sala
                socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');

            } catch (err) {
                console.error("Erro ao iniciar mídia:", err);
                alert("Erro: Permita acesso à câmera/microfone.");
            }
        };

        startUp();

        return () => {
            // Cleanup limpo
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            if (pcRef.current) pcRef.current.close();
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // --- 2. SOCKET & SIGNALING ---
    const setupSocketEvents = (socket: Socket) => {
        // Se alguém entrou e EU sou o Host, EU ligo.
        socket.on('user-connected', (userId) => {
            console.log("👋 Usuário entrou. Iniciando chamada...");
            createPeerConnection();
            doCall(); 
        });

        // Recebimento de Sinais (Oferta, Resposta, ICE)
        socket.on('signal', async (data) => {
            if (data.sender === socket.id) return; // Ignora eco

            if (!pcRef.current) createPeerConnection();
            const pc = pcRef.current!;

            try {
                if (data.signal.type === 'offer') {
                    console.log("📥 Recebi Oferta");
                    await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', { roomId, signal: pc.localDescription });
                } 
                else if (data.signal.type === 'answer') {
                    console.log("📥 Recebi Resposta");
                    // Evita erro de 'stable' state
                    if (pc.signalingState !== "stable") {
                        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                    }
                } 
                else if (data.signal.candidate) {
                    // Adiciona candidato ICE se conexão estiver pronta
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
                    }
                }
            } catch (e) {
                console.error("Erro signaling:", e);
            }
        });

        socket.on('screen-toggle', (isSharing) => {
            console.log("📺 Remote mudou tela:", isSharing);
            // Pequeno hack para forçar atualização do layout se necessário
            setConnectionStatus(prev => prev); 
        });

        socket.on('user-disconnected', () => {
            console.log("❌ Usuário saiu");
            setRemoteStream(null);
            setConnectionStatus('disconnected');
            // Fecha PC antigo e prepara para nova conexão
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
        });

        // Avisa que está pronto (para quem já estava na sala)
        socket.emit('ready', roomId);
    };

    // --- 3. WEBRTC CORE ---
    const createPeerConnection = () => {
        if (pcRef.current) return pcRef.current;

        console.log("🛠️ Criando PeerConnection");
        const pc = new RTCPeerConnection(ICE_SERVERS);
        
        // Adiciona tracks locais
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('signal', { roomId, signal: { candidate: event.candidate } });
            }
        };

        pc.ontrack = (event) => {
            console.log("📡 Stream remoto recebido");
            setRemoteStream(event.streams[0]);
            setConnectionStatus('connected');
        };

        pc.onconnectionstatechange = () => {
            console.log("Status Conexão:", pc.connectionState);
            if (pc.connectionState === 'connected') setConnectionStatus('connected');
            if (pc.connectionState === 'failed') setConnectionStatus('failed');
            if (pc.connectionState === 'disconnected') setConnectionStatus('disconnected');
        };

        pcRef.current = pc;
        return pc;
    };

    const doCall = async () => {
        const pc = pcRef.current;
        if (!pc) return;
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('signal', { roomId, signal: pc.localDescription });
        } catch (e) { console.error("Erro ao chamar:", e); }
    };

    // --- 4. COMPARTILHAMENTO DE TELA (GOOGLE MEET STYLE) ---
    const startScreenShare = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            if (pcRef.current) {
                const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }
            }

            // Atualiza localmente
            setLocalStream(screenStream);
            localStreamRef.current = screenStream;
            setIsScreenSharing(true);
            socketRef.current?.emit('screen-toggle', { roomId, isSharing: true });

            // Handler para quando o usuário clica em "Parar" na barra do navegador
            screenTrack.onended = () => {
                stopScreenShare();
            };

        } catch (e) {
            console.error("Erro ao compartilhar tela:", e);
        }
    };

    const stopScreenShare = async () => {
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const camTrack = camStream.getVideoTracks()[0];

            if (pcRef.current) {
                const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(camTrack);
                }
            }

            setLocalStream(camStream);
            localStreamRef.current = camStream;
            setIsScreenSharing(false);
            socketRef.current?.emit('screen-toggle', { roomId, isSharing: false });

            // Restaura estado dos botões
            if (!isMicOn) toggleMic(false);
            if (!isCameraOn) toggleCamera(false);

        } catch (e) { console.error("Erro ao voltar para camera:", e); }
    };

    // --- 5. CONTROLES ---
    const toggleMic = (forceState?: boolean) => {
        const newState = forceState !== undefined ? forceState : !isMicOn;
        localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = newState);
        setIsMicOn(newState);
    };

    const toggleCamera = (forceState?: boolean) => {
        const newState = forceState !== undefined ? forceState : !isCameraOn;
        localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = newState);
        setIsCameraOn(newState);
    };

    return (
        <div className={`flex gap-4 bg-[#111623] relative ${isGuest ? 'h-[100dvh] p-2' : 'h-[calc(100vh-140px)]'}`}>
            <div className="flex-1 bg-black rounded-2xl relative overflow-hidden flex flex-col border border-[#1687cb]/10 shadow-2xl">
                
                {/* ÁREA PRINCIPAL (VÍDEO REMOTO) */}
                <div className="w-full h-full relative">
                    {remoteStream ? (
                        <VideoPlayer stream={remoteStream} />
                    ) : (
                        /* Tela de espera */
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10 bg-[#111623]">
                             <div className="w-24 h-24 rounded-full bg-[#1e2e41] flex items-center justify-center mb-6 animate-pulse">
                                <Signal size={40} className="text-[#20bbe3]" />
                             </div>
                             <h3 className="text-xl font-bold text-white mb-2">
                                {connectionStatus === 'connected' ? 'Conectado. Aguardando vídeo...' : 'Aguardando participante...'}
                             </h3>
                             <p className="text-sm opacity-50">Status: {connectionStatus}</p>
                             {connectionStatus === 'failed' && (
                                 <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-500 text-white rounded">
                                     Reconectar
                                 </button>
                             )}
                        </div>
                    )}
                </div>

                {/* VÍDEO LOCAL (PIP) */}
                <div className="absolute bottom-6 right-6 w-32 h-48 md:w-60 md:h-40 bg-[#1e2e41] rounded-2xl border-2 border-[#1687cb]/30 overflow-hidden shadow-2xl z-20 group transition-all hover:scale-105">
                     <VideoPlayer 
                        stream={localStream} 
                        isLocal={true} 
                        isMirror={!isScreenSharing} 
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
                     <button onClick={() => toggleMic()} className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-[#2d3f57] text-white' : 'bg-red-500 text-white'}`}>
                        {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
                     </button>
                     <button onClick={() => toggleCamera()} className={`p-4 rounded-full transition-all ${isCameraOn ? 'bg-[#2d3f57] text-white' : 'bg-red-500 text-white'}`}>
                        {isCameraOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
                     </button>
                     {!isGuest && (
                        <button onClick={() => setIsRecording(!isRecording)} className={`p-4 rounded-full transition-all ${isRecording ? 'bg-white text-red-600 animate-pulse' : 'bg-[#2d3f57] text-white'}`}>
                            <BrainCircuit size={22} />
                        </button>
                     )}
                     <button onClick={isScreenSharing ? stopScreenShare : startScreenShare} className={`p-4 rounded-full transition-all ${isScreenSharing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] text-white'}`}>
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
