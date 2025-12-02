
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, MessageSquare, Settings, Share, Hand, MoreVertical, Link, Check, Copy, FileText, Captions, CircleDot, Loader2, RefreshCw } from 'lucide-react';
import { RecordedMeeting, TranscriptItem } from '../types';
import { analyzeMeeting } from '../services/geminiService';

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
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // AI processing state

  // Transcription State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isTranscribingRef = useRef(false); // Ref to track state inside callbacks
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const recognitionRef = useRef<any>(null);
  const [sidebarMode, setSidebarMode] = useState<'PARTICIPANTS' | 'TRANSCRIPT'>('PARTICIPANTS');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false); // Mobile sidebar toggle

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

    if (isCameraOn) {
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
  }, [isCameraOn]);

  useEffect(() => {
    isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  useEffect(() => {
    const shouldListen = isTranscribing || isRecording;

    if (shouldListen) {
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
        if (currentlyListening && recognitionRef.current) {
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
  }, [isTranscribing, isRecording, isGuest]);

  const toggleMic = () => setIsMicOn(!isMicOn);
  const toggleCamera = () => setIsCameraOn(!isCameraOn);
  const toggleTranscription = () => setIsTranscribing(!isTranscribing);
  
  const toggleRecording = () => {
      if (isGuest) return; // Guests cannot record
      setIsRecording(!isRecording);
      if (!isRecording) setTranscript([]);
  };

  const handleHangUp = async () => {
      if (isRecording && transcript.length > 0 && !isGuest) {
          setIsProcessing(true);
          const fullText = transcript.map(t => `${t.speaker} (${t.timestamp}): ${t.text}`).join('\n');
          const analysis = await analyzeMeeting(fullText);
          
          const newRecord: RecordedMeeting = {
              id: `rec-${Date.now()}`,
              title: "Reunião Gravada - " + new Date().toLocaleDateString(),
              date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
              duration: "45 min", 
              participants: ["Você", "Alice Silva", "Roberto Santos"],
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
  };

  const handleShareLink = () => {
      const inviteLink = `${window.location.origin}${window.location.pathname}?guest=true&meetingId=123`;
      navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
  };

  const retryCamera = () => {
      setIsCameraOn(false);
      setTimeout(() => setIsCameraOn(true), 100);
  };

  if (isProcessing) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111623] text-white">
              <Loader2 size={48} className="text-[#20bbe3] animate-spin mb-4" />
              <h2 className="text-2xl font-bold mb-2">Processando Reunião...</h2>
              <p className="text-slate-400">A IA está gerando o resumo e plano de ação.</p>
          </div>
      );
  }

  // Adjust container height based on whether it is a guest view (full screen) or embedded
  const containerClass = isGuest ? "h-screen w-full p-0 sm:p-4" : "h-[calc(100vh-140px)]";

  return (
    <div className={`${containerClass} flex flex-col lg:flex-row gap-4 animate-in fade-in duration-500 relative bg-[#111623]`}>
        
        {linkCopied && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#20bbe3] text-[#111623] px-4 py-2 rounded-lg font-bold shadow-lg shadow-[#20bbe3]/30 flex items-center gap-2 animate-in slide-in-from-top-2">
                <Check size={18} />
                Link copiado!
            </div>
        )}

        {/* Main Video Area */}
        <div className="flex-1 bg-[#111623] rounded-none sm:rounded-2xl relative overflow-hidden flex flex-col shadow-2xl border-none sm:border border-[#1687cb]/10 group">
            
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-white font-medium text-sm border border-white/10">
                    Reunião {isGuest && "(Visitante)"}
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
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain transform scale-x-[-1]" />
                ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-[#1687cb] to-[#20bbe3] flex items-center justify-center text-3xl sm:text-4xl font-bold text-[#111623]">
                        {isGuest ? 'VS' : 'EU'}
                    </div>
                )}
                
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded text-white text-sm font-medium z-10">
                    {isGuest ? 'Visitante' : 'Você'} {isMicOn ? '' : '(Muted)'}
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="h-20 bg-[#1e2e41] flex items-center px-4 border-t border-[#1687cb]/10 relative z-20 shrink-0">
                <div className="flex-1 overflow-x-auto custom-scrollbar flex items-center justify-center py-2">
                    <div className="flex items-center gap-3">
                        <button onClick={toggleMic} className={`p-3 md:p-4 rounded-full transition-all duration-200 shrink-0 ${isMicOn ? 'bg-[#2d3f57] hover:bg-[#3d5375] text-white' : 'bg-red-500 text-white'}`}>
                            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>
                        
                        <button onClick={toggleCamera} className={`p-3 md:p-4 rounded-full transition-all duration-200 shrink-0 ${isCameraOn ? 'bg-[#2d3f57] hover:bg-[#3d5375] text-white' : 'bg-red-500 text-white'}`}>
                            {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                        </button>

                        {!isGuest && (
                            <button onClick={toggleRecording} className={`p-3 md:p-4 rounded-full transition-all duration-200 shrink-0 ${isRecording ? 'bg-white text-red-600 shadow-lg' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`}>
                                <CircleDot size={20} className={isRecording ? "animate-pulse fill-red-600" : ""} />
                            </button>
                        )}

                        <button onClick={toggleTranscription} className={`p-3 md:p-4 rounded-full transition-all duration-200 shrink-0 ${isTranscribing ? 'bg-[#20bbe3] text-[#111623]' : 'bg-[#2d3f57] hover:bg-[#3d5375] text-white'}`}>
                            <Captions size={20} />
                        </button>

                        <button onClick={handleShareLink} className="p-3 md:p-4 rounded-full bg-[#2d3f57] hover:bg-[#3d5375] text-white shrink-0">
                            <Share size={20} />
                        </button>

                        <button onClick={() => setShowMobileSidebar(!showMobileSidebar)} className={`lg:hidden p-3 md:p-4 rounded-full transition-colors shrink-0 ${showMobileSidebar ? 'bg-[#20bbe3]/20 text-[#20bbe3]' : 'bg-[#2d3f57] text-white'}`}>
                            <MessageSquare size={20} />
                        </button>

                        <button onClick={handleHangUp} className="p-3 md:p-4 rounded-full bg-red-500 hover:bg-red-600 text-white w-14 md:w-16 flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0 ml-2">
                            <PhoneOff size={24} />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Sidebar (Desktop + Mobile Overlay) */}
        <div className={`
            fixed lg:static inset-0 lg:inset-auto z-40 bg-[#111623] lg:bg-[#1e2e41] lg:w-80 lg:rounded-2xl lg:border lg:border-[#1687cb]/10 lg:flex flex-col
            transition-transform duration-300 transform 
            ${showMobileSidebar ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        `}>
            {/* Mobile Sidebar Header */}
            <div className="lg:hidden p-4 border-b border-[#1687cb]/10 flex justify-between items-center">
                <h3 className="font-bold text-white">Detalhes da Reunião</h3>
                <button onClick={() => setShowMobileSidebar(false)} className="text-slate-400">
                    <Check size={24} />
                </button>
            </div>

            <div className="flex border-b border-[#1687cb]/10 bg-[#111623]/20 rounded-t-none lg:rounded-t-2xl">
                <button onClick={() => setSidebarMode('PARTICIPANTS')} className={`flex-1 py-3 text-sm font-bold transition-colors ${sidebarMode === 'PARTICIPANTS' ? 'text-white border-b-2 border-[#20bbe3]' : 'text-slate-500'}`}>
                    Participantes
                </button>
                <button onClick={() => setSidebarMode('TRANSCRIPT')} className={`flex-1 py-3 text-sm font-bold transition-colors ${sidebarMode === 'TRANSCRIPT' ? 'text-white border-b-2 border-[#20bbe3]' : 'text-slate-500'}`}>
                    Transcrição
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {sidebarMode === 'PARTICIPANTS' ? (
                    [
                        { name: isGuest ? "Visitante (Você)" : "Você", role: isGuest ? "Convidado" : "Organizador", active: true },
                        { name: isGuest ? "Organizador" : "Visitante", role: isGuest ? "Organizador" : "Convidado", active: false },
                    ].map((p, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 hover:bg-[#111623]/30 rounded-lg transition-colors group">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1687cb] to-[#2d3f57] flex items-center justify-center text-white font-bold text-sm relative">
                                {p.name.charAt(0)}
                                {p.active && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#1e2e41] rounded-full"></div>}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-white">{p.name}</p>
                                <p className="text-xs text-slate-400">{p.role}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="space-y-4">
                        {transcript.map((item) => (
                            <div key={item.id} className="animate-in slide-in-from-bottom-2 fade-in">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-[#20bbe3]">{item.speaker}</span>
                                    <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                                </div>
                                <div className="bg-[#111623]/50 p-2.5 rounded-lg rounded-tl-none border border-[#1687cb]/10">
                                    <p className="text-sm text-slate-200">{item.text}</p>
                                </div>
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
