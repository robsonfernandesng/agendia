import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, CalendarDays, MessageSquare, Clock, ArrowRight, BellRing, CheckCircle2, RefreshCw, Trash2, ChevronLeft, ChevronRight, LayoutList, Calendar as CalendarIcon, LogOut, Settings, Link as LinkIcon, Copy, Plus, DollarSign, Users, LineChart, Wrench, ShoppingCart, UserSquare, Megaphone, Menu, X, Mic, MicOff, Tag, Play, AlertCircle, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Auth } from './components/Auth';
import { Onboarding, SEGMENTS } from './components/Onboarding';
import FinanceTab from './pages/FinanceTab';
import CategoriesTab from './pages/CategoriesTab';
import ClientsTab from './pages/ClientsTab';
import ReportsTab from './pages/ReportsTab';
import ServicesTab from './pages/ServicesTab';
import ProductsTab from './pages/ProductsTab';
import ProfessionalsTab from './pages/ProfessionalsTab';
import MarketingTab from './pages/MarketingTab';
import { usePushNotifications } from './hooks/usePushNotifications';

const stopNativeSpeech = async (recognitionRef: React.MutableRefObject<any>, setIsListening: (state: boolean) => void) => {
  try {
    if (recognitionRef.current) {
      recognitionRef.current.manualStop = true;
    }
    if (Capacitor.isNativePlatform()) {
      await SpeechRecognition.stop().catch(() => {});
      await SpeechRecognition.removeAllListeners().catch(() => {});
    } else if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
      recognitionRef.current.stop();
    }
  } catch (error) {
    console.error("Failed to stop voice input:", error);
  } finally {
    recognitionRef.current = null;
    setIsListening(false);
  }
};

const playBeep = (type: 'start' | 'send' | 'cancel') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'start') {
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'send') {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'cancel') {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

const startNativeSpeech = async (
  recognitionRef: React.MutableRefObject<any>, 
  setIsListening: (state: boolean) => void, 
  setInput: React.Dispatch<React.SetStateAction<string>>, 
  cleanInput: string,
  onFinalResult?: (transcript: string) => void,
  onError?: (error: string | null) => void
) => {
  if (onError) onError(null);
  
  // Prevent multiple starts
  if (recognitionRef.current) {
    console.warn("Speech recognition already in progress or starting");
    return;
  }

  const isIframe = () => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  };

  // Set a placeholder to indicate we are starting
  recognitionRef.current = { isStarting: true };

  if (Capacitor.isNativePlatform()) {
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        const err = "Reconhecimento de voz não está disponível neste dispositivo.";
        if (onError) onError(err); else alert(err);
        return;
      }
      const { speechRecognition } = await SpeechRecognition.requestPermissions();
      if (speechRecognition !== 'granted') {
        const err = "Permissão de microfone negada. Libere nas configurações do app.";
        if (onError) onError(err); else alert(err);
        return;
      }

      await SpeechRecognition.removeAllListeners();
      
      recognitionRef.current = {
        isNative: true,
        manualStop: false,
        stop: async () => {
          if (recognitionRef.current) recognitionRef.current.manualStop = true;
          await SpeechRecognition.stop().catch(() => {});
          await SpeechRecognition.removeAllListeners().catch(() => {});
        }
      };
      
      let currentBaseInput = cleanInput;

      await SpeechRecognition.addListener('partialResults', ({ matches }) => {
        const transcript = matches?.[0]?.trim();
        if (transcript) {
          const fullText = currentBaseInput ? `${currentBaseInput} ${transcript}` : transcript;
          setInput(fullText);
        }
      });

      await SpeechRecognition.addListener('listeningState', ({ status }) => {
        // Only update if we haven't manually stopped
        if (recognitionRef.current && !recognitionRef.current.manualStop) {
          setIsListening(status === 'started');
        }
      });

      setIsListening(true);
      
      while (recognitionRef.current && !recognitionRef.current.manualStop) {
        try {
          const { matches } = await SpeechRecognition.start({
            language: 'pt-BR',
            maxResults: 1,
            partialResults: true,
            popup: false,
            prompt: 'Fale agora'
          });

          const finalTranscript = matches?.[0]?.trim();
          if (finalTranscript) {
            const fullText = currentBaseInput ? `${currentBaseInput} ${finalTranscript}` : finalTranscript;
            setInput(fullText);
            currentBaseInput = fullText;
            if (onFinalResult) onFinalResult(fullText);
          }
        } catch (err) {
          console.error("Cycle error in native speech:", err);
          // If it's a real error (not just timeout), break
          if (err && (err as any).message && (err as any).message.includes('denied')) break;
        }
        
        // Small pause before restarting
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (recognitionRef.current && !recognitionRef.current.manualStop) {
          console.log("Native speech recognition cycle ended, restarting...");
        }
      }
      
      setIsListening(false);
    } catch (err) {
      console.error("Native speech recognition error:", err);
      recognitionRef.current = null;
      setIsListening(false);
    }
    return;
  }
  
  try {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      const err = "Seu navegador não suporta reconhecimento de voz.";
      if (onError) onError(err); else alert(err);
      return;
    }

    // Explicitly request microphone permission first to trigger the prompt reliably
    try {
      console.log("Requesting microphone permission via getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just wanted the permission
      stream.getTracks().forEach(track => track.stop());
      console.log("Microphone permission granted");
    } catch (micErr: any) {
      console.error("Microphone permission error:", micErr);
      let userFriendlyError = "Erro ao acessar o microfone.";
      
      if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError' || micErr.message?.includes('denied')) {
        userFriendlyError = "Permissão de microfone negada.";
        if (isIframe()) {
          userFriendlyError += " O navegador bloqueia o microfone em visualizações incorporadas. Por favor, clique no botão 'Abrir em nova aba' no topo da tela para usar o áudio.";
        } else {
          userFriendlyError += " Verifique se você permitiu o acesso no navegador ou nas configurações do sistema.";
        }
      } else if (micErr.name === 'NotFoundError' || micErr.name === 'DevicesNotFoundError') {
        userFriendlyError = "Nenhum microfone encontrado. Verifique se o microfone está conectado.";
      } else if (micErr.name === 'SecurityError') {
        userFriendlyError = "Erro de segurança ao acessar o microfone. Tente abrir o aplicativo em uma nova aba.";
      }
      
      if (onError) onError(userFriendlyError); else alert(userFriendlyError);
      setIsListening(false);
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let currentBaseInput = cleanInput;
    let lastFullTranscript = '';
    
    recognition.onstart = () => {
      console.log("Speech recognition started");
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let isFinal = false;
      let fullTranscript = '';
      
      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          isFinal = true;
        }
      }
      
      lastFullTranscript = fullTranscript;
      
      if (fullTranscript) {
        const textToSet = currentBaseInput ? `${currentBaseInput} ${fullTranscript}` : fullTranscript;
        setInput(textToSet);
        
        if (isFinal && onFinalResult) {
          onFinalResult(textToSet);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);

      if (event.error === 'aborted' || event.error === 'no-speech') {
        console.log("Speech recognition info:", event.error);
        // Don't stop listening state yet, let onend handle restart if needed
        return;
      }
      
      if (event.error === 'network') {
        // Network errors are common and often transient. 
        // We'll let onend try to restart it without showing a disruptive alert immediately.
        console.warn("Network error detected. Will attempt to restart automatically.");
        if (onError) onError("Conexão instável. Tentando reconectar...");
        return;
      }
      
      if (event.error === 'not-allowed') {
        let err = "Permissão de microfone negada.";
        if (isIframe()) {
          err += " O navegador bloqueia o microfone em visualizações incorporadas. Por favor, abra em uma nova aba.";
        } else {
          err += " Verifique as permissões do seu navegador.";
        }
        if (onError) onError(err); else alert(err);
      } else if (event.error === 'audio-capture') {
        const err = "Nenhum microfone encontrado ou erro na captura de áudio.";
        if (onError) onError(err); else alert(err);
      } else {
        const err = "Erro no reconhecimento de voz: " + event.error;
        if (onError) onError(err); else alert(err);
      }
      
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      if (recognitionRef.current && !recognitionRef.current.manualStop) {
        console.log("Restarting speech recognition cycle...");
        currentBaseInput = currentBaseInput ? `${currentBaseInput} ${lastFullTranscript}` : lastFullTranscript;
        lastFullTranscript = '';
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart recognition:", e);
          setIsListening(false);
          recognitionRef.current = null;
        }
      } else {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };
    
    // Set ref before starting to prevent race conditions
    recognitionRef.current = recognition;
    recognitionRef.current.manualStop = false;
    
    console.log("Starting speech recognition...");
    try {
      recognition.start();
    } catch (startErr) {
      console.error("Error calling recognition.start():", startErr);
      recognitionRef.current = null;
      setIsListening(false);
    }
  } catch (err: any) {
    console.error("Speech recognition setup error:", err);
    recognitionRef.current = null;
    setIsListening(false);
    alert("Ocorreu um erro ao iniciar o reconhecimento de voz.");
  }
};

