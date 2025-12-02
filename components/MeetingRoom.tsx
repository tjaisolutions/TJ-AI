
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

const MeetingRoom: React.FC<MeetingRoomProps> = ({ onLeave, onSaveMeeting, isGuest = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<string | null>(null);

  // Real-time State
  const [guestJoined, setGuestJoined] = useState(isGuest); // If I am guest, I assume I'm joined.
  const socketRef = useRef<Socket | null>(null);
  const roomId = 'sala-padrao-tj'; // Para este exemplo, usamos uma sala fixa

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // AI processing state

  // Transcription State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isTranscribingRef = useRef(false); // Ref to track state inside callbacks
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const recognitionRef = useRef<any>(null);
  const [sidebarMode, setSidebarMode] = useState<'PARTICIPANTS' | 'TRANSCRIPT'>('PARTICIPANTS');

  // --- WEBSOCKET CONNECTION ---
  useEffect(() => {
    // Conecta ao servidor atual (relativo)
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
        console.log("Connected to WebSocket server");
        // Entra na sala ao conectar
        socket.emit('join-room', roomId, isGuest ? 'guest' : 'host');
    });

    socket.on('user-connected', (userId: string) => {
        // Se alguém conectou e não sou eu
        console.log("User connected:", userId);
        
        if (!isGuest && userId === 'guest') {
            setGuestJoined(true);
            setNotification("Um convidado entrou na reunião.");
            setTimeout(() => setNotification(null), 5000);
        }

        if (isGuest && userId === 'host') {
             setNotification("O organizador está na sala.");
             setTimeout(() => setNotification(null), 5000);
        }
    });

    socket.on('user-disconnected', () => {
         if (!isGuest) {
            setGuestJoined(false);
            setNotification("O convidado saiu da reunião.");
            setTimeout(() => setNotification(null), 5000);
         }
    });

    return () => {
        socket.disconnect();
    };
  }, [isGuest]);

  useEffect(() => {
    let localStream: MediaStream | null = null;

    const startVideo = async () => {
      try {
        setError(null);
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        }
      } catch (err: any) {
        console.error("Error accessing media devices:", err);
        let msg = "Erro ao acessar dispositivos.";
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = "Acesso à câmera/microfone negado. Verifique as permissões do navegador.";
        } else if (err.name === 'NotFoundError') {
            msg = "Nenhuma câmera ou microfone encontrado.";
        } else if (err.name === 'NotReadableError') {
             msg = "A câmera ou microfone está em uso por outro aplicativo.";
        }
        
        setError(msg);
      }
    };

    if (isCameraOn && !meetingEnded) {
        startVideo();
    } else {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isCameraOn, meetingEnded]);

  useEffect(() => {
    isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  useEffect(() => {
    const shouldListen = isTranscribing || isRecording;

    if (shouldListen && !meetingEnded) {
      if (!('webkitSpeechRecognition' in window)) {
        if (isRecording) {
            alert("A gravação com transcrição requer suporte a Web Speech API (Google Chrome).");
            setIsRecording(false);
        }
        return;
      }

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
                speaker: isGuest ? 'Visitante' : 'Você',
                text: event.results[i][0].transcript,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isFinal: true
            };
            setTranscript(prev => [...prev, newItem]);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return; 
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsTranscribing(false);
        }
      };

      recognition.onend = () => {
        const currentlyListening = isTranscribingRef.current || isRecording; 
        if (currentlyListening && recognitionRef.current && !meetingEnded) {
            try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) { console.error("Failed to start recognition", e); }
      if (isRecording) setSidebarMode('TRANSCRIPT');
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    }

    return () => {
        if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isTranscribing, isRecording, isGuest, meetingEnded]);

  const toggleMic = () => setIsMicOn(!isMicOn);
  const toggleCamera = () => setIsCameraOn(!isCameraOn);
  const toggleTranscription = () => setIsTranscribing(!isTranscribing);
  
  const toggleRecording = () => {
      if (isGuest) return; // Guests cannot record
      setIsRecording(!isRecording);
      if (!isRecording) setTranscript([]);
  };

  const handleHangUp = async () => {
      // Stop media tracks immediately
      setIsCameraOn(false);
      setIsMicOn(false);
      
      if (isGuest) {
          // Guest just sees an end screen
          setMeetingEnded(true);
          socketRef.current?.disconnect();
      } else {
          // Host logic
          socketRef.current?.disconnect();
          if (isRecording && transcript.length > 0) {
              setIsProcessing(true);
              const fullText = transcript.map(t => `${t.speaker} (${t.timestamp}): ${t.text}`).join('\n');
              const analysis = await analyzeMeeting(fullText);
              
              const newRecord: RecordedMeeting = {
                  id: `rec-${Date.now()}`,
                  title: "Reunião Gravada - " + new Date().toLocaleDateString(),
                  date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                  duration: "45 min", 
                  participants: ["Você", "Convidado Externo"],
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

  const retryCamera = () => {
      setIsCameraOn(false);
      setTimeout(() => setIsCameraOn(true), 100);
  };

  // --- TELA DE CARREGAMENTO / PROCESSAMENTO IA ---
  if (isProcessing) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111623] text-white">
              <Loader2 size={48} className="text-[#20bbe3] animate-spin mb-4" />
              <h2 className="text-2xl font-bold mb-2">Processando Reunião...</h2>
              <p className="text-slate-400">A IA está gerando o resumo e plano de ação.</p>
          </div>
      );
  }

  // --- TELA DE FIM DE REUNIÃO (Para Convidados) ---
  if (meetingEnded) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111623] text-white p-4 text-center">
             <div className="w-24 h-24 bg-[#1e2e41] rounded-full flex items-center justify-center mb-6 border border-[#1687cb]/30">
                <CheckCircle2 size={48} className="text-[#20bbe3]" />
             </div>
             <h2 className="text-3xl font-bold mb-4">Reunião Encerrada</h2>
             <p className="text-slate-400 max-w-md mb-8">Obrigado por participar. Você já pode fechar esta aba ou janela do navegador.</p>
             <button onClick={() => window.location.reload()} className="px-6 py-3 bg-[#1e2e41] hover:bg-[#2d3f57] rounded-lg text-white font-medium transition-colors border border-[#1687cb]/20">
                 Entrar Novamente
             </button>
        </div>
      );
  }

  // Adjust container height based on whether it is a guest view (full screen) or embedded
  const containerClass = isGuest ? "h-screen w-full p-4" : "h-[calc(100vh-140px)]";

  return (
    <div className={`${containerClass} flex gap-4 animate-in fade-in duration-500 relative bg-[#111623]`}>
        
        {/* TOAST NOTIFICATION */}
        {notification && (
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-[#1e2e41] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#20bbe3]/30 flex items-center gap-3 animate-in slide-in-from-top-4">
                <div className="w-2 h-2 rounded-full bg-[#20bbe3] animate-pulse"></div>
                <span className="text-sm font-medium">{notification}</span>
            </div>
        )}

        {linkCopied && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-[#20bbe3] text-[#111623] px-4 py-2 rounded-lg font-bold shadow-lg shadow-[#20bbe3]/30 flex items-center gap-2 animate-in slide-in-from-top-2">
                <CheckCircle2 size={18} />
                Link de convite copiado!
            </div>
        )}

        {/* Main Video Area */}
        <div className="flex-1 bg-[#111623] rounded-2xl relative overflow-hidden flex flex-col shadow-2xl border border-[#1687cb]/10 group">
            
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-white font-medium text-sm border border-white/10 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${guestJoined ? 'bg-emerald-500' : 'bg-yellow-500'} animate-pulse`}></div>
                    Reunião de Alinhamento
                </div>
                {isRecording && (
                     <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur px-3 py-1.5 rounded-lg text-white text-xs font-bold animate-pulse shadow-lg shadow-red-500/20">
                         <CircleDot size={12} className="fill-white" />
                         GRAVANDO
                     </div>
                )}
            </div>

            <div className="flex-1 relative flex items-center justify-center bg-[#0d1117] overflow-hidden">
                {error ? (
                    <div className="text-center p-6 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                            <VideoOff size={32} className="text-red-400" />
                        </div>
                        <p className="text-red-400 mb-4 max-w-md">{error}</p>
                        <button onClick={retryCamera} className="flex items-center gap-2 px-4 py-2 bg-[#1e2e41] text-white rounded-lg border border-[#1687cb]/20">
                            <RefreshCw size={16} /> Tentar Novamente
                        </button>
                    </div>
                ) : isCameraOn ? (
                    <div className="relative w-full h-full">
                        {/* MAIN USER VIDEO */}
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                        
                        {/* GUEST / REMOTE VIDEO SIMULATION */}
                        {guestJoined && (
                            <div className="absolute bottom-4 right-4 w-32 h-48 md:w-48 md:h-32 bg-[#1e2e41] rounded-xl border border-[#1687cb]/30 overflow-hidden shadow-2xl flex items-center justify-center group/mini">
                                {/* Simulando vídeo remoto com avatar ou placeholder */}
                                <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1687cb] to-[#20bbe3] flex items-center justify-center text-white font-bold mb-2">
                                        {isGuest ? 'H' : 'C'}
                                    </div>
                                    <span className="text-[10px] text-slate-300">{isGuest ? 'Organizador' : 'Convidado'}</span>
                                </div>
                                <div className="absolute bottom-1 right-2 w-2 h-2 bg-emerald-500 rounded-full border border-black"></div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-[#1687cb] to-[#20bbe3] flex items-center justify-center text-4xl font-bold text-[#111623]">
                        {isGuest ? 'EU' : 'TJ'}
                    </div>
                )}
                
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded text-white text-sm font-medium z-10 flex items-center gap-2">
                    {isMicOn ? <Mic size={14} className="text-emerald-400" /> : <MicOff size={14} className="text-red-400" />}
                    {isGuest ? 'Visitante (Você)' : 'Você (Organizador)'}
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="h-20 bg-[#1e2e41] flex items-center justify-between px-6 border-t border-[#1687cb]/10 relative z-20 shrink-0">
                <div className="flex items-center gap-2 text-slate-400 text-sm hidden md:flex w-1/4">
                   <span className="bg-[#111623] px-2 py-1 rounded border border-[#1687cb]/10 text-xs font-mono">ID: 882-991</span>
                </div>

                {/* CENTRAL CONTROLS - VISIBLE TO GUEST TOO */}
                <div className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
                    <button onClick={toggleMic} className={`p-4 rounded-full transition-all duration-200 shadow-lg ${isMicOn ? 'bg-[#2d3f57] hover:bg-[#3d5375] text-white' : 'bg-red-500 text-white'}`} title="Microfone">
                        {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>
                    
                    <button onClick={toggleCamera} className={`p-4 rounded-full transition-all duration-200 shadow-lg ${isCameraOn ? 'bg-[#2d3f57] hover:bg-[#3d5375] text-white' : 'bg-red-500 text-white'}`} title="Câmera">
                        {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>

                    {/* ONLY HOST CAN RECORD */}
                    {!isGuest && (
                        <button onClick={toggleRecording} className={`p-4 rounded-full transition-all duration-200 ${isRecording ? 'bg-white text-red-600 shadow-lg' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`} title="Gravar">
                            <CircleDot size={20} className={isRecording ? "animate-pulse fill-red-600" : ""} />
                        </button>
                    )}

                    <button onClick={toggleTranscription} className={`p-4 rounded-full transition-all duration-200 hidden sm:flex ${isTranscribing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`} title="Legendas / Transcrição">
                        <Captions size={20} />
                    </button>

                    {!isGuest && (
                        <button onClick={handleShareLink} className="p-4 rounded-full bg-[#2d3f57] hover:bg-[#3d5375] text-white hidden sm:flex" title="Convidar">
                            <Share size={20} />
                        </button>
                    )}

                    <button onClick={handleHangUp} className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white w-16 flex items-center justify-center shadow-lg shadow-red-500/20" title={isGuest ? "Sair da Reunião" : "Encerrar Reunião"}>
                        {isGuest ? <LogOut size={24} /> : <PhoneOff size={24} />}
                    </button>
                </div>

                <div className="flex items-center justify-end gap-3 w-1/4">
                     {/* Sidebar toggle */}
                    <button onClick={() => setSidebarMode('TRANSCRIPT')} className={`p-3 rounded-full transition-colors hidden lg:block ${sidebarMode === 'TRANSCRIPT' ? 'bg-[#20bbe3]/20 text-[#20bbe3]' : 'text-slate-300'}`} title="Chat / Transcrição">
                        <MessageSquare size={20} />
                    </button>
                    <button onClick={() => setSidebarMode('PARTICIPANTS')} className={`p-3 rounded-full transition-colors hidden lg:block ${sidebarMode === 'PARTICIPANTS' ? 'bg-[#20bbe3]/20 text-[#20bbe3]' : 'text-slate-300'}`} title="Participantes">
                        <UserPlus size={20} />
                    </button>
                </div>
            </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-[#1e2e41] rounded-2xl border border-[#1687cb]/10 hidden lg:flex flex-col shadow-xl">
            <div className="flex border-b border-[#1687cb]/10 bg-[#111623]/20 rounded-t-2xl">
                <button onClick={() => setSidebarMode('PARTICIPANTS')} className={`flex-1 py-3 text-sm font-bold transition-colors ${sidebarMode === 'PARTICIPANTS' ? 'text-white border-b-2 border-[#20bbe3]' : 'text-slate-500 hover:text-slate-300'}`}>
                    Participantes
                </button>
                <button onClick={() => setSidebarMode('TRANSCRIPT')} className={`flex-1 py-3 text-sm font-bold transition-colors ${sidebarMode === 'TRANSCRIPT' ? 'text-white border-b-2 border-[#20bbe3]' : 'text-slate-500 hover:text-slate-300'}`}>
                    Transcrição
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {sidebarMode === 'PARTICIPANTS' ? (
                    <div className="space-y-1">
                        {/* Me */}
                        <div className="flex items-center gap-3 p-2 bg-[#111623]/50 rounded-lg border border-[#1687cb]/10">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1687cb] to-[#2d3f57] flex items-center justify-center text-white font-bold text-sm relative">
                                {isGuest ? 'V' : 'O'}
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#1e2e41] rounded-full"></div>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-white">{isGuest ? 'Visitante (Você)' : 'Você (Organizador)'}</p>
                                <p className="text-xs text-emerald-400">Online</p>
                            </div>
                            {isMicOn ? <Mic size={14} className="text-slate-500" /> : <MicOff size={14} className="text-red-500" />}
                        </div>
                        
                        {/* Other Participant (Real WebSocket Status) */}
                        {guestJoined ? (
                             <div className="flex items-center gap-3 p-2 hover:bg-[#111623]/30 rounded-lg transition-colors group animate-in slide-in-from-left-2">
                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm relative">
                                    {isGuest ? 'O' : 'V'}
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#1e2e41] rounded-full"></div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-white">{isGuest ? 'Organizador' : 'Convidado Externo'}</p>
                                    <p className="text-xs text-emerald-400">Conectado</p>
                                </div>
                                <Mic size={14} className="text-slate-500" />
                            </div>
                        ) : (
                            !isGuest && (
                                <div className="p-4 text-center border-2 border-dashed border-[#1687cb]/10 rounded-lg mt-4">
                                    <Loader2 size={24} className="mx-auto text-[#20bbe3] animate-spin mb-2" />
                                    <p className="text-xs text-slate-500">Aguardando participantes...</p>
                                </div>
                            )
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {transcript.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4 italic">Fale algo para ver a transcrição...</p>
                        ) : (
                            transcript.map((item) => (
                                <div key={item.id} className="animate-in slide-in-from-bottom-2 fade-in">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-[#20bbe3]">{item.speaker}</span>
                                        <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                                    </div>
                                    <div className="bg-[#111623]/50 p-2.5 rounded-lg rounded-tl-none border border-[#1687cb]/10">
                                        <p className="text-sm text-slate-200">{item.text}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MeetingRoom;
