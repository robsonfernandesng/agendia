import React, { useState } from 'react';
import { User, Users, Building2, Building, Scissors, Sparkles, Droplets, Heart, Activity, Stethoscope, Syringe, Dog, HelpCircle, MapPin, Clock, Plus, Trash2, CheckCircle2, BellRing } from 'lucide-react';

const PROFILES = [
  { id: 'solo', title: 'Trabalho sozinho', desc: 'Não tenho funcionários', icon: User },
  { id: 'micro', title: 'Microempresa', desc: 'Entre 1 a 4 funcionários', icon: Users },
  { id: 'small', title: 'Pequena empresa', desc: 'Entre 4 a 10 funcionários', icon: Building },
  { id: 'medium', title: 'Média ou grande empresa', desc: 'Acima de 10 funcionários', icon: Building2 },
  { id: 'franchise', title: 'Redes e Franquias', desc: 'Sou uma rede ou franquia', icon: Building2 },
];

export const SEGMENTS = [
  { id: 'salon', title: 'Salão de Beleza', icon: Scissors },
  { id: 'clinic', title: 'Clínica de Estética', icon: Sparkles },
  { id: 'barbershop', title: 'Barbearia', icon: Scissors },
  { id: 'podiatry', title: 'Podologia', icon: Droplets },
  { id: 'nails', title: 'Esmalteria', icon: Droplets },
  { id: 'medical', title: 'Clínica médica', icon: Stethoscope },
  { id: 'spa', title: 'SPA e massagem', icon: Heart },
  { id: 'vet', title: 'Pet e Veterinário', icon: Dog },
  { id: 'tattoo', title: 'Estúdio de tatuagem', icon: Syringe },
  { id: 'dental', title: 'Clínica odontológica', icon: Stethoscope },
  { id: 'fitness', title: 'Personal e fitness', icon: Activity },
  { id: 'other', title: 'Outros segmentos', icon: HelpCircle },
];

const DAYS = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];