const SYSTEM_INSTRUCTION = `Você é um assistente inteligente de organização pessoal e financeira.

Seu papel é entender a intenção do usuário e responder de forma curta e direta.

━━━━━━━━━━━━━━━━━━━
🎯 REGRA CRÍTICA DE FINANÇAS
Você SÓ deve registrar transações financeiras (despesas ou receitas) se o usuário disser explicitamente a frase **"salvar no financeiro"**. 
Se o usuário mencionar um valor, gasto ou ganho SEM dizer **"salvar no financeiro"**, apenas responda de forma informativa sem gerar o bloco [TRANSACAO].

━━━━━━━━━━━━━━━━━━━
✨ ESTILO DE RESPOSTA
- Use **negrito** para destacar informações importantes (datas, valores, nomes, categorias).
- Use emojis para tornar a conversa mais amigável e fácil de entender.
- Mantenha as respostas curtas e objetivas.

━━━━━━━━━━━━━━━━━━━
🎯 INTENÇÕES E FORMATOS OBRIGATÓRIOS

1. SE O USUÁRIO PEDIR PARA AGENDAR ALGO:
Responda confirmando o agendamento de forma breve.
Exemplo: "✅ Agendamento confirmado para [Data] às [Hora]."
E OBRIGATORIAMENTE adicione no final (invisível para o usuário):
[AGENDAMENTO: {"servico": "descrição", "dia": "DD/MM/YYYY", "hora": "HH:MM", "timestamp": "YYYY-MM-DDTHH:mm:ss"}]

2. SE O USUÁRIO PEDIR PARA REAGENDAR OU ALTERAR UM COMPROMISSO:
Identifique o compromisso na lista de agendamentos fornecida no contexto.
Responda confirmando a alteração.
Exemplo: "✅ Horário alterado com sucesso para [Data] às [Hora]."
E OBRIGATORIAMENTE adicione no final (invisível para o usuário):
[REAGENDAMENTO: {"id": "ID_ORIGINAL", "servico": "descrição", "dia": "DD/MM/YYYY", "hora": "HH:MM", "timestamp": "YYYY-MM-DDTHH:mm:ss"}]

3. SE O USUÁRIO PEDIR PARA REGISTRAR UMA DESPESA, RECEITA OU FATURA:
Responda confirmando a transação.
Exemplo: "✅ Transação registrada com sucesso."
E OBRIGATORIAMENTE adicione no final (invisível para o usuário):
[TRANSACAO: {"type": "expense" ou "income", "category": "Categoria", "description": "Descrição", "amount": 150.50, "date": "YYYY-MM-DD", "status": "paid"}]

3. SE O USUÁRIO MENCIONAR UMA NOVA CATEGORIA OU SERVIÇO (ex: "agendar internet", "pagar carro"):
Você DEVE extrair a categoria principal (ex: "internet", "carro") e adicionar no final da sua resposta (invisível para o usuário):
[CATEGORIA: {"name": "Nome da Categoria", "type": "expense" ou "income"}]

4. SE O USUÁRIO PEDIR UM RESUMO DO DIA OU APENAS CUMPRIMENTAR:
Gere um RESUMO INTELIGENTE usando este padrão:

🗓️ Seu dia está organizado
{quantidade de compromissos: "Você tem X compromisso(s) agendado(s)." ou "Você não possui compromissos."}
{próximo horário, se houver: "Próximo horário: HH:MM."}
{alerta se próximo: "⚠️ Você tem um compromisso em breve."}
{orientação: "Acesse a aba 'Agenda' para ver mais detalhes."}

━━━━━━━━━━━━━━━━━━━
🧠 REGRAS DE INTELIGÊNCIA

- Não use emojis no final das frases.
- Linguagem curta e profissional.
- Nunca invente dados.
- Se o usuário pedir para agendar ou registrar finanças, NÃO mostre o resumo do dia, apenas confirme a ação e envie o JSON.
- O bloco JSON (AGENDAMENTO ou TRANSACAO) é crucial para o sistema funcionar. Nunca esqueça de incluí-lo quando o usuário pedir para agendar ou registrar finanças.
`;

const PERSONAL_SYSTEM_INSTRUCTION = SYSTEM_INSTRUCTION;

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: Date;
  isAudio?: boolean;
  audioDuration?: string;
};

type Appointment = {
  id: string;
  servico: string;
  dia: string;
  hora: string;
  timestamp: number;
  notified: boolean;
  client_name?: string;
};

const playAlarmSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playBeep = (timeOffset: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime + timeOffset);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + timeOffset + 0.2);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + timeOffset);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + timeOffset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + timeOffset + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + timeOffset);
      osc.stop(ctx.currentTime + timeOffset + 0.25);
    };

    playBeep(0);
    playBeep(0.3);
    playBeep(0.6);
    playBeep(0.9);
  } catch (e) {
    console.error("Audio API not supported", e);
  }
};

const formatAppointmentDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const today = new Date();
  
  const isToday = date.getDate() === today.getDate() && 
                  date.getMonth() === today.getMonth() && 
                  date.getFullYear() === today.getFullYear();
                  
  if (isToday) {
    return "Hoje";
  }
  
  const isCurrentYear = date.getFullYear() === today.getFullYear();
  
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho", 
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  if (isCurrentYear) {
    return `${day} de ${month}`;
  } else {
    return `${day} de ${month} de ${year}`;
  }
};

