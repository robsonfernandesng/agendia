import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, CheckCircle, X, FolderTree, Palette, Type, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  parent_id?: string;
};

export default function CategoriesTab({ token }: { token: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'expense' | 'income'>('expense');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
    parent_id: string;
  }>({
    name: '',
    type: 'expense',
    icon: 'Tag',
    color: '#3660F9',
    parent_id: ''
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/categories/${editingId}` : '/api/categories';
      const method = editingId ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        parent_id: formData.parent_id || null
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(editingId ? 'Categoria atualizada!' : 'Categoria adicionada!');
        setIsModalOpen(false);
        fetchCategories();
      }
    } catch (error) {
      console.error("Failed to save category:", error);
    }
  };

  const handleDelete = (id: string) => {
    setCategoryToDelete(id);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      const res = await fetch(`/api/categories/${categoryToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Categoria excluída!');
        fetchCategories();
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
    } finally {
      setCategoryToDelete(null);
    }
  };

  const openEditModal = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      type: category.type,
      icon: category.icon || 'Tag',
      color: category.color || '#3660F9',
      parent_id: category.parent_id || ''
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      type: activeSubTab,
      icon: 'Tag',
      color: activeSubTab === 'expense' ? '#EF4444' : '#10B981',
      parent_id: ''
    });
    setIsModalOpen(true);
  };

  const filteredCategories = categories.filter(c => c.type === activeSubTab);
  const parentCategories = filteredCategories.filter(c => !c.parent_id);
  
  const getSubcategories = (parentId: string) => {
    return filteredCategories.filter(c => c.parent_id === parentId);
  };

  const renderIcon = (iconName: string, color: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.Tag;
    return <IconComponent size={20} color={color} />;
  };

  const commonIcons = ['Tag', 'Home', 'Car', 'Coffee', 'ShoppingBag', 'Heart', 'Briefcase', 'GraduationCap', 'Zap', 'Smartphone', 'Wifi', 'Gift', 'Plane', 'Music', 'Video', 'Book', 'Utensils', 'Smile', 'Star', 'TrendingUp', 'TrendingDown', 'DollarSign', 'CreditCard', 'Wallet'];
  const commonColors = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#64748B', '#17161A'];

  return (
    <main className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 w-full max-w-4xl mx-auto">
      <div className="flex gap-2 mb-8 mt-4 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubTab('expense')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeSubTab === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ArrowDownRight size={16} />
          Despesas
        </button>
        <button
          onClick={() => setActiveSubTab('income')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeSubTab === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ArrowUpRight size={16} />
          Receitas
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#3660F9] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {parentCategories.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[32px] border border-gray-100">
              <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Nenhuma categoria encontrada.</p>
            </div>
          ) : (
            parentCategories.map(category => (
              <div key={category.id} className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 sm:p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${category.color}15` }}>
                      {renderIcon(category.icon || 'Tag', category.color || '#17161A')}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#17161A] text-lg">{category.name}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(category)} className="p-2 text-gray-400 hover:text-[#3660F9] hover:bg-blue-50 rounded-full transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(category.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {getSubcategories(category.id).length > 0 && (
                  <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-100 space-y-2">
                    {getSubcategories(category.id).map(sub => (
                      <div key={sub.id} className="flex items-center justify-between pl-12 py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${sub.color}15` }}>
                            {renderIcon(sub.icon || 'Tag', sub.color || '#17161A')}
                          </div>
                          <span className="font-medium text-gray-700">{sub.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditModal(sub)} className="p-1.5 text-gray-400 hover:text-[#3660F9] rounded-full transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-full transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={openNewModal}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 bg-[#17161A] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-40"
        title="Nova Categoria"
      >
        <Plus size={28} />
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#17161A]">
                {editingId ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Type size={16} /> Nome da Categoria
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#3660F9] focus:border-transparent outline-none transition-all font-medium"
                  placeholder="Ex: Alimentação"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <FolderTree size={16} /> Categoria Pai (Subcategoria)
                </label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#3660F9] focus:border-transparent outline-none transition-all font-medium"
                >
                  <option value="">Nenhuma (Categoria Principal)</option>
                  {parentCategories.filter(c => c.id !== editingId).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Tag size={16} /> Ícone
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {commonIcons.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`p-3 rounded-xl flex items-center justify-center transition-all ${formData.icon === icon ? 'bg-[#EEF2FF] border-2 border-[#3660F9]' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'}`}
                    >
                      {renderIcon(icon, formData.icon === icon ? '#3660F9' : '#6B7280')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Palette size={16} /> Cor
                </label>
                <div className="flex flex-wrap gap-3">
                  {commonColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-10 h-10 rounded-full transition-transform ${formData.color === color ? 'scale-110 ring-4 ring-offset-2 ring-gray-200' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#17161A] text-white py-4 rounded-2xl font-bold hover:bg-[#3660F9] transition-colors"
              >
                {editingId ? 'Salvar Alterações' : 'Criar Categoria'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Categoria</h3>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                >
                  Excluir
                </button>
              </div>
            </div>
          </motion.div>
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
    </main>
  );
}
