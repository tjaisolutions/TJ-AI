
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, LogOut, Signal } from 'lucide-react';
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

// Componente de Vídeo Isolado para gerenciar Streams
const VideoPlayer = ({ stream, isLocal = false, isMirror = false }: { stream: MediaStream | null, isLocal?: boolean, isMirror?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (stream) {
            video.srcObject = stream;
            // Tenta dar play, ignora erro se for autoplay policy
            video.play().catch(e => console.warn("Autoplay:", e));
        } else {
            video.srcObject = null;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal} // Local sempre mudo para evitar feedback
            className={`w-full h-full object-cover bg-black ${isMirror ? 'scale-x-[-1]' : ''}`}
            style={{ transform: isMirror ? 'scaleX(-1)' : 'none' }}
        />
    );
};

const MeetingRoom: React.FC<MeetingRoomProps> = ({ onLeave, onSaveMeeting, isGuest = false }) => {
    const roomId = 'sala-padrao-tj';

    // Refs para manter instâncias estáveis sem re-renderizar
    const socketRef = useRef<Socket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localVideoSenderRef = useRef<RTCRtpSender | null>(null);
    
    // Estado Visual
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // 1. Captura Mídia Inicial (Câmera + Mic)
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);

                // 2. Inicia Socket
                const socket = io();
                socketRef.current = socket;
                
                socket.on('connect', () => {
                    console.log("✅ Socket Conectado");
                    socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');
                });

                // 3. Configura Eventos de Sinalização
                setupSignaling(socket, stream);

            } catch (err) {
                console.error("Erro ao iniciar:", err);
                alert("Erro: Permita acesso à câmera e microfone.");
            }
        };

        init();

        return () => {
            localStream?.getTracks().forEach(t => t.stop());
            pcRef.current?.close();
            socketRef.current?.disconnect();
        };
    }, []);

    const setupSignaling = (socket: Socket, myStream: MediaStream) => {
        // Se alguém entrar, inicie a conexão (se for host ou se a lógica pedir)
        // Aqui simplificamos: Quem entra depois emite 'ready', quem já está emite oferta.
        
        socket.on('user-connected', async () => {
            console.log("👋 Usuário detectado. Iniciando conexão...");
            const pc = createPeerConnection(socket, myStream);
            
            // Cria Oferta
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('signal', { roomId, signal: pc.localDescription });
            } catch (e) { console.error("Erro ao criar oferta:", e); }
        });

        socket.on('signal', async (data) => {
            if (data.sender === socket.id) return;
            
            // Se não tem PC, cria (caso seja quem recebeu a oferta)
            if (!pcRef.current) createPeerConnection(socket, myStream);
            const pc = pcRef.current!;

            try {
                if (data.signal.type === 'offer') {
                    console.log("📥 Oferta recebida");
                    // Evita conflito de estado
                    if (pc.signalingState !== "stable") return;

                    await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', { roomId, signal: pc.localDescription });
                } 
                else if (data.signal.type === 'answer') {
                    console.log("📥 Resposta recebida");
                    if (pc.signalingState !== "stable") {
                        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
                    }
                } 
                else if (data.signal.candidate) {
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
                    }
                }
            } catch (e) {
                console.error("Erro sinalização:", e);
            }
        });

        socket.on('user-disconnected', () => {
            setRemoteStream(null);
            setConnectionStatus('disconnected');
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
        });

        // Informa que entrei
        socket.emit('ready', roomId);
    };

    const createPeerConnection = (socket: Socket, stream: MediaStream) => {
        if (pcRef.current) return pcRef.current;

        console.log("🛠️ Criando PeerConnection");
        const pc = new RTCPeerConnection(ICE_SERVERS);
        
        // --- TRANSCEIVERS (O SEGREDO DO SUCESSO) ---
        // Adiciona transceivers manualmente para garantir a ordem (m-lines) Áudio depois Vídeo
        // Isso evita o erro "m-lines order mismatch"
        
        // 1. Áudio
        stream.getAudioTracks().forEach(track => {
            pc.addTrack(track, stream);
        });

        // 2. Vídeo (Guardamos a referência do Sender para substituir depois no Screen Share)
        stream.getVideoTracks().forEach(track => {
            const sender = pc.addTrack(track, stream);
            localVideoSenderRef.current = sender;
        });

        pc.ontrack = (event) => {
            console.log("📺 Stream Remoto Chegou");
            setRemoteStream(event.streams[0]);
            setConnectionStatus('connected');
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('signal', { roomId, signal: { candidate: event.candidate } });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') setConnectionStatus('connected');
            if (pc.connectionState === 'disconnected') setConnectionStatus('disconnected');
            if (pc.connectionState === 'failed') setConnectionStatus('disconnected');
        };

        pcRef.current = pc;
        return pc;
    };

    // --- CONTROLES DE MÍDIA (Substituição sem renegociação) ---

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // VOLTAR PARA CÂMERA
            try {
                const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                const videoTrack = camStream.getVideoTracks()[0];
                
                // Substitui no PC (para o outro ver)
                if (localVideoSenderRef.current) {
                    await localVideoSenderRef.current.replaceTrack(videoTrack);
                }

                setLocalStream(camStream);
                setIsScreenSharing(false);
                setIsCameraOn(true); // Reativa botão visualmente
            } catch (e) { console.error("Erro ao voltar câmera:", e); }
        } else {
            // IR PARA TELA
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                // Handler para quando usuário clica em "Parar" na barra do navegador
                screenTrack.onended = () => {
                    toggleScreenShare(); // Chama a mesma função para voltar pra câmera
                };

                // Substitui no PC (para o outro ver) - Mágica do replaceTrack
                if (localVideoSenderRef.current) {
                    await localVideoSenderRef.current.replaceTrack(screenTrack);
                }

                setLocalStream(screenStream);
                setIsScreenSharing(true);
            } catch (e) { console.error("Cancelado ou erro:", e); }
        }
    };

    const toggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(t => t.enabled = !isMicOn);
            setIsMicOn(!isMicOn);
        }
    };

    const toggleCamera = () => {
        // Apenas desabilita a track, não para o stream, para manter a conexão viva
        if (localStream && !isScreenSharing) {
            localStream.getVideoTracks().forEach(t => t.enabled = !isCameraOn);
            setIsCameraOn(!isCameraOn);
        }
    };

    return (
        <div className={`flex flex-col bg-[#111623] relative ${isGuest ? 'h-[100dvh]' : 'h-[calc(100vh-140px)]'}`}>
            
            {/* ÁREA PRINCIPAL (REMOTO) */}
            <div className="flex-1 bg-black m-4 rounded-2xl relative overflow-hidden border border-[#1687cb]/20 shadow-2xl">
                {remoteStream ? (
                    <VideoPlayer stream={remoteStream} />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-[#1e2e41]/50">
                        <div className="w-20 h-20 rounded-full bg-[#111623] flex items-center justify-center mb-4 animate-pulse border border-[#20bbe3]/30">
                            <Signal className="text-[#20bbe3]" size={32} />
                        </div>
                        <h3 className="font-bold text-white text-lg">
                            {connectionStatus === 'connected' ? 'Conectado. Carregando vídeo...' : 'Aguardando participante...'}
                        </h3>
                        <p className="text-sm opacity-60">Status: {connectionStatus}</p>
                    </div>
                )}

                {/* PIP (LOCAL) */}
                <div className="absolute bottom-6 right-6 w-32 h-48 sm:w-48 sm:h-32 bg-[#111623] rounded-xl border border-[#1687cb]/40 shadow-xl overflow-hidden group hover:scale-105 transition-all z-20">
                    <VideoPlayer 
                        stream={localStream} 
                        isLocal={true} 
                        isMirror={!isScreenSharing} 
                    />
                    <div className="absolute bottom-1 left-2 text-[10px] bg-black/60 text-white px-2 rounded font-bold flex items-center gap-1">
                        {isScreenSharing ? <MonitorUp size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-green-500"/>}
                        Você
                    </div>
                </div>
            </div>

            {/* CONTROLES */}
            <div className="h-20 bg-[#1e2e41] border-t border-[#1687cb]/20 flex items-center justify-center gap-4 px-4 shrink-0">
                <button 
                    onClick={toggleMic}
                    className={`p-3 rounded-full transition-all ${isMicOn ? 'bg-[#2d3f57] text-white hover:bg-[#3d5475]' : 'bg-red-500/90 text-white hover:bg-red-600'}`}
                >
                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                
                <button 
                    onClick={toggleCamera}
                    disabled={isScreenSharing}
                    className={`p-3 rounded-full transition-all ${isCameraOn ? 'bg-[#2d3f57] text-white hover:bg-[#3d5475]' : 'bg-red-500/90 text-white hover:bg-red-600'} ${isScreenSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isCameraOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
                </button>

                <button 
                    onClick={toggleScreenShare}
                    className={`p-3 rounded-full transition-all ${isScreenSharing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] text-white hover:bg-[#3d5475]'}`}
                    title="Compartilhar Tela"
                >
                    <MonitorUp size={20} />
                </button>

                <div className="w-px h-8 bg-[#1687cb]/20 mx-2"></div>

                <button 
                    onClick={onLeave}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold flex items-center gap-2 text-sm transition-colors"
                >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">Sair</span>
                </button>
            </div>
        </div>
    );
};

export default MeetingRoom;