const DEFAULT_SERVICES = [
  { name: 'Corte de Cabelo', price: 50, duration: '30 minutos' },
  { name: 'Corte de Barba', price: 30, duration: '30 minutos' },
  { name: 'Modelagem', price: 20, duration: '30 minutos' },
  { name: 'Combo Cabelo e Barba', price: 70, duration: '1 hora' },
];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [useType, setUseType] = useState<'personal' | 'professional' | ''>('');
  const [profile, setProfile] = useState('');
  const [segment, setSegment] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: { active: day !== 'Domingo', start: '08:00', end: '18:00' } }), {})
  );
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [loading, setLoading] = useState(false);

  const [personalGoals, setPersonalGoals] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(true);

  const handleNext = () => {
    if (step === 0 && useType === 'personal') {
      setStep(10); // Personal flow starts at 10
    } else if (step === 10) {
      setStep(11);
    } else if (step === 11) {
      setStep(6); // Go to finish
    } else {
      setStep(s => s + 1);
    }
  };
  const handleBack = () => {
    if (step === 6 && useType === 'personal') {
      setStep(11);
    } else if (step === 11) {
      setStep(10);
    } else if (step === 10) {
      setStep(0);
    } else {
      setStep(s => s - 1);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          useType,
          profile: useType === 'professional' ? profile : null,
          segment: useType === 'professional' ? segment : null,
          address: useType === 'professional' ? address : null,
          hours: useType === 'professional' ? hours : null,
          services: useType === 'professional' ? services : [],
          personalGoals: useType === 'personal' ? personalGoals : null,
          notifications: useType === 'personal' ? notifications : null
        })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onComplete();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 md:p-12">
          
          {step === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Como você pretende usar o aplicativo?</h1>
              <p className="text-gray-500 mb-8">Escolha a opção que melhor descreve o seu objetivo principal.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <button
                  onClick={() => setUseType('personal')}
                  className={`flex items-center p-6 rounded-xl border-2 text-left transition-all ${
                    useType === 'personal' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'
                  }`}
                >
                  <div className={`p-4 rounded-full mr-4 ${useType === 'personal' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-500'}`}>
                    <User size={32} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Uso Pessoal</h3>
                    <p className="text-sm text-gray-500">Quero organizar minha agenda e lembretes pessoais.</p>
                  </div>
                </button>

                <button
                  onClick={() => setUseType('professional')}
                  className={`flex items-center p-6 rounded-xl border-2 text-left transition-all ${
                    useType === 'professional' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'
                  }`}
                >
                  <div className={`p-4 rounded-full mr-4 ${useType === 'professional' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-500'}`}>
                    <Building2 size={32} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Uso Profissional</h3>
                    <p className="text-sm text-gray-500">Quero gerenciar meu negócio, serviços e clientes.</p>
                  </div>
                </button>
              </div>
              
              <button 
                onClick={handleNext} 
                disabled={!useType}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-600 transition-colors"
              >
                Continuar
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Com qual perfil você se encaixa?</h1>
              <p className="text-gray-500 mb-8">Para começar, é importante que você escolha o modelo que mais se encaixa ao seu negócio</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {PROFILES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProfile(p.id)}
                    className={`flex items-center p-4 rounded-xl border-2 text-left transition-all ${
                      profile === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'
                    }`}
                  >
                    <div className={`p-3 rounded-full mr-4 ${profile === p.id ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-500'}`}>
                      <p.icon size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{p.title}</h3>
                      <p className="text-sm text-gray-500">{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              
              <button 
                onClick={handleNext} 
                disabled={!profile}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-600 transition-colors"
              >
                Continuar
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Segmento de atuação</h1>
              <p className="text-gray-500 mb-8">Para que você tenha um ambiente personalizado, é importante saber qual o seu tipo de negócio.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-h-[50vh] overflow-y-auto pr-2">
                {SEGMENTS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSegment(s.id)}
                    className={`flex items-center p-4 rounded-xl border-2 text-left transition-all ${
                      segment === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'
                    }`}
                  >
                    <div className={`p-3 rounded-full mr-4 ${segment === s.id ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-500'}`}>
                      <s.icon size={24} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  </button>
                ))}
              </div>
              
              <div className="flex gap-4">
                <button onClick={handleBack} className="px-6 py-4 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-colors">
                  Voltar
                </button>
                <button 
                  onClick={handleNext} 
                  disabled={!segment}
                  className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-600 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Onde fica?</h1>
              <p className="text-gray-500 mb-8">Conte-nos onde é seu negócio. Esta localização posicionará você nas ferramentas de busca!</p>
              
              <div className="mb-8 relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Digite seu endereço..."
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 text-lg"
                />
              </div>
              
              <div className="flex gap-4">
                <button onClick={handleBack} className="px-6 py-4 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-colors">
                  Voltar
                </button>
                <button 
                  onClick={handleNext} 
                  disabled={!address}
                  className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-600 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Horário de funcionamento</h1>
              <p className="text-gray-500 mb-8">Para finalizar, qual o horário que o seu negócio funciona?</p>
              
              <div className="space-y-4 mb-8">
                {DAYS.map(day => (
                  <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={(hours as any)[day].active}
                        onChange={e => setHours(prev => ({ ...prev, [day]: { ...(prev as any)[day], active: e.target.checked } }))}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500 shrink-0"
                      />
                      <span className="font-medium text-gray-700">{day}</span>
                    </label>
                    
                    {(hours as any)[day].active && (
                      <div className="flex items-center gap-2 pl-8 sm:pl-0">
                        <input 
                          type="time" 
                          value={(hours as any)[day].start}
                          onChange={e => setHours(prev => ({ ...prev, [day]: { ...(prev as any)[day], start: e.target.value } }))}
                          className="border rounded-lg px-2 sm:px-3 py-2 text-sm w-full sm:w-auto"
                        />
                        <span className="text-gray-400">às</span>
                        <input 
                          type="time" 
                          value={(hours as any)[day].end}
                          onChange={e => setHours(prev => ({ ...prev, [day]: { ...(prev as any)[day], end: e.target.value } }))}
                          className="border rounded-lg px-2 sm:px-3 py-2 text-sm w-full sm:w-auto"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex gap-4">
                <button onClick={handleBack} className="px-6 py-4 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-colors">
                  Voltar
                </button>
                <button 
                  onClick={handleNext} 
                  className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Serviços sugeridos</h1>
              <p className="text-gray-500 mb-8">De acordo com o seu tipo de negócio, adicionamos alguns serviços possíveis na sua empresa. Você pode adicionar novos ou remover os que não faz.</p>
              
              <div className="space-y-4 mb-6">
                {services.map((service, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <button 
                        onClick={() => setServices(s => s.filter((_, i) => i !== index))}
                        className="text-gray-400 hover:text-red-500 shrink-0 mt-0.5 sm:mt-0"
                      >
                        <Trash2 size={18} />
                      </button>
                      <span className="font-medium text-gray-700 break-words line-clamp-2">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 text-sm text-gray-500 pl-8 sm:pl-0 shrink-0">
                      <span>R$ {service.price}</span>
                      <span className="flex items-center gap-1"><Clock size={14}/> {service.duration}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-8">
                <h4 className="font-medium text-gray-700 mb-3 text-sm">Adicionar novo serviço</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    placeholder="Nome" 
                    id="new-service-name"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <input 
                    type="number" 
                    placeholder="Preço" 
                    id="new-service-price"
                    className="w-full sm:w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="Duração" 
                    id="new-service-duration"
                    className="w-full sm:w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button 
                    onClick={() => {
                      const nameInput = document.getElementById('new-service-name') as HTMLInputElement;
                      const priceInput = document.getElementById('new-service-price') as HTMLInputElement;
                      const durationInput = document.getElementById('new-service-duration') as HTMLInputElement;
                      
                      if (nameInput.value && priceInput.value && durationInput.value) {
                        setServices([...services, {
                          name: nameInput.value,
                          price: Number(priceInput.value),
                          duration: durationInput.value
                        }]);
                        nameInput.value = '';
                        priceInput.value = '';
                        durationInput.value = '';
                      }
                    }}
                    className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-200 transition-colors text-sm"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button onClick={handleBack} className="px-6 py-4 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-colors">
                  Voltar
                </button>
                <button 
                  onClick={handleNext} 
                  className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          {step === 10 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Quais são seus principais objetivos?</h1>
              <p className="text-gray-500 mb-8">Selecione o que você mais deseja fazer com o aplicativo.</p>
              
              <div className="space-y-4 mb-8">
                {[
                  { id: 'reminders', label: 'Criar lembretes para tarefas do dia a dia' },
                  { id: 'appointments', label: 'Agendar compromissos em estabelecimentos' },
                  { id: 'organization', label: 'Organizar minha rotina pessoal' },
                ].map(goal => (
                  <label key={goal.id} className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${personalGoals.includes(goal.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={personalGoals.includes(goal.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPersonalGoals(prev => [...prev, goal.id]);
                        } else {
                          setPersonalGoals(prev => prev.filter(g => g !== goal.id));
                        }
                      }}
                    />
                    <div className={`w-6 h-6 rounded border-2 mr-4 flex items-center justify-center ${personalGoals.includes(goal.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {personalGoals.includes(goal.id) && <CheckCircle2 size={16} className="text-white" />}
                    </div>
                    <span className="font-medium text-gray-700">{goal.label}</span>
                  </label>
                ))}
              </div>
              
              <div className="flex gap-4">
                <button onClick={handleBack} className="px-6 py-4 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-colors">
                  Voltar
                </button>
                <button 
                  onClick={handleNext} 
                  disabled={personalGoals.length === 0}
                  className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-600 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 11 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Notificações</h1>
              <p className="text-gray-500 mb-8">Para que possamos te lembrar dos seus compromissos, precisamos que você ative as notificações.</p>
              
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-4">
                  <BellRing size={32} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Não perca nenhum horário!</h3>
                <p className="text-gray-600 text-sm mb-6">Enviaremos alertas apenas para os lembretes e agendamentos que você criar.</p>
                
                <label className="flex items-center gap-3 cursor-pointer bg-white px-4 py-3 rounded-lg border shadow-sm w-full justify-center">
                  <input 
                    type="checkbox" 
                    checked={notifications}
                    onChange={e => setNotifications(e.target.checked)}
                    className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-700">Desejo receber notificações</span>
                </label>
              </div>
              
              <div className="flex gap-4">
                <button onClick={handleBack} className="px-6 py-4 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-colors">
                  Voltar
                </button>
                <button 
                  onClick={handleNext} 
                  className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="animate-in fade-in slide-in-from-right-4 text-center py-12">
              <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={48} />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Agora é só explorar!</h1>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Liberamos todos os recursos para você testar e aproveitar ao máximo.
              </p>
              
              <button 
                onClick={handleFinish} 
                disabled={loading}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Preparando...' : 'Entrar na plataforma'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