const AudioWaveform = ({ isListening, count = 15 }: { isListening: boolean, count?: number }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-8 w-full max-w-[200px] mx-auto overflow-hidden">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className={`w-1 bg-[#3660F9] rounded-full transition-all duration-150 ${
            isListening ? 'animate-waveform' : 'h-1'
          }`}
          style={{
            height: isListening ? `${Math.random() * 60 + 20}%` : '4px',
            animationDelay: `${i * 0.05}s`,
            animationDuration: '0.5s'
          }}
        />
      ))}
    </div>
  );
};

const AudioMessage = ({ duration, role }: { duration?: string, role: string }) => {
  return (
    <div className="flex items-center gap-3 min-w-[220px] py-1">
      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
        role === 'user' ? 'bg-[#4066ed] text-white' : 'bg-gray-100 text-[#3660F9]'
      }`}>
        <Play size={22} fill="currentColor" className="ml-0.5" />
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-7">
          {[...Array(28)].map((_, i) => (
            <div
              key={i}
              className={`w-[2px] rounded-full ${role === 'user' ? 'bg-white/40' : 'bg-gray-300'}`}
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between items-center">
          <span className={`text-[10px] font-medium ${role === 'user' ? 'text-white/80' : 'text-gray-500'}`}>
            {duration || '0:05'}
          </span>
          <div className="flex items-center gap-1">
            {role === 'user' && <Mic size={12} className="text-[#D1FD57]" />}
            {role === 'user' && (
              <div className="flex -space-x-1">
                <CheckCircle2 size={12} className="text-[#D1FD57]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/:slug" element={<PublicBooking />} />
    </Routes>
  );
}

function PublicBooking() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [professional, setProfessional] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<any[]>([]);
  const chatInitialized = useRef(false);
  const recognitionRef = useRef<any>(null);
  const voiceTranscriptRef = useRef('');
  const recordingStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (input === '') {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(ta => {
        ta.style.height = '48px';
      });
    }
  }, [input]);

  useEffect(() => {
    const fetchProfessional = async () => {
      try {
        const res = await fetch(`/api/public/professionals/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setProfessional(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfessional();
  }, [slug]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!professional || chatInitialized.current) return;
    
    const initChat = async () => {
      chatInitialized.current = true;
      const initialMessage = `👋 Olá! Sou o assistente virtual do(a) **${professional.name}**. Como posso ajudar você hoje? Gostaria de **agendar um horário**?\n\n💡 *Dica: Para registrar algo no financeiro, utilize a frase **"salvar no financeiro"**.*`;
      
      setMessages([{
        id: '1',
        text: initialMessage,
        role: 'model',
        timestamp: new Date()
      }]);

      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, -1);

      let parsedHours = [];
      try {
        if (professional.business_hours) {
          parsedHours = typeof professional.business_hours === 'string' ? JSON.parse(professional.business_hours) : professional.business_hours;
        }
      } catch (e) {
        console.error('Error parsing business hours', e);
      }

      const systemPrompt = `Você é o assistente virtual exclusivo de agendamentos do profissional "${professional.name}".
Seu objetivo é ajudar os clientes a agendar ou REAGENDAR serviços com ele de forma amigável, rápida e eficiente.

Siga estes passos para NOVOS AGENDAMENTOS:
1. Cumprimente e pergunte o nome do cliente e qual serviço ele deseja.
2. Pergunte o dia e horário de preferência.
3. Confirme os dados (Serviço, Dia, Hora e Nome do Cliente). Quando pedir esta confirmação, adicione EXATAMENTE a tag [BOTOES_CONFIRMACAO] no final da sua mensagem.
4. Após o cliente confirmar com "Sim", comemore e gere o JSON de agendamento usando a tag [AGENDAMENTO].

Siga estes passos para REAGENDAMENTOS:
1. Identifique qual compromisso o cliente deseja alterar na lista de compromissos já agendados abaixo.
2. Pergunte qual a nova data, horário ou informação que deve ser alterada.
3. Confirme a alteração (Serviço, Nova Data, Novo Horário). Adicione a tag [BOTOES_CONFIRMACAO] no final.
4. Após o cliente confirmar com "Sim", comemore e gere o JSON de reagendamento usando a tag [REAGENDAMENTO] incluindo o ID original. NUNCA use a tag [AGENDAMENTO] para alterações.

INFORMAÇÃO DE CONTEXTO: A data e hora atual do sistema é ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')} (ISO: ${localISOTime}). O ano atual é ${now.getFullYear()}. Todos os agendamentos devem ser feitos para o ano atual ou futuro, NUNCA para anos passados.

INFORMAÇÕES DO PROFISSIONAL:
- Segmento: ${professional.business_segment || 'Não especificado'}
- Endereço: ${professional.business_address || 'Não especificado'}
- Horário de Funcionamento: ${parsedHours.length > 0 ? parsedHours.map((h: any) => `${h.day}: ${h.open} às ${h.close}`).join(', ') : 'Não especificado'}
- Serviços Oferecidos: ${professional.services && professional.services.length > 0 ? professional.services.map((s: any) => `${s.name} (R$ ${s.price}, ${s.duration})`).join(' | ') : 'Não especificados'}

AGENDAMENTOS EXISTENTES (NÃO MARQUE NESTES HORÁRIOS):
${professional.appointments && professional.appointments.length > 0 ? professional.appointments.slice(0, 15).map((a: any) => `- ID: ${a.id} | ${a.dia} às ${a.hora} | Serviço: ${a.servico}`).join('\n') : 'Nenhum agendamento futuro próximo.'}

MUITO IMPORTANTE - FORMATOS DE SAÍDA:
Para NOVO AGENDAMENTO:
[AGENDAMENTO: {"servico": "nome do servico", "dia": "DD/MM/YYYY", "hora": "HH:MM", "timestamp": "YYYY-MM-DDTHH:mm:ss", "client_name": "nome do cliente"}]

Para REAGENDAMENTO (Alterar um existente):
[REAGENDAMENTO: {"id": "ID_DO_COMPROMISSO_ORIGINAL", "servico": "novo ou mesmo servico", "dia": "DD/MM/YYYY", "hora": "HH:MM", "timestamp": "YYYY-MM-DDTHH:mm:ss", "client_name": "nome do cliente"}]

Exemplo de reagendamento:
"Com certeza! Alterei seu horário. Agora está marcado para 20/10 às 15:00.
[REAGENDAMENTO: {"id": "12345", "servico": "Corte", "dia": "20/10/2024", "hora": "15:00", "timestamp": "2024-10-20T15:00:00", "client_name": "João"}]"`;

      chatHistoryRef.current = [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: initialMessage }
      ];
    };

    initChat();
  }, [professional]);

  const handleSend = async (textOverride?: string | any, isAudioMessage: boolean = false, audioDuration?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    if (!textToSend.trim() || !professional) return;

    const userMsg = textToSend.trim();
    if (!textOverride) setInput('');
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userMsg,
      role: 'user',
      timestamp: new Date(),
      isAudio: isAudioMessage,
      audioDuration: isAudioMessage ? (audioDuration || '0:05') : undefined
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    chatHistoryRef.current.push({ role: 'user', content: userMsg });

    try {
      // Update system prompt with latest appointments context
      if (chatHistoryRef.current.length > 0 && chatHistoryRef.current[0].role === 'system') {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, -1);
        
        const appointmentsContext = professional.appointments && professional.appointments.length > 0 
          ? `\n\nATENÇÃO - COMPROMISSOS JÁ AGENDADOS DO PROFISSIONAL:\n${professional.appointments.slice(0, 15).map((app: any) => `- ID: ${app.id} | ${app.dia} às ${app.hora} | Serviço: ${app.servico}${app.client_name ? ' | Cliente: ' + app.client_name : ''}`).join('\n')}\nNÃO agende novos compromissos nestes horários, pois o profissional já está ocupado.`
          : `\n\nATENÇÃO - COMPROMISSOS JÁ AGENDADOS DO PROFISSIONAL: Nenhum compromisso agendado próximo. A agenda está livre.`;

        const updatedSystemPrompt = `Você é o assistente virtual exclusivo de agendamentos do profissional "${professional.name}".
Seu objetivo é ajudar os clientes a agendar ou REAGENDAR serviços com ele de forma amigável, rápida e eficiente.

Siga estes passos para NOVOS AGENDAMENTOS:
1. Cumprimente e pergunte o nome do cliente e qual serviço ele deseja.
2. Pergunte o dia e horário de preferência.
3. Confirme os dados (Serviço, Dia, Hora e Nome do Cliente). Quando pedir esta confirmação, adicione EXATAMENTE a tag [BOTOES_CONFIRMACAO] no final da sua mensagem.
4. Após o cliente confirmar com "Sim", comemore e gere o JSON de agendamento usando a tag [AGENDAMENTO].

Siga estes passos para REAGENDAMENTOS:
1. Identifique qual compromisso o cliente deseja alterar na lista de compromissos já agendados abaixo.
2. Pergunte qual a nova data, horário ou informação que deve ser alterada.
3. Confirme a alteração (Serviço, Nova Data, Novo Horário). Adicione a tag [BOTOES_CONFIRMACAO] no final.
4. Após o cliente confirmar com "Sim", comemore e gere o JSON de reagendamento usando a tag [REAGENDAMENTO] incluindo o ID original. NUNCA use a tag [AGENDAMENTO] para alterações.

INFORMAÇÃO DE CONTEXTO: A data e hora atual do sistema é ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')} (ISO: ${localISOTime}). O ano atual é ${now.getFullYear()}. Todos os agendamentos devem ser feitos para o ano atual ou futuro, NUNCA para anos passados.${appointmentsContext}

MUITO IMPORTANTE - FORMATOS DE SAÍDA:
Para NOVO AGENDAMENTO:
[AGENDAMENTO: {"servico": "nome do servico", "dia": "DD/MM/YYYY", "hora": "HH:MM", "timestamp": "YYYY-MM-DDTHH:mm:ss", "client_name": "nome do cliente"}]

Para REAGENDAMENTO (Alterar um existente):
[REAGENDAMENTO: {"id": "ID_DO_COMPROMISSO_ORIGINAL", "servico": "novo ou mesmo servico", "dia": "DD/MM/YYYY", "hora": "HH:MM", "timestamp": "YYYY-MM-DDTHH:mm:ss", "client_name": "nome do cliente"}]

Exemplo de reagendamento:
"Com certeza! Alterei seu horário. Agora está marcado para 20/10 às 15:00.
[REAGENDAMENTO: {"id": "12345", "servico": "Corte", "dia": "20/10/2024", "hora": "15:00", "timestamp": "2024-10-20T15:00:00", "client_name": "João"}]"`;

        chatHistoryRef.current[0].content = updatedSystemPrompt;
      }

      const systemMessage = chatHistoryRef.current.find(m => m.role === 'system')?.content;
      // Otimização Crítica: Pega apenas as últimas 6 interações para evitar estouro de Limite de Tokens da Groq!
      const nonSystemMessages = chatHistoryRef.current.filter(m => m.role !== 'system');
      const recentMessages = nonSystemMessages.slice(-6);
      const contents = recentMessages
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contents,
          systemInstruction: systemMessage
        })
      });

      if (!res.ok) {
        throw new Error('Failed to fetch chat response');
      }

      const data = await res.json();
      const botResponse = data.text || "Desculpe, não entendi.";
      
      chatHistoryRef.current.push({ role: 'assistant', content: botResponse });

      // Check for appointment JSON
      const match = botResponse.match(/\[?[\s*]*AGENDAMENTO[\s*:]*(\{[\s\S]*?\})[\s\]]*/i);
      let cleanResponse = botResponse;
      
      if (match) {
        try {
          const jsonStr = match[1].replace(/,\s*}/g, '}');
          const appData = JSON.parse(jsonStr);
          cleanResponse = botResponse.replace(match[0], '').trim();
          
          // Save appointment
          await fetch('/api/public/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              professional_id: professional.id,
              servico: appData.servico,
              dia: appData.dia,
              hora: appData.hora,
              timestamp: new Date(appData.timestamp).getTime(),
              client_name: appData.client_name
            })
          });
          
        } catch (e) {
          console.error("Failed to parse or save appointment JSON:", e);
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: cleanResponse,
        role: 'model',
        timestamp: new Date()
      }]);

    } catch (error) {
      console.error("Groq API Error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "Desculpe, estou com problemas técnicos no momento. Tente novamente mais tarde.",
        role: 'model',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopAndSendAudio = async () => {
    console.log("Stopping recording and sending (PublicBooking)...");
    
    if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const finalTranscript = voiceTranscriptRef.current;
    console.log("Final transcript captured (PublicBooking):", finalTranscript);
    
    await stopNativeSpeech(recognitionRef, setIsListening);
    playBeep('send');
    
    if (finalTranscript.trim()) {
      handleSend(finalTranscript, true, durationStr);
    } else {
      console.warn("No transcript detected (PublicBooking), audio message not sent.");
      handleSend("Áudio inaudível", true, durationStr);
    }
  };

  const toggleRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isListening) {
      console.log("Cancelling recording (PublicBooking)...");
      if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      await stopNativeSpeech(recognitionRef, setIsListening);
      setInput('');
      voiceTranscriptRef.current = '';
    } else {
      console.log("Starting recording (PublicBooking)...");
      playBeep('start');
      setInput('');
      voiceTranscriptRef.current = '';
      recordingStartTimeRef.current = Date.now();
      
      await startNativeSpeech(
        recognitionRef, 
        setIsListening, 
        ((val: any) => {
          if (typeof val === 'function') {
            const newVal = val(voiceTranscriptRef.current);
            voiceTranscriptRef.current = newVal;
            console.log("Transcript updated (PublicBooking func):", newVal);
          } else {
            voiceTranscriptRef.current = val;
            console.log("Transcript updated (PublicBooking val):", val);
          }
        }) as any, 
        '',
        undefined,
        setMicError
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#EEF2FF] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#3660F9]" />
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="flex flex-col h-screen bg-[#EEF2FF] font-sans text-[#17161A] items-center justify-center p-6">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <User size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Profissional não encontrado</h1>
          <p className="text-gray-500 mb-8">O link que você acessou é inválido ou não existe mais.</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-[#17161A] text-white py-4 rounded-full font-bold hover:bg-[#3660F9] transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#EEF2FF] font-sans text-[#17161A] selection:bg-[#D1FD57] selection:text-[#17161A]">
      <header className="pt-8 pb-4 px-6 sm:px-8 flex items-center justify-between shrink-0 max-w-4xl w-full mx-auto">
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-1">Agendamento Online</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{professional.name}</h1>
        </div>
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
          <CalendarDays size={24} className="text-[#3660F9]" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 w-full max-w-4xl mx-auto scroll-smooth">
        <div className="space-y-6">
          {messages.map((msg, index) => {
            const hasButtons = msg.text.includes('[BOTOES_CONFIRMACAO]') || msg.text.includes('BOTOES_CONFIRMACAO');
            const cleanText = msg.text.replace(/\[?BOTOES_CONFIRMACAO\]?/g, '').trim();
            const isLastMessage = index === messages.length - 1;

            return (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                    msg.role === 'user' ? 'bg-[#D1FD57] text-[#17161A]' : 'bg-[#3660F9] text-white'
                  }`}>
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <div className={`p-5 rounded-[24px] shadow-sm break-words ${
                      msg.role === 'user' 
                        ? 'bg-[#17161A] text-white rounded-tr-sm' 
                        : 'bg-white text-[#17161A] rounded-tl-sm border border-gray-100'
                    }`}>
                      <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-800">
                        {msg.isAudio && msg.role === 'user' ? (
                          <AudioMessage duration={msg.audioDuration} role={msg.role} />
                        ) : (
                          <ReactMarkdown>{cleanText}</ReactMarkdown>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold mt-2 block opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {hasButtons && isLastMessage && msg.role === 'model' && !isLoading && (
                      <div className="flex gap-2 mt-1">
                        <button 
                          onClick={() => handleSend('Sim')}
                          className="flex-1 bg-[#D1FD57] text-[#17161A] py-2.5 px-4 rounded-full font-bold text-sm hover:bg-[#bce64c] transition-colors shadow-sm"
                        >
                          Sim
                        </button>
                        <button 
                          onClick={() => handleSend('Não')}
                          className="flex-1 bg-white text-[#17161A] border border-gray-200 py-2.5 px-4 rounded-full font-bold text-sm hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          Não
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%] sm:max-w-[75%]">
                <div className="shrink-0 w-10 h-10 rounded-full bg-[#3660F9] text-white flex items-center justify-center shadow-sm">
                  <Bot size={20} />
                </div>
                <div className="bg-white p-5 rounded-[24px] rounded-tl-sm shadow-sm border border-gray-100 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#3660F9]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </main>

      <footer className="p-4 sm:p-6 pt-2 w-full max-w-4xl mx-auto shrink-0">
        {micError && (
          <div className="max-w-4xl mx-auto mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium leading-relaxed">{micError}</p>
              {micError.includes('nova aba') && (
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="mt-2 text-xs font-bold text-red-600 underline hover:text-red-700 flex items-center gap-1"
                >
                  <ExternalLink size={12} /> Abrir em nova aba
                </button>
              )}
            </div>
            <button onClick={() => setMicError(null)} className="text-red-400 hover:text-red-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end bg-white rounded-[32px] p-2 shadow-sm transition-all">
            {isListening ? (
              <div className="flex-1 flex items-center justify-center h-[48px] overflow-hidden">
                <AudioWaveform isListening={isListening} count={20} />
              </div>
            ) : (
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = '48px';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
                placeholder="Escreva sua mensagem..."
                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none overflow-hidden text-[#17161A] placeholder:text-gray-400 py-3 pl-5 pr-2 font-medium"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            )}
            <button
              onClick={toggleRecording}
              className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ml-2 select-none ${isListening ? 'bg-red-100 text-red-500 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={isListening ? "Cancelar gravação" : "Clique para falar"}
            >
              {isListening ? <Trash2 size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                if (isListening) {
                  stopAndSendAudio();
                } else {
                  handleSend();
                }
              }}
              disabled={(!isListening && !input.trim()) || isLoading}
              className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ml-2 ${isListening ? 'bg-[#D1FD57] text-[#17161A] hover:scale-105 animate-pulse' : 'bg-[#17161A] text-[#D1FD57] hover:scale-105 disabled:opacity-50 disabled:hover:scale-100'}`}
            >
              <Send size={20} className="ml-1" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Dashboard() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [activeTab, setActiveTab] = useState<'chat' | 'appointments' | 'profile' | 'finance' | 'categories' | 'clients' | 'reports' | 'services' | 'products' | 'professionals' | 'marketing'>('chat');
  const [agendaView, setAgendaView] = useState<'list' | 'calendar' | 'day'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<Appointment | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'default'>(
    "Notification" in window ? Notification.permission : "denied"
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<any[]>([]);
  const chatInitialized = useRef(false);
  const recognitionRef = useRef<any>(null);
  const voiceTranscriptRef = useRef('');
  const recordingStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (input === '') {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(ta => {
        ta.style.height = '48px';
      });
    }
  }, [input]);

  const filteredAppointments = appointments.filter(app => {
    if (appointmentFilter === 'all') return true;
    const isPending = app.timestamp > Date.now();
    if (appointmentFilter === 'pending') return isPending;
    if (appointmentFilter === 'completed') return !isPending;
    return true;
  }).sort((a, b) => a.timestamp - b.timestamp);

  usePushNotifications(token);

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  
  const nextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };
  const prevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };
  
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getAppointmentsForDate = (date: Date) => {
    return filteredAppointments.filter(app => {
      const appDate = new Date(app.timestamp);
      return appDate.getDate() === date.getDate() &&
             appDate.getMonth() === date.getMonth() &&
             appDate.getFullYear() === date.getFullYear();
    });
  };

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const showSystemNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        // Fallback for mobile devices that might require service workers for notifications
        navigator.serviceWorker?.getRegistration().then(reg => {
          if (reg) {
            reg.showNotification(title, { body, icon: '/vite.svg' });
          } else {
            new Notification(title, { body, icon: '/vite.svg' });
          }
        }).catch(() => {
          new Notification(title, { body, icon: '/vite.svg' });
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    }
  };

  // Fetch appointments on load
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!token) {
        setAppointmentsLoaded(true);
        return;
      }
      try {
        const res = await fetch('/api/appointments', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAppointments(data);
        }
      } catch (err) {
        console.error("Failed to fetch appointments:", err);
      } finally {
        setAppointmentsLoaded(true);
      }
    };

    const fetchCategories = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/categories', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };

    fetchAppointments();
    fetchCategories();
  }, [token]);

  // Alarm checker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setAppointments(prev => {
        let changed = false;
        const updated = prev.map(app => {
          if (!app.notified && now >= app.timestamp) {
            changed = true;
            setActiveAlarm(app);
            playAlarmSound();
            showSystemNotification("Lembrete: " + app.servico, "Seu compromisso está marcado para agora!");
            
            // Update DB
            fetch(`/api/appointments/${app.id}/notify`, { 
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${token}` }
            }).catch(console.error);
            
            return { ...app, notified: true };
          }
          return app;
        });
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (chatInitialized.current || !appointmentsLoaded) return;
    chatInitialized.current = true;

    const initChat = async () => {
      try {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, -1);
        
        // Sort appointments by timestamp
        const sortedAppointments = [...appointments].sort((a, b) => a.timestamp - b.timestamp);
        
        const appointmentsContext = sortedAppointments.length > 0 
          ? `\n\nATENÇÃO - TODOS OS COMPROMISSOS AGENDADOS DO USUÁRIO:\n${sortedAppointments.map(app => `- ID: ${app.id} | Cliente: ${app.client_name || 'Você mesmo'} | Serviço: ${app.servico} | Data: ${app.dia} | Horário: ${app.hora}`).join('\n')}`
          : `\n\nATENÇÃO - COMPROMISSOS JÁ AGENDADOS DO USUÁRIO: Nenhum compromisso agendado no momento.`;

        const baseInstruction = user?.role === 'user' ? PERSONAL_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION;
        const dynamicInstruction = `${baseInstruction}\n\nINFORMAÇÃO DE CONTEXTO: A data e hora atual do sistema é ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')} (ISO: ${localISOTime}). O ano atual é ${now.getFullYear()}. Todos os agendamentos devem ser feitos para o ano atual ou futuro, NUNCA para anos passados. Se o usuário pedir "daqui a 1 minuto", adicione exatamente 1 minuto a este tempo e retorne no campo timestamp.${appointmentsContext}`;

        chatHistoryRef.current = [
          { role: 'system', content: dynamicInstruction },
          { role: 'user', content: "Gere o resumo do meu dia seguindo o formato obrigatório do sistema. Use **negrito** e emojis para facilitar a leitura. No final do resumo, adicione uma nota lembrando que para salvar transações no financeiro é necessário dizer **'salvar no financeiro'**. Não agende nada, apenas mostre o resumo." }
        ];
          
          // Trigger initial greeting
          setIsLoading(true);

          const systemMessage = chatHistoryRef.current.find(m => m.role === 'system')?.content;
          const contents = chatHistoryRef.current
            .filter(m => m.role !== 'system')
            .map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            }));

          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: contents,
              systemInstruction: systemMessage
            })
          });

          if (!res.ok) {
            throw new Error('Failed to fetch chat response');
          }

          const data = await res.json();
          const responseText = data.text || "Olá! Como posso ajudar?";
          chatHistoryRef.current.push({ role: 'assistant', content: responseText });
          
          const visualText = processAIResponse(responseText);
          setMessages([{ id: Date.now().toString(), role: 'model', text: visualText }]);
        } catch (error: any) {
          console.error("Failed to initialize chat:", error);
          let errorMsg = "Desculpe, ocorreu um erro ao iniciar o chat. Por favor, recarregue a página.";
          if (error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('quota')) {
            errorMsg = "O limite de uso da inteligência artificial foi atingido no momento. Por favor, aguarde alguns minutos e recarregue a página.";
          }
          setMessages([{ id: Date.now().toString(), role: 'model', text: errorMsg }]);
        } finally {
          setIsLoading(false);
        }
      };

      initChat();
  }, [appointmentsLoaded, appointments, user]);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const processAIResponse = (responseText: string, userInput: string = "") => {
    let visualText = responseText;
    const hasFinancePhrase = userInput.toLowerCase().includes("salvar no financeiro");
    
    try {
      // Parse appointment data if present
      const apptRegex = /\[?[\s*]*\bAGENDAMENTO[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi;
      let matchAppt;
      while ((matchAppt = apptRegex.exec(visualText)) !== null) {
        try {
          const jsonStr = matchAppt[1].replace(/,\s*}/g, '}');
          const data = JSON.parse(jsonStr);
          
          let timestamp = new Date(data.timestamp).getTime();
          if (isNaN(timestamp)) {
            const hora = data.hora || "00:00";
            const dateParts = data.dia ? data.dia.split('/') : [];
            const isoDate = dateParts.length === 3 ? dateParts.reverse().join('-') : data.dia;
            timestamp = new Date(`${isoDate}T${hora}:00`).getTime();
            if (isNaN(timestamp)) timestamp = Date.now() + 60000;
          }

          const existingId = data.id;
          const isExisting = existingId && appointments.some(a => a.id === existingId);

          if (isExisting) {
            // Safety net: Handle as reschedule even if tag was [AGENDAMENTO]
            const updatedAppointment = {
              id: existingId,
              servico: data.servico || data.atividade || "Compromisso",
              dia: data.dia || data.data || "",
              hora: data.hora || "",
              timestamp,
              notified: false,
              client_name: data.client_name || data.cliente || (data.cliente !== 'Você' ? data.cliente : undefined)
            };
            setAppointments(prev => prev.map(a => a.id === existingId ? updatedAppointment : a));
            fetch(`/api/appointments/${existingId}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(updatedAppointment)
            }).catch(console.error);
          } else {
            const newAppointment = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              servico: data.servico || data.atividade || "Compromisso",
              dia: data.dia || data.data || "",
              hora: data.hora || "",
              timestamp,
              notified: false,
              client_name: data.cliente !== 'Você' ? data.cliente : undefined
            };

            setAppointments(prev => [...prev, newAppointment]);
            
            fetch('/api/appointments', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(newAppointment)
            })
            .then(res => res.json())
            .then(savedApp => {
              if (savedApp && savedApp.id) {
                setAppointments(prev => prev.map(a => a.id === newAppointment.id ? savedApp : a));
              }
            })
            .catch(console.error);
          }
        } catch (e) {
          console.error("Failed to parse appointment data", e);
        }
      }
      visualText = visualText.replace(/\[?[\s*]*\bAGENDAMENTO[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi, '').trim();

      // Parse rescheduling data if present
      const reagRegex = /\[?[\s*]*\bREAGENDAMENTO[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi;
      let matchReag;
      while ((matchReag = reagRegex.exec(visualText)) !== null) {
        try {
          const jsonStr = matchReag[1].replace(/,\s*}/g, '}');
          const data = JSON.parse(jsonStr);
          
          let timestamp = new Date(data.timestamp).getTime();
          if (isNaN(timestamp)) {
            const hora = data.hora || "00:00";
            const dateParts = data.dia ? data.dia.split('/') : [];
            const isoDate = dateParts.length === 3 ? dateParts.reverse().join('-') : data.dia;
            timestamp = new Date(`${isoDate}T${hora}:00`).getTime();
            if (isNaN(timestamp)) timestamp = Date.now() + 60000;
          }

          const updatedAppointment = {
            id: data.id,
            servico: data.servico || data.atividade || "Compromisso",
            dia: data.dia || data.data || "",
            hora: data.hora || "",
            timestamp,
            notified: false,
            client_name: data.client_name || data.cliente
          };

          setAppointments(prev => prev.map(a => a.id === data.id ? updatedAppointment : a));
          
          fetch(`/api/appointments/${data.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedAppointment)
          }).catch(console.error);
        } catch (e) {
          console.error("Failed to parse rescheduling data", e);
        }
      }
      visualText = visualText.replace(/\[?[\s*]*\bREAGENDAMENTO[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi, '').trim();

      // Parse transaction data if present
      const transRegex = /\[?[\s*]*\bTRANSACAO[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi;
      let matchTrans;
      while ((matchTrans = transRegex.exec(visualText)) !== null) {
        if (!hasFinancePhrase) {
          console.log("Financial transaction ignored because 'salvar no financeiro' was not in user input.");
          continue;
        }
        try {
          const jsonStr = matchTrans[1].replace(/,\s*}/g, '}');
          const data = JSON.parse(jsonStr);
          
          const transaction = {
            type: data.type || (data.tipo === 'receita' ? 'income' : 'expense'),
            category: data.category || data.categoria || "Geral",
            description: data.description || data.descricao || "",
            amount: data.amount || data.valor || 0,
            date: data.date || data.data || new Date().toISOString().split('T')[0],
            status: data.status || 'paid'
          };
          
          fetch('/api/transactions', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(transaction)
          }).catch(console.error);
        } catch (e) {
          console.error("Failed to parse transaction data", e);
        }
      }
      visualText = visualText.replace(/\[?[\s*]*\bTRANSACAO[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi, '').trim();

      // Parse category data if present
      const catRegex = /\[?[\s*]*\bCATEGORIA[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi;
      let matchCat;
      while ((matchCat = catRegex.exec(visualText)) !== null) {
        if (!hasFinancePhrase) {
          console.log("Financial category ignored because 'salvar no financeiro' was not in user input.");
          continue;
        }
        try {
          const jsonStr = matchCat[1].replace(/,\s*}/g, '}');
          const data = JSON.parse(jsonStr);
          
          const category = {
            name: data.name || data.nome || "Nova Categoria",
            type: data.type || (data.tipo === 'receita' ? 'income' : 'expense')
          };
          
          fetch('/api/categories', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(category)
          })
          .then(res => res.json())
          .then(newCat => {
            if (newCat && newCat.id) {
              setCategories(prev => [...prev, newCat]);
            }
          })
          .catch(console.error);
        } catch (e) {
          console.error("Failed to parse category data", e);
        }
      }
      visualText = visualText.replace(/\[?[\s*]*\bCATEGORIA[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi, '').trim();

      // Remove RESUMO DO DIA JSON block if the AI generates it
      visualText = visualText.replace(/\[?[\s*]*\bRESUMO DO DIA[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi, '').trim();
      visualText = visualText.replace(/\[?[\s*]*\bRESUMO[\s*:]*(\{[\s\S]*?\})[\s\]]*/gi, '').trim();

      // Also support the pure JSON format just in case
      const cleanJson = visualText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Check if it looks like JSON before attempting to parse
      if (cleanJson.startsWith('{') || cleanJson.startsWith('[')) {
        const data = JSON.parse(cleanJson);
        
        if (data.tipo === 'agendamento' || data.tipo === 'reagendamento') {
          const isReag = data.tipo === 'reagendamento' || (data.id && appointments.some(a => a.id === data.id));
          
          if (isReag) {
            visualText = `🔄 **Reagendamento**\n👤 Cliente: ${data.cliente || 'Você'}\n${data.emoji || '📅'} Atividade: ${data.atividade}\n📅 Nova Data: ${data.data_formatada || data.data + ' • ' + (data.hora || '')}\n━━━━━━━━━━━`;
          } else {
            visualText = `🗓️ **Agendamento**\n👤 Cliente: ${data.cliente || 'Você'}\n${data.emoji || '📅'} Atividade: ${data.atividade}\n📅 Data: ${data.data_formatada || data.data + ' • ' + (data.hora || '')}\n━━━━━━━━━━━`;
          }
          
          const hora = data.hora || "00:00";
          const dateParts = data.data ? data.data.split('/') : [];
          const isoDate = dateParts.length === 3 ? dateParts.reverse().join('-') : data.data;
          let timestamp = new Date(`${isoDate}T${hora}:00`).getTime();
          if (isNaN(timestamp)) {
            timestamp = Date.now() + 60000;
          }

          if (isReag && data.id) {
            const updatedAppointment = {
              id: data.id,
              servico: data.atividade,
              dia: data.data,
              hora: data.hora || "",
              timestamp,
              notified: false,
              client_name: data.cliente !== 'Você' ? data.cliente : undefined
            };
            setAppointments(prev => prev.map(a => a.id === data.id ? updatedAppointment : a));
            fetch(`/api/appointments/${data.id}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(updatedAppointment)
            }).catch(console.error);
          } else {
            const newAppointment = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              servico: data.atividade,
              dia: data.data,
              hora: data.hora || "",
              timestamp,
              notified: false,
              client_name: data.cliente !== 'Você' ? data.cliente : undefined
            };

            setAppointments(prev => [...prev, newAppointment]);
            
            fetch('/api/appointments', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(newAppointment)
            })
            .then(res => res.json())
            .then(savedApp => {
              if (savedApp && savedApp.id) {
                setAppointments(prev => prev.map(a => a.id === newAppointment.id ? savedApp : a));
              }
            })
            .catch(console.error);
          }
          
        } else if (data.tipo === 'despesa') {
          visualText = `${data.emoji || '💸'} **Despesa registrada**\n📌 Categoria: ${data.categoria}\n💰 Valor: R$ ${data.valor}\n📝 Descrição: ${data.descricao}\n📅 Data: ${data.data}\n━━━━━━━━━━━`;
          
          const transaction = {
            type: 'expense',
            category: data.categoria,
            description: data.descricao,
            amount: data.valor,
            date: data.data.includes('/') ? data.data.split('/').reverse().join('-') : data.data,
            status: 'paid'
          };
          
          fetch('/api/transactions', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(transaction)
          }).catch(console.error);
          
        } else if (data.tipo === 'receita') {
          visualText = `${data.emoji || '💰'} **Receita registrada**\n📌 Categoria: ${data.categoria}\n💵 Valor: R$ ${data.valor}\n📝 Descrição: ${data.descricao}\n📅 Data: ${data.data}\n━━━━━━━━━━━`;
          
          const transaction = {
            type: 'income',
            category: data.categoria,
            description: data.descricao,
            amount: data.valor,
            date: data.data.includes('/') ? data.data.split('/').reverse().join('-') : data.data,
            status: 'paid'
          };
          
          fetch('/api/transactions', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(transaction)
          }).catch(console.error);
          
        } else if (data.tipo === 'resumo') {
          if (data.subtipo === 'agendamentos') {
            visualText = `🗓️ **Resumo de agendamentos**\n\n(Acesse a aba "Agenda" para ver todos os detalhes)`;
          } else {
            visualText = `📊 **Resumo financeiro**\n\n(Acesse a aba "Financeiro" para ver todos os detalhes)`;
          }
        } else {
          visualText = responseText;
        }
      }
      
      return visualText;
    } catch (e) {
      // Only log if it actually looked like JSON but failed to parse
      if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
        console.error("Failed to parse AI JSON response:", e);
      }
      return visualText;
    }
  };

  const sendMessageToAI = async (text: string, skipUserMessage: boolean = false) => {
    if (!text.trim() || isLoading) return;

    if (!skipUserMessage) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }]);
    }
    setIsLoading(true);

    try {
      // Update system prompt with latest appointments context
      if (chatHistoryRef.current.length > 0 && chatHistoryRef.current[0].role === 'system') {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, -1);
        
        // Sort appointments by timestamp
        const sortedAppointments = [...appointments].sort((a, b) => a.timestamp - b.timestamp);
        
        const appointmentsContext = sortedAppointments.length > 0 
          ? `\n\nATENÇÃO - TODOS OS COMPROMISSOS AGENDADOS DO USUÁRIO:\n${sortedAppointments.map(app => `- ID: ${app.id} | Cliente: ${app.client_name || 'Você mesmo'} | Serviço: ${app.servico} | Data: ${app.dia} | Horário: ${app.hora}`).join('\n')}`
          : `\n\nATENÇÃO - COMPROMISSOS JÁ AGENDADOS DO USUÁRIO: Nenhum compromisso agendado no momento.`;

        const categoriesContext = categories.length > 0
          ? `\n\nATENÇÃO - CATEGORIAS FINANCEIRAS REGISTRADAS:\nReceitas: ${categories.filter(c => c.type === 'income').map(c => c.name).join(', ')}\nDespesas: ${categories.filter(c => c.type === 'expense').map(c => c.name).join(', ')}\nAo registrar uma transação, tente usar uma dessas categorias se fizer sentido.`
          : ``;

        const baseInstruction = user?.role === 'user' ? PERSONAL_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION;
        const dynamicInstruction = `${baseInstruction}\n\nINFORMAÇÃO DE CONTEXTO: A data e hora atual do sistema é ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')} (ISO: ${localISOTime}). O ano atual é ${now.getFullYear()}. Todos os agendamentos devem ser feitos para o ano atual ou futuro, NUNCA para anos passados. Se o usuário pedir "daqui a 1 minuto", adicione exatamente 1 minuto a este tempo e retorne no campo timestamp.${appointmentsContext}${categoriesContext}`;

        chatHistoryRef.current[0].content = dynamicInstruction;
      }

      chatHistoryRef.current.push({ role: 'user', content: text });

      const systemMessage = chatHistoryRef.current.find(m => m.role === 'system')?.content;
      const contents = chatHistoryRef.current
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contents,
          systemInstruction: systemMessage
        })
      });

      if (!res.ok) {
        throw new Error('Failed to fetch chat response');
      }

      const data = await res.json();
      let responseText = data.text || "Desculpe, não consegui processar sua mensagem.";
      chatHistoryRef.current.push({ role: 'assistant', content: responseText });

      const visualText = processAIResponse(responseText, text);

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: visualText }]);
    } catch (error: any) {
      console.error("Failed to send message:", error);
      let errorMsg = "Desculpe, tive um problema para entender. Pode repetir?";
      if (error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('quota')) {
        errorMsg = "O limite de uso da inteligência artificial foi atingido no momento. Por favor, aguarde alguns minutos antes de enviar outra mensagem.";
      }
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (textOverride?: string | any, isAudioMessage: boolean = false, audioDuration?: string) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    if (!textToSend.trim()) return;
    const text = textToSend.trim();
    if (!textOverride) setInput('');
    
    if (isAudioMessage) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'user', 
        text,
        isAudio: true,
        audioDuration: audioDuration || '0:05'
      }]);
      sendMessageToAI(text, true);
    } else {
      sendMessageToAI(text);
    }
  };

  const stopAndSendAudio = async () => {
    console.log("Stopping recording and sending (Dashboard)...");
    
    if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const finalTranscript = voiceTranscriptRef.current;
    console.log("Final transcript captured (Dashboard):", finalTranscript);
    
    await stopNativeSpeech(recognitionRef, setIsListening);
    playBeep('send');
    
    if (finalTranscript.trim()) {
      handleSend(finalTranscript, true, durationStr);
    } else {
      console.warn("No transcript detected (Dashboard), audio message not sent.");
      handleSend("Áudio inaudível", true, durationStr);
    }
  };

  const toggleRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isListening) {
      console.log("Cancelling recording (Dashboard)...");
      if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      await stopNativeSpeech(recognitionRef, setIsListening);
      setInput('');
      voiceTranscriptRef.current = '';
    } else {
      console.log("Starting recording (Dashboard)...");
      playBeep('start');
      setInput('');
      voiceTranscriptRef.current = '';
      recordingStartTimeRef.current = Date.now();
      
      await startNativeSpeech(
        recognitionRef, 
        setIsListening, 
        ((val: any) => {
          if (typeof val === 'function') {
            const newVal = val(voiceTranscriptRef.current);
            voiceTranscriptRef.current = newVal;
            console.log("Transcript updated (Dashboard func):", newVal);
          } else {
            voiceTranscriptRef.current = val;
            console.log("Transcript updated (Dashboard val):", val);
          }
        }) as any, 
        '',
        undefined,
        setMicError
      );
    }
  };

  const handleReschedule = (app: Appointment) => {
    setAppointments(prev => prev.filter(a => a.id !== app.id));
    fetch(`/api/appointments/${app.id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(console.error);
    setActiveTab('chat');
    sendMessageToAI(`Quero reagendar o meu compromisso de ${app.servico} que estava marcado para ${app.dia} às ${app.hora}. Por favor, me pergunte para qual nova data e hora eu gostaria de remarcar.`);
  };

  const handleCancel = (id: string) => {
    setAppointmentToDelete(id);
  };

  const confirmDelete = () => {
    if (!appointmentToDelete) return;
    setAppointments(prev => prev.filter(a => a.id !== appointmentToDelete));
    fetch(`/api/appointments/${appointmentToDelete}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(console.error);
    setAppointmentToDelete(null);
  };

  const cancelDelete = () => {
    setAppointmentToDelete(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogin = (newToken: string, userData: any) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setAppointments([]);
    setMessages([]);
  };

  const ServicesManager = ({ token }: { token: string }) => {
    const [services, setServices] = useState<any[]>([]);
    const [newService, setNewService] = useState({ name: '', price: '', duration: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchServices = async () => {
        try {
          const res = await fetch('/api/services', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setServices(data);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchServices();
    }, [token]);

    const handleAddService = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newService.name || !newService.price || !newService.duration) return;
      
      try {
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newService)
        });
        
        if (res.ok) {
          const data = await res.json();
          setServices([...services, { id: data.id, ...newService }]);
          setNewService({ name: '', price: '', duration: '' });
        }
      } catch (err) {
        console.error(err);
      }
    };

    const handleDeleteService = async (id: string) => {
      try {
        const res = await fetch(`/api/services/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          setServices(services.filter(s => s.id !== id));
        }
      } catch (err) {
        console.error(err);
      }
    };

    return (
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h4 className="font-bold text-[#17161A] mb-4 flex items-center gap-2">
          <LayoutList size={20} />
          Meus Serviços
        </h4>
        
        <form onSubmit={handleAddService} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input 
            type="text" 
            placeholder="Nome do serviço" 
            value={newService.name}
            onChange={e => setNewService({...newService, name: e.target.value})}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-[#3660F9] focus:ring-1 focus:ring-[#3660F9] outline-none"
          />
          <input 
            type="number" 
            placeholder="Preço (R$)" 
            value={newService.price}
            onChange={e => setNewService({...newService, price: e.target.value})}
            className="w-full sm:w-24 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-[#3660F9] focus:ring-1 focus:ring-[#3660F9] outline-none"
          />
          <input 
            type="text" 
            placeholder="Duração (ex: 30 min)" 
            value={newService.duration}
            onChange={e => setNewService({...newService, duration: e.target.value})}
            className="w-full sm:w-32 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-[#3660F9] focus:ring-1 focus:ring-[#3660F9] outline-none"
          />
          <button 
            type="submit"
            disabled={!newService.name || !newService.price || !newService.duration}
            className="bg-[#17161A] text-white px-4 py-2 rounded-xl font-medium hover:bg-[#3660F9] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            <span className="sm:hidden">Adicionar</span>
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : services.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Nenhum serviço cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {services.map(service => (
              <div key={service.id} className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#17161A] text-sm truncate">{service.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                    <span className="shrink-0">R$ {service.price}</span>
                    <span className="flex items-center gap-1 shrink-0"><Clock size={12}/> {service.duration}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteService(service.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const ProfileTab = () => {
    const [newSlug, setNewSlug] = useState(user?.slug || '');
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');
    const [updateSuccess, setUpdateSuccess] = useState('');

    const handleUpdateProfile = async () => {
      setIsUpdating(true);
      setUpdateError('');
      setUpdateSuccess('');
      try {
        const res = await fetch('/api/users/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ role: 'professional', slug: newSlug })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar perfil');
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setToken(data.token);
        setUpdateSuccess('Perfil atualizado com sucesso!');
      } catch (err: any) {
        setUpdateError(err.message);
      } finally {
        setIsUpdating(false);
      }
    };

    return (
      <main className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 w-full max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-[#EEF2FF] rounded-full flex items-center justify-center">
              <User size={32} className="text-[#3660F9]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#17161A]">{user?.name}</h2>
              <p className="text-gray-500 font-medium">{user?.email}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8">
            <h3 className="text-xl font-bold mb-4">Configurações de Perfil</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Conta</label>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className={`w-3 h-3 rounded-full ${user?.role === 'professional' ? 'bg-[#D1FD57]' : 'bg-gray-400'}`}></div>
                  <span className="font-medium">
                    {user?.role === 'professional' 
                      ? (SEGMENTS.find(s => s.id === user?.business_segment)?.title || 'Profissional') 
                      : (user?.role === 'user' ? 'Uso Pessoal' : 'Cliente')}
                  </span>
                </div>
              </div>

              {user?.role === 'client' && (
                <div className="bg-[#EEF2FF] p-6 rounded-3xl border border-blue-100">
                  <h4 className="font-bold text-[#3660F9] mb-2 flex items-center gap-2">
                    <Bot size={20} />
                    Torne-se um Profissional
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Receba agendamentos de clientes através de um link personalizado exclusivo seu.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Escolha seu link (slug)</label>
                      <div className="flex items-stretch">
                        <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl px-2 sm:px-4 py-3 text-gray-500 text-xs sm:text-sm font-medium flex items-center shrink-0">
                          agendai.montaloja.com/
                        </span>
                        <input 
                          type="text" 
                          value={newSlug}
                          onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          placeholder="seu-nome-aqui"
                          className="flex-1 min-w-0 border border-gray-300 rounded-r-xl px-3 sm:px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3660F9]/50 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const baseSlug = user?.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'profissional';
                          const randomSuffix = Math.floor(Math.random() * 10000);
                          setNewSlug(`${baseSlug}-${randomSuffix}`);
                        }}
                        className="mt-2 text-sm text-[#3660F9] font-medium hover:underline flex items-center gap-1"
                      >
                        <RefreshCw size={14} />
                        Gerar link automaticamente
                      </button>
                    </div>
                    
                    {updateError && <p className="text-red-500 text-sm font-medium">{updateError}</p>}
                    {updateSuccess && <p className="text-green-500 text-sm font-medium">{updateSuccess}</p>}
                    
                    <button 
                      onClick={handleUpdateProfile}
                      disabled={isUpdating || !newSlug}
                      className="w-full bg-[#17161A] text-white py-3 rounded-xl font-bold hover:bg-[#3660F9] transition-colors disabled:opacity-50"
                    >
                      {isUpdating ? 'Atualizando...' : 'Ativar Conta Profissional'}
                    </button>
                  </div>
                </div>
              )}
              
              {user?.role === 'professional' && (
                  <div className="flex flex-col gap-6">
                    <div className="bg-[#EEF2FF] p-6 rounded-3xl border border-blue-100">
                      <h4 className="font-bold text-[#3660F9] mb-2 flex items-center gap-2">
                        <LinkIcon size={20} />
                        Seu Link de Agendamento
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Compartilhe este link com seus clientes para que eles possam agendar horários com você.
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Alterar seu link (slug)</label>
                          <div className="flex items-stretch">
                            <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl px-2 sm:px-4 py-3 text-gray-500 text-xs sm:text-sm font-medium flex items-center shrink-0">
                              agendai.montaloja.com/
                            </span>
                            <input 
                              type="text" 
                              value={newSlug}
                              onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                              placeholder="seu-nome-aqui"
                              className="flex-1 min-w-0 border border-gray-300 rounded-none px-3 sm:px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3660F9]/50 text-sm"
                            />
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`https://agendai.montaloja.com/${newSlug || user?.slug}`);
                                alert('Link copiado!');
                              }}
                              className="bg-[#3660F9] text-white px-3 sm:px-4 py-3 rounded-r-xl hover:bg-blue-700 transition-colors flex items-center justify-center border border-[#3660F9] shrink-0"
                              title="Copiar Link"
                            >
                              <Copy size={18} />
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              const baseSlug = user?.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'profissional';
                              const randomSuffix = Math.floor(Math.random() * 10000);
                              setNewSlug(`${baseSlug}-${randomSuffix}`);
                            }}
                            className="mt-2 text-sm text-[#3660F9] font-medium hover:underline flex items-center gap-1"
                          >
                            <RefreshCw size={14} />
                            Gerar link novamente
                          </button>
                        </div>
                        
                        {updateError && <p className="text-red-500 text-sm font-medium">{updateError}</p>}
                        {updateSuccess && <p className="text-green-500 text-sm font-medium">{updateSuccess}</p>}
                        
                        <button 
                          onClick={handleUpdateProfile}
                          disabled={isUpdating || !newSlug || newSlug === user?.slug}
                          className="w-full bg-[#17161A] text-white py-3 rounded-xl font-bold hover:bg-[#3660F9] transition-colors disabled:opacity-50"
                        >
                          {isUpdating ? 'Atualizando...' : 'Salvar Novo Link'}
                        </button>
                      </div>
                    </div>
                    
                    <ServicesManager token={token} />
                  </div>
                )}
            </div>
          </div>
        </div>
      </main>
    );
  };

  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }

  if (user && !user.onboarding_completed) {
    return <Onboarding onComplete={() => {
      const updatedUser = JSON.parse(localStorage.getItem('user') || 'null');
      setUser(updatedUser);
    }} />;
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const Sidebar = () => (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#17161A]">Menu</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-[#17161A]">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-6">
          <button onClick={() => { setActiveTab('appointments'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'appointments' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
            <div className="flex items-center gap-3">
              <CalendarDays size={20} />
              <span className="font-medium">Agenda</span>
            </div>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => { setActiveTab('finance'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'finance' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
            <div className="flex items-center gap-3">
              <DollarSign size={20} />
              <span className="font-medium">Financeiro</span>
            </div>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => { setActiveTab('categories'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'categories' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
            <div className="flex items-center gap-3">
              <Tag size={20} />
              <span className="font-medium">Categorias</span>
            </div>
            <ChevronRight size={16} />
          </button>
          {user?.role !== 'user' && (
            <button onClick={() => { setActiveTab('clients'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'clients' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
              <div className="flex items-center gap-3">
                <Users size={20} />
                <span className="font-medium">Clientes</span>
              </div>
              <ChevronRight size={16} />
            </button>
          )}
          <button onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'reports' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
            <div className="flex items-center gap-3">
              <LineChart size={20} />
              <span className="font-medium">Relatórios</span>
            </div>
            <ChevronRight size={16} />
          </button>
          {user?.role !== 'user' && (
            <>
              <button onClick={() => { setActiveTab('services'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'services' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
                <div className="flex items-center gap-3">
                  <Wrench size={20} />
                  <span className="font-medium">Serviços</span>
                </div>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'products' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
                <div className="flex items-center gap-3">
                  <ShoppingCart size={20} />
                  <span className="font-medium">Produtos</span>
                </div>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => { setActiveTab('professionals'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'professionals' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
                <div className="flex items-center gap-3">
                  <UserSquare size={20} />
                  <span className="font-medium">Profissionais</span>
                </div>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => { setActiveTab('marketing'); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${activeTab === 'marketing' ? 'bg-[#EEF2FF] text-[#3660F9] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17161A] font-medium'}`}>
                <div className="flex items-center gap-3">
                  <Megaphone size={20} />
                  <span className="font-medium">Divulgação</span>
                </div>
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </nav>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#EEF2FF] font-sans text-[#17161A] selection:bg-[#D1FD57] selection:text-[#17161A] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="pt-8 pb-4 px-6 sm:px-8 flex items-center justify-between shrink-0 max-w-4xl w-full mx-auto">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Menu size={24} />
            </button>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">Olá, {user?.name || 'visitante'}!</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
                {activeTab === 'chat' && <><MessageSquare size={28} className="text-[#3660F9]" /> Assistente</>}
                {activeTab === 'appointments' && <><CalendarDays size={28} className="text-[#3660F9]" /> Agenda</>}
                {activeTab === 'finance' && <><DollarSign size={28} className="text-[#3660F9]" /> Financeiro</>}
                {activeTab === 'categories' && <><Tag size={28} className="text-[#3660F9]" /> Categorias</>}
                {activeTab === 'clients' && <><Users size={28} className="text-[#3660F9]" /> Clientes</>}
                {activeTab === 'reports' && <><LineChart size={28} className="text-[#3660F9]" /> Relatórios</>}
                {activeTab === 'services' && <><Wrench size={28} className="text-[#3660F9]" /> Serviços</>}
                {activeTab === 'products' && <><ShoppingCart size={28} className="text-[#3660F9]" /> Produtos</>}
                {activeTab === 'professionals' && <><UserSquare size={28} className="text-[#3660F9]" /> Profissionais</>}
                {activeTab === 'marketing' && <><Megaphone size={28} className="text-[#3660F9]" /> Divulgação</>}
                {activeTab === 'profile' && <><User size={28} className="text-[#3660F9]" /> Perfil</>}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {notifPermission === 'default' && (
              <button 
                onClick={requestNotifPermission}
                className="text-sm font-medium text-[#3660F9] hover:bg-blue-50 flex items-center gap-1 bg-[#EEF2FF] px-3 py-2 rounded-full shadow-sm border border-blue-100 transition-colors"
              >
                <BellRing className="w-4 h-4" />
                <span className="hidden sm:inline">Ativar Notificações</span>
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <User size={24} className="text-[#17161A]" />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="px-6 sm:px-8 mb-4 shrink-0 max-w-4xl w-full mx-auto">
          <div className="bg-white p-1.5 rounded-full flex shadow-sm border border-gray-100">
            <button 
              onClick={() => setActiveTab('chat')} 
              className={`flex-1 py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-[#17161A] text-white shadow-md' : 'text-gray-500 hover:text-[#17161A]'}`}
            >
              <MessageSquare size={18} />
              <span className="hidden sm:inline">Chat</span>
            </button>
            <button 
              onClick={() => setActiveTab('appointments')} 
              className={`flex-1 py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'appointments' ? 'bg-[#17161A] text-white shadow-md' : 'text-gray-500 hover:text-[#17161A]'}`}
            >
              <CalendarDays size={18} />
              <span className="hidden sm:inline">Agenda</span>
              {appointments.length > 0 && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'appointments' ? 'bg-[#D1FD57] text-[#17161A]' : 'bg-[#3660F9] text-white'}`}>
                  {appointments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {activeTab === 'chat' ? (
        <>
          {/* Chat Area */}
          <main className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 w-full max-w-4xl mx-auto scroll-smooth">
            <div className="space-y-6">
              {messages.map((msg, index) => {
                const hasButtons = msg.text.includes('[BOTOES_CONFIRMACAO]') || msg.text.includes('BOTOES_CONFIRMACAO');
                const cleanText = msg.text.replace(/\[?BOTOES_CONFIRMACAO\]?/g, '').trim();
                const isLastMessage = index === messages.length - 1;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-[#17161A] text-white' : 'bg-white text-[#3660F9] border border-gray-100'}`}>
                        {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <div
                          className={`p-4 sm:p-5 shadow-sm text-sm sm:text-base leading-relaxed break-words ${
                            msg.role === 'user'
                              ? 'bg-[#3660F9] text-white rounded-[28px] rounded-br-sm'
                              : 'bg-white text-[#17161A] rounded-[28px] rounded-bl-sm border border-gray-100'
                          }`}
                        >
                          {msg.isAudio && msg.role === 'user' ? (
                            <AudioMessage duration={msg.audioDuration} role={msg.role} />
                          ) : (
                            <ReactMarkdown
                              components={{
                                p: ({node, ...props}) => <p className="mb-3 last:mb-0 whitespace-pre-wrap" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-bold" {...props} />
                              }}
                            >
                              {cleanText}
                            </ReactMarkdown>
                          )}
                        </div>
                        {hasButtons && isLastMessage && msg.role === 'model' && !isLoading && (
                          <div className="flex gap-2 mt-1">
                            <button 
                              onClick={() => handleSend('Sim')}
                              className="flex-1 bg-[#3660F9] text-white py-2.5 px-4 rounded-full font-bold text-sm hover:bg-[#2b4cc7] transition-colors shadow-sm"
                            >
                              Sim
                            </button>
                            <button 
                              onClick={() => handleSend('Não')}
                              className="flex-1 bg-white text-[#17161A] border border-gray-200 py-2.5 px-4 rounded-full font-bold text-sm hover:bg-gray-50 transition-colors shadow-sm"
                            >
                              Não
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[85%] flex-row items-end gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white text-[#3660F9] border border-gray-100 flex items-center justify-center shadow-sm">
                      <Bot size={20} />
                    </div>
                    <div className="p-5 rounded-[28px] rounded-bl-sm bg-white border border-gray-100 shadow-sm">
                      <Loader2 className="w-5 h-5 animate-spin text-[#3660F9]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          </main>

          {/* Input Area */}
          <footer className="p-4 sm:p-6 pt-2 w-full max-w-4xl mx-auto shrink-0">
            {micError && (
              <div className="max-w-4xl mx-auto mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium leading-relaxed">{micError}</p>
                  {micError.includes('nova aba') && (
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="mt-2 text-xs font-bold text-red-600 underline hover:text-red-700 flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Abrir em nova aba
                    </button>
                  )}
                </div>
                <button onClick={() => setMicError(null)} className="text-red-400 hover:text-red-600 transition-colors">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="max-w-4xl mx-auto">
              <div className="relative flex items-end bg-white rounded-[32px] p-2 shadow-sm transition-all">
                {isListening ? (
                  <div className="flex-1 flex items-center justify-center h-[48px] overflow-hidden">
                    <AudioWaveform isListening={isListening} count={20} />
                  </div>
                ) : (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = '48px';
                      target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                    }}
                    placeholder="Escreva sua mensagem..."
                    className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none overflow-hidden text-[#17161A] placeholder:text-gray-400 py-3 pl-5 pr-2 font-medium"
                    rows={1}
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                )}
                <button
                  onClick={toggleRecording}
                  className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ml-2 select-none ${isListening ? 'bg-red-100 text-red-500 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title={isListening ? "Cancelar gravação" : "Clique para falar"}
                >
                  {isListening ? <Trash2 size={20} /> : <Mic size={20} />}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (isListening) {
                      stopAndSendAudio();
                    } else {
                      handleSend();
                    }
                  }}
                  disabled={(!isListening && !input.trim()) || isLoading}
                  className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ml-2 ${isListening ? 'bg-[#D1FD57] text-[#17161A] hover:scale-105 animate-pulse' : 'bg-[#17161A] text-[#D1FD57] hover:scale-105 disabled:opacity-50 disabled:hover:scale-100'}`}
                >
                  <Send size={20} className="ml-1" />
                </button>
              </div>
            </div>
          </footer>
        </>
      ) : activeTab === 'appointments' ? (
        /* Appointments Area */
        <main className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 w-full max-w-4xl mx-auto">
          {appointments.length === 0 ? (
            <div className="text-center mt-20 flex flex-col items-center bg-white p-10 rounded-[40px] shadow-sm border border-gray-100">
              <div className="bg-[#EEF2FF] p-6 rounded-full mb-6">
                <CalendarDays className="w-12 h-12 text-[#3660F9]" />
              </div>
              <h2 className="text-2xl font-bold text-[#17161A] mb-2">Nenhum agendamento</h2>
              <p className="text-gray-500 max-w-xs mb-8 font-medium">Volte ao chat e converse com o assistente para marcar um horário.</p>
              <button 
                onClick={() => setActiveTab('chat')}
                className="bg-[#17161A] text-white px-8 py-4 rounded-full font-bold hover:bg-[#3660F9] transition-colors flex items-center gap-2"
              >
                Começar agora
                <ArrowRight size={18} className="text-[#D1FD57]" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="bg-[#D1FD57] text-[#17161A] px-4 py-1.5 rounded-full text-sm font-bold hidden sm:inline-block">
                    {filteredAppointments.length} {filteredAppointments.length === 1 ? 'marcado' : 'marcados'}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {/* Filter Menu */}
                  <div className="bg-gray-100 p-1 rounded-full flex shrink-0">
                    <button 
                      onClick={() => setAppointmentFilter('all')}
                      className={`px-3 py-1.5 text-sm font-bold rounded-full transition-colors ${appointmentFilter === 'all' ? 'bg-white shadow-sm text-[#17161A]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Todos
                    </button>
                    <button 
                      onClick={() => setAppointmentFilter('pending')}
                      className={`px-3 py-1.5 text-sm font-bold rounded-full transition-colors ${appointmentFilter === 'pending' ? 'bg-white shadow-sm text-[#3660F9]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Pendentes
                    </button>
                    <button 
                      onClick={() => setAppointmentFilter('completed')}
                      className={`px-3 py-1.5 text-sm font-bold rounded-full transition-colors ${appointmentFilter === 'completed' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Concluídos
                    </button>
                  </div>

                  {/* Toggle View */}
                  <div className="bg-gray-100 p-1 rounded-full flex shrink-0">
                    <button 
                      onClick={() => setAgendaView('list')}
                      className={`p-2 rounded-full transition-colors ${agendaView === 'list' ? 'bg-white shadow-sm text-[#3660F9]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <LayoutList size={18} />
                    </button>
                    <button 
                      onClick={() => setAgendaView('day')}
                      className={`p-2 rounded-full transition-colors ${agendaView === 'day' ? 'bg-white shadow-sm text-[#3660F9]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Clock size={18} />
                    </button>
                    <button 
                      onClick={() => setAgendaView('calendar')}
                      className={`p-2 rounded-full transition-colors ${agendaView === 'calendar' ? 'bg-white shadow-sm text-[#3660F9]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <CalendarIcon size={18} />
                    </button>
                  </div>
                </div>
              </div>
              
              {filteredAppointments.length === 0 && appointments.length > 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 font-medium">Nenhum agendamento encontrado para este filtro.</p>
                </div>
              ) : agendaView === 'day' ? (
                <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[#17161A] capitalize">
                      {selectedDate.getDate()} de {monthNames[selectedDate.getMonth()]} de {selectedDate.getFullYear()}
                    </h3>
                    <div className="flex gap-2">
                      <button onClick={prevDay} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-[#17161A]"><ChevronLeft size={20}/></button>
                      <button onClick={nextDay} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-[#17161A]"><ChevronRight size={20}/></button>
                    </div>
                  </div>
                  <div className="space-y-0">
                    {getAppointmentsForDate(selectedDate).length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-500 font-medium">Nenhum compromisso agendado para este dia.</p>
                      </div>
                    ) : (
                      Array.from({ length: 24 }).map((_, hour) => {
                        const hourString = `${hour.toString().padStart(2, '0')}:00`;
                        const appsInHour = getAppointmentsForDate(selectedDate).filter(app => {
                          const appHour = new Date(app.timestamp).getHours();
                          return appHour === hour;
                        });

                        if (appsInHour.length === 0) return null;

                        return (
                          <div key={hour} className="flex border-b border-gray-100 last:border-0 min-h-[80px]">
                            <div className="w-16 py-4 text-right pr-4 text-sm font-bold text-gray-400 border-r border-gray-100">
                              {hourString}
                            </div>
                            <div className="flex-1 p-2 flex flex-col gap-2">
                              {appsInHour.map(app => {
                                const isExpanded = expandedAppointment === app.id;
                                return (
                                  <div 
                                    key={app.id} 
                                    onClick={() => setExpandedAppointment(isExpanded ? null : app.id)}
                                    className="bg-[#EEF2FF] border border-blue-100 p-3 rounded-2xl shadow-sm flex flex-col gap-2 group cursor-pointer transition-all"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-[#17161A] text-sm truncate">{app.servico}</h4>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                                          <span className="text-xs font-semibold text-[#3660F9] shrink-0">{app.hora}</span>
                                          {user?.role === 'professional' && app.client_name && (
                                            <span className="text-xs text-gray-500 font-medium truncate">Cliente: {app.client_name}</span>
                                          )}
                                        </div>
                                      </div>
                                      {!isExpanded && (
                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <button onClick={(e) => { e.stopPropagation(); handleReschedule(app); }} className="p-1.5 text-[#3660F9] bg-white rounded-full hover:bg-blue-50" title="Reagendar"><RefreshCw size={14} /></button>
                                          <button onClick={(e) => { e.stopPropagation(); handleCancel(app.id); }} className="p-1.5 text-red-500 bg-white rounded-full hover:bg-red-50" title="Cancelar"><Trash2 size={14} /></button>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {isExpanded && (
                                      <div className="mt-2 pt-3 border-t border-blue-200/50 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <CalendarDays size={14} className="text-[#3660F9]" />
                                          <span>{app.dia}</span>
                                        </div>
                                        {app.notified ? (
                                          <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <CheckCircle2 size={14} className="text-green-500" />
                                            <span>Concluído</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <BellRing size={14} className="text-[#D1FD57]" />
                                            <span>Pendente</span>
                                          </div>
                                        )}
                                        <div className="flex gap-2 mt-1">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleReschedule(app); }}
                                            className="flex-1 bg-white text-[#3660F9] py-2 px-3 rounded-xl font-bold text-xs hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 border border-blue-100"
                                          >
                                            <RefreshCw size={14} /> Reagendar
                                          </button>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleCancel(app.id); }}
                                            className="flex-1 bg-white text-red-500 py-2 px-3 rounded-xl font-bold text-xs hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 border border-red-100"
                                          >
                                            <Trash2 size={14} /> Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </div>
              ) : agendaView === 'calendar' ? (
                <div className="space-y-6">
                  <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-[#17161A] capitalize">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
                      <div className="flex gap-2">
                        <button onClick={prevMonth} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-[#17161A]"><ChevronLeft size={20}/></button>
                        <button onClick={nextMonth} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-[#17161A]"><ChevronRight size={20}/></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                      {weekDays.map(day => <div key={day} className="text-center text-xs font-bold text-gray-400">{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {/* Render empty slots */}
                      {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-16 sm:h-24 bg-gray-50/50 rounded-xl border border-transparent"></div>
                      ))}
                      {/* Render days */}
                      {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
                        const dayApps = getAppointmentsForDate(date);
                        const isToday = new Date().toDateString() === date.toDateString();
                        const isSelected = selectedDate?.toDateString() === date.toDateString();
                        
                        return (
                          <div 
                            key={i} 
                            onClick={() => {
                              setSelectedDate(date);
                              setAgendaView('day');
                            }}
                            className={`h-16 sm:h-24 p-1 sm:p-2 rounded-xl border cursor-pointer transition-all overflow-hidden flex flex-col ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-blue-300'} ${isSelected ? 'ring-2 ring-[#3660F9]' : ''}`}
                          >
                            <span className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${isToday ? 'bg-[#3660F9] text-white' : 'text-gray-700'}`}>{i + 1}</span>
                            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                              {dayApps.map(app => (
                                <div key={app.id} className="text-[9px] sm:text-[10px] bg-[#D1FD57] text-[#17161A] px-1.5 py-0.5 rounded font-semibold truncate" title={app.servico}>
                                  {app.hora} {user?.role === 'professional' && app.client_name ? `- ${app.client_name}` : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                filteredAppointments.map(app => (
                  <div key={app.id} className="bg-white p-6 sm:p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                    {/* Decorative background element */}
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#EEF2FF] rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                    
                    <div className="bg-[#3660F9] text-white w-14 h-14 flex items-center justify-center rounded-[20px] shrink-0 relative z-10">
                      <CalendarDays size={28} />
                    </div>
                    
                    <div className="flex-1 relative z-10">
                      <div className="flex items-center gap-3 mb-2">
                        {app.notified ? (
                          <span className="bg-gray-200 text-gray-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 size={12} /> Concluído
                          </span>
                        ) : (
                          <span className="bg-[#D1FD57] text-[#17161A] text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <BellRing size={12} /> Pendente
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-[#17161A] text-xl sm:text-2xl mb-4 break-words line-clamp-2">{app.servico}</h3>
                      
                      {user?.role === 'professional' && app.client_name && (
                        <p className="text-gray-600 mb-4 font-medium flex items-center gap-2">
                          <User size={18} className="text-[#3660F9] shrink-0" /> <span className="truncate">Cliente: {app.client_name}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 bg-[#EEF2FF] text-[#3660F9] px-3 sm:px-4 py-2 rounded-2xl font-semibold text-xs sm:text-sm shrink-0">
                          <CalendarDays size={16} className="shrink-0" />
                          <span className="truncate">{formatAppointmentDate(app.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-[#EEF2FF] text-[#3660F9] px-3 sm:px-4 py-2 rounded-2xl font-semibold text-xs sm:text-sm shrink-0">
                          <Clock size={16} className="shrink-0" />
                          <span>{app.hora}</span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-gray-100">
                        <button 
                          onClick={() => handleReschedule(app)}
                          className="text-sm font-bold text-[#3660F9] flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                        >
                          <RefreshCw size={16} /> Reagendar
                        </button>
                        <button 
                          onClick={() => handleCancel(app.id)}
                          className="text-sm font-bold text-red-500 flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                        >
                          <Trash2 size={16} /> Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      ) : activeTab === 'finance' ? (
        <FinanceTab token={token} appointments={appointments} />
      ) : activeTab === 'categories' ? (
        <CategoriesTab token={token} />
      ) : activeTab === 'clients' ? (
        <ClientsTab />
      ) : activeTab === 'reports' ? (
        <ReportsTab />
      ) : activeTab === 'services' ? (
        <ServicesTab />
      ) : activeTab === 'products' ? (
        <ProductsTab />
      ) : activeTab === 'professionals' ? (
        <ProfessionalsTab />
      ) : activeTab === 'marketing' ? (
        <MarketingTab />
      ) : activeTab === 'profile' ? (
        <ProfileTab />
      ) : null}

      {/* Alarm Modal */}
      {activeAlarm && (
        <div className="fixed inset-0 bg-[#17161A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] p-8 max-w-sm w-full text-center shadow-2xl transform transition-all animate-in zoom-in-95 duration-200">
            <div className="w-24 h-24 bg-[#D1FD57] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
              <BellRing size={48} className="text-[#17161A]" />
            </div>
            <h2 className="text-3xl font-bold text-[#17161A] mb-3">Lembrete!</h2>
            <p className="text-xl font-medium text-gray-600 mb-8 px-4">{activeAlarm.servico}</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setActiveAlarm(null)}
                className="w-full bg-[#3660F9] text-white py-4 rounded-full font-bold text-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {appointmentToDelete && (
        <div className="fixed inset-0 bg-[#17161A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] p-8 max-w-sm w-full text-center shadow-2xl transform transition-all animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Trash2 size={36} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-[#17161A] mb-3">Cancelar compromisso?</h2>
            <p className="text-gray-600 mb-8 px-2">Tem certeza que deseja cancelar este compromisso? Esta ação não pode ser desfeita.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDelete}
                className="w-full bg-red-500 text-white py-4 rounded-full font-bold text-lg hover:bg-red-600 transition-colors shadow-md hover:shadow-lg"
              >
                Sim, cancelar
              </button>
              <button 
                onClick={cancelDelete}
                className="w-full bg-gray-100 text-[#17161A] py-4 rounded-full font-bold text-lg hover:bg-gray-200 transition-colors"
              >
                Não, voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
