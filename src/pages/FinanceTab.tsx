import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { DollarSign, CalendarDays, Clock, ArrowRight, Plus, Trash2, CheckCircle, Circle, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Edit2, X } from 'lucide-react';
import { motion } from 'motion/react';

type Appointment = {
  id: string;
  servico: string;
  dia: string;
  hora: string;
  timestamp: number;
  notified: boolean;
  client_name?: string;
};

type Transaction = {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  date: string;
  status: 'pending' | 'paid';
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
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

const CATEGORIES = {
  income: ['Salário', 'Vendas', 'Serviços', 'Investimentos', 'Outros'],
  expense: ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Impostos', 'Serviços', 'Outros']
};

const DEFAULT_CATEGORY_ICONS: Record<string, { icon: string, color: string }> = {
  'Salário': { icon: 'DollarSign', color: '#10B981' },
  'Vendas': { icon: 'TrendingUp', color: '#10B981' },
  'Serviços': { icon: 'Briefcase', color: '#3B82F6' },
  'Investimentos': { icon: 'LineChart', color: '#8B5CF6' },
  'Alimentação': { icon: 'Utensils', color: '#EF4444' },
  'Moradia': { icon: 'Home', color: '#F97316' },
  'Transporte': { icon: 'Car', color: '#F59E0B' },
  'Saúde': { icon: 'Heart', color: '#EF4444' },
  'Educação': { icon: 'GraduationCap', color: '#6366F1' },
  'Lazer': { icon: 'Smile', color: '#EC4899' },
  'Impostos': { icon: 'FileText', color: '#64748B' },
  'Outros': { icon: 'Tag', color: '#6B7280' }
};

export default function FinanceTab({ token, appointments = [] }: { token?: string | null, appointments?: Appointment[] }) {
  const [activeSubTab, setActiveSubTab] = useState<'principal' | 'debts'>('principal');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteDebtConfirmId, setDeleteDebtConfirmId] = useState<string | null>(null);
  const [payDebtConfirmData, setPayDebtConfirmData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  const parseAmount = (value: string) => {
    if (!value) return 0;
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    status: 'paid' as 'pending' | 'paid'
  });

  const [debtFormData, setDebtFormData] = useState({
    name: '',
    total_amount: '',
    monthly_amount: '',
    due_date: ''
  });

  useEffect(() => {
    if (token) {
      fetchTransactions();
      fetchDebts();
      fetchCategories();
    }
  }, [token]);

  const fetchCategories = async () => {
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

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    }
  };

  const fetchDebts = async () => {
    try {
      const res = await fetch('/api/debts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDebts(data);
      }
    } catch (err) {
      console.error("Failed to fetch debts:", err);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setIsLoading(true);
    try {
      const url = editingId ? `/api/transactions/${editingId}` : '/api/transactions';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          amount: parseAmount(formData.amount)
        })
      });
      
      if (res.ok) {
        await fetchTransactions();
        setIsModalOpen(false);
        setEditingId(null);
        setSelectedTransaction(null);
        setFormData({
          type: 'expense',
          category: 'Alimentação',
          description: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          status: 'paid'
        });
      }
    } catch (err) {
      console.error("Failed to save transaction:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (t: Transaction) => {
    setEditingId(t.id);
    setFormData({
      type: t.type,
      category: t.category,
      description: t.description,
      amount: String(t.amount),
      date: new Date(t.date).toISOString().split('T')[0],
      status: t.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!token || !deleteConfirmId) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/transactions/${deleteConfirmId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTransactions(prev => prev.filter(t => t.id !== deleteConfirmId));
      }
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    } finally {
      setIsLoading(false);
      setDeleteConfirmId(null);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (!token) return;
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
        setToastMessage(`Transação marcada como ${newStatus === 'paid' ? 'Paga' : 'Pendente'}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setIsLoading(true);
    try {
      const url = editingDebtId ? `/api/debts/${editingDebtId}` : '/api/debts';
      const method = editingDebtId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: debtFormData.name,
          total_amount: parseAmount(debtFormData.total_amount),
          monthly_amount: debtFormData.monthly_amount ? parseAmount(debtFormData.monthly_amount) : null,
          due_date: debtFormData.due_date ? parseInt(debtFormData.due_date) : null
        })
      });
      
      if (res.ok) {
        await fetchDebts();
        setIsDebtModalOpen(false);
        setEditingDebtId(null);
        setDebtFormData({ name: '', total_amount: '', monthly_amount: '', due_date: '' });
      }
    } catch (err) {
      console.error("Failed to save debt:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDebtModal = (debt: any) => {
    setEditingDebtId(debt.id);
    setDebtFormData({
      name: debt.name,
      total_amount: Number(debt.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      monthly_amount: debt.monthly_amount ? Number(debt.monthly_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
      due_date: debt.due_date ? String(debt.due_date) : ''
    });
    setIsDebtModalOpen(true);
  };

  const handlePayDebt = (debt: any) => {
    setPayDebtConfirmData(debt);
  };

  const confirmPayDebt = async () => {
    if (!token || !payDebtConfirmData) return;
    setIsLoading(true);
    const debt = payDebtConfirmData;
    const amountToPay = debt.monthly_amount || debt.remaining_amount;
    const newRemaining = Math.max(0, debt.remaining_amount - amountToPay);
    const newStatus = newRemaining === 0 ? 'paid' : 'active';
    
    try {
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ remaining_amount: newRemaining, status: newStatus })
      });
      
      if (res.ok) {
        // Also add an expense transaction
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'expense',
            category: 'Outros',
            description: `Pagamento de dívida: ${debt.name}`,
            amount: amountToPay,
            date: new Date().toISOString().split('T')[0],
            status: 'paid'
          })
        });
        
        await fetchDebts();
        await fetchTransactions();
      }
    } catch (err) {
      console.error("Failed to pay debt:", err);
    } finally {
      setIsLoading(false);
      setPayDebtConfirmData(null);
    }
  };

  const handleDeleteDebt = (id: string) => {
    setDeleteDebtConfirmId(id);
  };

  const confirmDeleteDebt = async () => {
    if (!token || !deleteDebtConfirmId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/debts/${deleteDebtConfirmId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDebts(prev => prev.filter(d => d.id !== deleteDebtConfirmId));
      }
    } catch (err) {
      console.error("Failed to delete debt:", err);
    } finally {
      setIsLoading(false);
      setDeleteDebtConfirmId(null);
    }
  };

  const financeKeywords = [
    'pagar', 'pagamento', 'receber', 'recebimento', 'boleto', 'conta', 
    'fatura', 'cartão', 'cartao', 'salário', 'salario', 'transferência', 
    'transferencia', 'pix', 'dinheiro', 'banco', 'investimento', 'aluguel', 
    'imposto', 'taxa', 'mensalidade', 'compra', 'venda', 'financeiro', 
    'despesa', 'receita', 'lucro', 'custo', 'dívida', 'divida', 'empréstimo', 'emprestimo'
  ];

  const financeAppointments = appointments
    .filter(app => {
      const text = app.servico.toLowerCase();
      return financeKeywords.some(kw => text.includes(kw));
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const totalIncome = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const balance = totalIncome - totalExpense;

  return (
    <>
      {selectedTransaction && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#E8F0FE] to-[#FCE7F3] z-50 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
              >
                <Icons.ArrowLeft size={20} className="text-[#17161A]" />
              </button>
              <div>
                <span className="font-bold text-[#17161A] text-lg">
                  {new Date(selectedTransaction.date + 'T12:00:00').getDate()} {new Date(selectedTransaction.date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}.
                </span>
                <span className="text-gray-500 ml-2">
                  {new Date(selectedTransaction.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                </span>
              </div>
            </div>
            <button 
              onClick={() => {
                openEditModal(selectedTransaction);
              }}
              className="px-4 py-2 bg-white/50 hover:bg-white rounded-full font-medium text-[#17161A] transition-colors"
            >
              Alterar
            </button>
          </div>

          {/* Content */}
          <div className="px-6 mt-4 flex-1">
            {/* Category Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 rounded-2xl mb-6">
              {(() => {
                const cat = categories.find(c => c.name === selectedTransaction.category);
                const defaultCat = DEFAULT_CATEGORY_ICONS[selectedTransaction.category];
                let IconComponent = selectedTransaction.type === 'income' ? ArrowUpRight : ArrowDownRight;
                if (cat && cat.icon) IconComponent = (Icons as any)[cat.icon] || IconComponent;
                else if (defaultCat) IconComponent = (Icons as any)[defaultCat.icon] || IconComponent;
                return <IconComponent size={16} className="text-[#17161A]" />;
              })()}
              <span className="font-medium text-[#17161A]">{selectedTransaction.category}</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-[#17161A] mb-6">
              {selectedTransaction.description}
            </h1>

            {/* Amount Pill */}
            <div className="mb-10">
              <span className="text-sm text-gray-500 block mb-1">Total:</span>
              <div className={`inline-flex px-6 py-3 rounded-3xl ${selectedTransaction.type === 'income' ? 'bg-green-50' : 'bg-[#E8E8E8]'}`}>
                <span className={`text-2xl font-bold ${selectedTransaction.type === 'income' ? 'text-green-600' : 'text-[#17161A]'}`}>
                  {selectedTransaction.type === 'income' ? '' : '-'}R${Number(selectedTransaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
                <span className="text-gray-500">Encontro</span>
                <div className="bg-white/60 px-4 py-2 rounded-xl font-medium text-[#17161A]">
                  {new Date(selectedTransaction.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
                <span className="text-gray-500">Soma na taxa de câmbio original</span>
                <span className="font-bold text-[#17161A]">
                  {selectedTransaction.type === 'income' ? '' : '-'}R${Number(selectedTransaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Delete Button */}
            <button 
              onClick={() => {
                handleDelete(selectedTransaction.id);
                setSelectedTransaction(null);
              }}
              className="mt-8 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <Icons.Trash2 size={24} />
            </button>
          </div>

          {/* Bottom Bar */}
          <div className="p-6 mt-auto bg-white/30 backdrop-blur-md border-t border-white/50">
            <div className="flex mb-4 rounded-3xl overflow-hidden border border-red-200">
              <button 
                onClick={() => {
                  toggleStatus(selectedTransaction.id, selectedTransaction.status);
                  setSelectedTransaction({...selectedTransaction, status: selectedTransaction.status === 'paid' ? 'pending' : 'paid'});
                }}
                className="flex-1 bg-[#FDF2F2] text-[#17161A] font-bold py-4 transition-colors hover:bg-red-50"
              >
                {selectedTransaction.status === 'paid' ? 'MARCAR COMO PENDENTE' : 'PAGAR'}
              </button>
              <div className="w-px bg-red-200"></div>
              <button 
                onClick={() => {
                  toggleStatus(selectedTransaction.id, selectedTransaction.status);
                  setSelectedTransaction({...selectedTransaction, status: selectedTransaction.status === 'paid' ? 'pending' : 'paid'});
                }}
                className="w-16 bg-[#FDF2F2] text-[#17161A] flex items-center justify-center transition-colors hover:bg-red-50"
              >
                <Icons.Triangle size={12} fill="currentColor" />
              </button>
            </div>
            <button 
              onClick={() => setSelectedTransaction(null)}
              className="w-full text-center text-[#3660F9] font-bold py-2"
            >
              cancelar
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 w-full max-w-5xl mx-auto">
      <div className="flex gap-2 mb-8 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubTab('principal')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeSubTab === 'principal' ? 'bg-white text-[#17161A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Principal
        </button>
        <button
          onClick={() => setActiveSubTab('debts')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeSubTab === 'debts' ? 'bg-white text-[#17161A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Dívidas
        </button>
      </div>

      {activeSubTab === 'principal' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            <div className="bg-white p-4 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0 border border-green-100">
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 block mb-0.5">Rendimento</span>
                <h3 className="text-sm font-bold text-green-600">
                  +R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
            </div>
            <div className="bg-white p-4 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0 border border-red-100">
                <TrendingDown size={18} className="text-red-600" />
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 block mb-0.5">Despesas</span>
                <h3 className="text-sm font-bold text-red-600">
                  -R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
            </div>
            <div className="bg-white p-4 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                <Wallet size={18} className="text-[#3660F9]" />
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 block mb-0.5">Saldo Atual</span>
                <h3 className="text-sm font-bold text-[#17161A]">
                  R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Transactions List */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#17161A]">Últimas Transações</h3>
              </div>
              
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 bg-white rounded-[32px] border border-gray-100">
                    Nenhuma transação registrada.
                  </div>
                ) : (
                  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => {
                    const isIncome = t.type === 'income';
                    const bgClass = isIncome ? 'bg-[#2A2A2A] text-white' : 'bg-[#F3F2F8] border border-[#DEDDE5] text-[#17161A]';
                    const amountColor = isIncome ? 'text-green-500' : 'text-[#D17171]';
                    const amountPrefix = isIncome ? '' : '-';

                    return (
                      <div 
                        key={t.id} 
                        onClick={() => setSelectedTransaction(t)}
                        className={`p-4 sm:p-5 rounded-[32px] flex items-center justify-between gap-4 transition-colors cursor-pointer hover:opacity-90 ${bgClass}`}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {(() => {
                            const cat = categories.find(c => c.name === t.category);
                            const defaultCat = DEFAULT_CATEGORY_ICONS[t.category];
                            
                            let IconComponent = isIncome ? ArrowUpRight : ArrowDownRight;

                            if (cat && cat.icon) {
                              IconComponent = (Icons as any)[cat.icon] || IconComponent;
                            } else if (defaultCat) {
                              IconComponent = (Icons as any)[defaultCat.icon] || IconComponent;
                            }
                            
                            return (
                              <div className="flex items-center justify-center shrink-0">
                                {IconComponent && <IconComponent size={24} className={isIncome ? 'text-white' : 'text-[#17161A]'} />}
                              </div>
                            );
                          })()}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold truncate text-[12px]">{t.description}</h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className={`text-[12px] font-bold whitespace-nowrap ${amountColor}`}>
                            {amountPrefix}R${Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          {t.status === 'paid' ? (
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                              <CheckCircle size={20} />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full border border-gray-400 flex items-center justify-center text-gray-400 shrink-0">
                              <div className="w-full h-full rounded-full border border-[#17161A]/20"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reminders Sidebar */}
            <div>
              <h3 className="text-xl font-bold text-[#17161A] mb-4">Lembretes Financeiros</h3>
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                {financeAppointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhum lembrete financeiro.</p>
                ) : (
                  <div className="space-y-4">
                    {financeAppointments.map(app => (
                      <div key={app.id} className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50">
                        <div className="w-2 h-2 mt-2 rounded-full bg-[#3660F9]"></div>
                        <div>
                          <p className="font-bold text-[#17161A]">{app.servico}</p>
                          <p className="text-sm text-gray-500">{app.dia} às {app.hora}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {debts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhuma dívida registrada.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {debts.map(debt => (
                <div key={debt.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-[#17161A] text-lg">{debt.name}</h4>
                      {debt.status === 'paid' && (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-lg">Quitada</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>Total: R$ {Number(debt.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      {debt.monthly_amount && (
                        <span>Mensal: R$ {Number(debt.monthly_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      )}
                      {debt.due_date && (
                        <span>Vencimento: dia {debt.due_date}</span>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-[#3660F9]">Progresso</span>
                        <span className="text-gray-500">
                          R$ {(Number(debt.total_amount) - Number(debt.remaining_amount)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {Number(debt.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-[#3660F9] h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.max(0, ((Number(debt.total_amount) - Number(debt.remaining_amount)) / Number(debt.total_amount)) * 100))}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    {debt.status !== 'paid' && (
                      <button 
                        onClick={() => handlePayDebt(debt)}
                        className="bg-green-100 text-green-700 font-bold px-4 py-2 rounded-xl hover:bg-green-200 transition-colors text-sm w-full sm:w-auto text-center"
                      >
                        Abater Dívida
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEditDebtModal(debt)}
                        className="p-2 text-gray-400 hover:text-[#3660F9] hover:bg-blue-50 rounded-xl transition-colors"
                        title="Editar dívida"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteDebt(debt.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Excluir dívida"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Debt Modal */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#17161A]">
                {editingDebtId ? 'Editar Dívida' : 'Nova Dívida'}
              </h2>
              <button onClick={() => {
                setIsDebtModalOpen(false);
                setEditingDebtId(null);
              }} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddDebt} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Dívida</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Financiamento Carro"
                  value={debtFormData.name}
                  onChange={e => setDebtFormData({...debtFormData, name: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Valor Total (R$)</label>
                <input 
                  type="text" 
                  required
                  placeholder="0,00"
                  value={debtFormData.total_amount}
                  onChange={e => setDebtFormData({...debtFormData, total_amount: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Valor Mensal (R$)</label>
                  <input 
                    type="text" 
                    placeholder="Opcional"
                    value={debtFormData.monthly_amount}
                    onChange={e => setDebtFormData({...debtFormData, monthly_amount: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Dia do Vencimento</label>
                  <input 
                    type="number" 
                    min="1" max="31"
                    placeholder="Ex: 10"
                    value={debtFormData.due_date}
                    onChange={e => setDebtFormData({...debtFormData, due_date: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsDebtModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-[#3660F9] text-white py-3 rounded-2xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#17161A]">
                {editingId ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              <button onClick={() => {
                setIsModalOpen(false);
                setEditingId(null);
              }} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl mb-4">
                <button
                  type="button"
                  onClick={() => {
                    const incomeCategories = categories.filter(c => c.type === 'income');
                    setFormData({...formData, type: 'income', category: incomeCategories.length > 0 ? incomeCategories[0].name : CATEGORIES.income[0]});
                  }}
                  className={`py-2 rounded-xl font-bold text-sm transition-all ${
                    formData.type === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const expenseCategories = categories.filter(c => c.type === 'expense');
                    setFormData({...formData, type: 'expense', category: expenseCategories.length > 0 ? expenseCategories[0].name : CATEGORIES.expense[0]});
                  }}
                  className={`py-2 rounded-xl font-bold text-sm transition-all ${
                    formData.type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Despesa
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Salário, Aluguel..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Valor (R$)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="0,00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Data</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Categoria</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                  >
                    {categories.filter(c => c.type === formData.type).length > 0 ? (
                      categories.filter(c => c.type === formData.type).map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))
                    ) : (
                      CATEGORIES[formData.type].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as 'pending' | 'paid'})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#3660F9] transition-colors"
                  >
                    <option value="paid">Pago / Recebido</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-[#3660F9] text-white py-3 rounded-2xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h2 className="text-2xl font-bold text-[#17161A] mb-2">Excluir transação?</h2>
            <p className="text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isLoading}
                className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Debt Confirmation Modal */}
      {deleteDebtConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h2 className="text-2xl font-bold text-[#17161A] mb-2">Excluir dívida?</h2>
            <p className="text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteDebtConfirmId(null)}
                className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteDebt}
                disabled={isLoading}
                className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Debt Confirmation Modal */}
      {payDebtConfirmData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign size={32} />
            </div>
            <h2 className="text-2xl font-bold text-[#17161A] mb-2">Abater Dívida?</h2>
            <p className="text-gray-500 mb-6">
              Confirmar pagamento de R$ {(payDebtConfirmData.monthly_amount || payDebtConfirmData.remaining_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para {payDebtConfirmData.name}?
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setPayDebtConfirmData(null)}
                className="flex-1 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmPayDebt}
                disabled={isLoading}
                className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg font-medium z-50 flex items-center gap-2"
        >
          <CheckCircle size={20} className="text-green-400" />
          {toastMessage}
        </motion.div>
      )}

      {/* Floating Action Button */}
      {activeSubTab === 'principal' ? (
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              type: 'expense',
              category: 'Alimentação',
              description: '',
              amount: '',
              date: new Date().toISOString().split('T')[0],
              status: 'paid'
            });
            setIsModalOpen(true);
          }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 bg-[#17161A] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-40"
          title="Nova Transação"
        >
          <Plus size={28} />
        </button>
      ) : (
        <button
          onClick={() => {
            setEditingDebtId(null);
            setDebtFormData({ name: '', total_amount: '', monthly_amount: '', due_date: '' });
            setIsDebtModalOpen(true);
          }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 bg-[#17161A] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-40"
          title="Nova Dívida"
        >
          <Plus size={28} />
        </button>
      )}
    </main>
    </>
  );
}
