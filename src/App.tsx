/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  HardHat, 
  FileText, 
  Plus, 
  BarChart3, 
  Settings,
  ChevronRight,
  Camera,
  MapPin,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  Download,
  Trash2,
  Image as ImageIcon,
  Save,
  Mic,
  TrendingUp,
  Database,
  Cloud,
  Lock,
  LogOut
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, VerticalAlign, TableBorders } from 'docx';
import { saveAs } from 'file-saver';
import { cn, apiFetch } from './utils';
import { Construction, Report, CompanySettings, ReportPhoto, ReportChecklistItem, ChecklistTemplate } from './types';

// --- Components ---

const ConfirmationModal = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "EXCLUIR", 
  cancelText = "CANCELAR",
  isDanger = true
}: { 
  isOpen: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void, 
  confirmText?: string, 
  cancelText?: string,
  isDanger?: boolean
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white w-full max-w-sm rounded-[32px] p-8 relative z-10 shadow-2xl"
        >
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6",
            isDanger ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500"
          )}>
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 text-center mb-2">{title}</h3>
          <p className="text-sm text-slate-500 text-center mb-8 leading-relaxed">
            {message}
          </p>
          <div className="space-y-3">
            <button 
              onClick={onConfirm}
              className={cn(
                "w-full py-4 rounded-2xl font-bold shadow-md transition-transform active:scale-95",
                isDanger ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
              )}
            >
              {confirmText}
            </button>
            <button 
              onClick={onCancel}
              className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600"
            >
              {cancelText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const BottomNav = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) => {
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Início' },
    { id: 'obras', icon: HardHat, label: 'Obras' },
    { id: 'plus', icon: Plus, label: '', isAction: true },
    { id: 'relatorios', icon: FileText, label: 'Relatórios' },
    { id: 'analise', icon: BarChart3, label: 'Análise' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-between items-center safe-bottom z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex flex-col items-center justify-center transition-colors",
            tab.isAction ? "bg-brand-teal text-white p-3 rounded-full -mt-8 shadow-lg ring-4 ring-brand-gray" : "flex-1 py-1",
            activeTab === tab.id && !tab.isAction ? "text-brand-teal" : "text-slate-400"
          )}
        >
          <tab.icon size={tab.isAction ? 28 : 22} />
          {!tab.isAction && <span className="text-[10px] mt-1 font-medium">{tab.label}</span>}
        </button>
      ))}
    </nav>
  );
};

const Header = ({ title, subtitle, showBack, onBack }: { title: string, subtitle?: string, showBack?: boolean, onBack?: () => void }) => (
  <header className="bg-white px-6 pt-8 pb-4 sticky top-0 z-40 border-b border-slate-100">
    <div className="flex items-center gap-3">
      {showBack && (
        <button onClick={onBack} className="p-2 -ml-2 text-slate-600">
          <ArrowLeft size={20} />
        </button>
      )}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
      </div>
    </div>
  </header>
);

const VoiceButton = ({ onResult, showToast }: { onResult: (text: string) => void, showToast?: (msg: string, type?: 'success' | 'error') => void }) => {
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      if (showToast) showToast('Seu navegador não suporta reconhecimento de voz.', 'error');
      else alert('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      if (showToast) showToast('Erro no reconhecimento de voz.', 'error');
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.start();
  };

  return (
    <button 
      type="button"
      onClick={startListening}
      className={cn(
        "p-3 rounded-xl transition-all flex items-center justify-center",
        isListening ? "bg-rose-500 text-white animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      )}
      title="Ativar digitação por voz"
    >
      <Mic size={20} />
    </button>
  );
};

const LoginScreen = ({ onLogin, showToast }: { onLogin: (user: any) => void, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm();

  const onSubmit = async (data: any) => {
    try {
      const endpoint = isSignUp ? '/api/signup' : '/api/login';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (res.ok) {
        if (isSignUp) {
          const result = await res.json();
          showToast(result.message || 'Conta criada com sucesso!');
          setIsSignUp(false);
          reset();
        } else {
          const user = await res.json();
          onLogin(user);
          showToast('BEM-VINDO DE VOLTA!');
        }
      } else {
        const err = await res.json();
        const message = err.detail ? `${err.error} ${err.detail}` : (err.error || 'Erro ao processar');
        showToast(message, 'error');
      }
    } catch (error) {
      showToast('Erro de conexão', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-brand-blue text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl mb-6">
            <HardHat size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ProteForms RTI</h1>
          <p className="text-slate-500 text-sm">
            {isSignUp ? 'Crie sua conta para começar' : 'Entre com suas credenciais para acessar'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nome Completo</label>
              <input 
                {...register('name')} 
                type="text" 
                placeholder="Seu Nome" 
                className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-brand-blue outline-none transition-all" 
                required 
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">E-mail</label>
            <input 
              {...register('email')} 
              type="email" 
              placeholder="seu@email.com" 
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-brand-blue outline-none transition-all" 
              required 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Senha</label>
            <input 
              {...register('password')} 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-brand-blue outline-none transition-all" 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-4 bg-brand-blue text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (isSignUp ? 'CRIANDO CONTA...' : 'ENTRANDO...') : (
              <>
                {isSignUp ? <Plus size={18} /> : <Lock size={18} />}
                {isSignUp ? 'CRIAR NOVA CONTA' : 'ENTRAR NO SISTEMA'}
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              reset();
            }}
            className="text-sm font-semibold text-brand-blue hover:underline"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Crie uma agora'}
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
          Protefor Engenharia & Segurança
        </p>
      </div>
    </div>
  );
};

// --- Screens ---

const Dashboard = ({ onTabChange, onSelectReport }: { onTabChange: (tab: string) => void, onSelectReport: (id: number) => void }) => {
  const [stats, setStats] = useState<any>(null);
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  useEffect(() => {
    apiFetch('/api/stats').then(res => res.json()).then(data => {
      if (data && !data.error) setStats(data);
    });
    apiFetch('/api/reports').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setRecentReports(data.slice(0, 5));
    });
  }, []);

  return (
    <div className="pb-24">
      <Header title="Proteforms" subtitle="Gestão Técnica de Inspeções" />
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Obras Ativas</p>
            <p className="text-2xl font-bold text-brand-teal">{stats?.totalConstructions || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Relatórios</p>
            <p className="text-2xl font-bold text-brand-teal">{stats?.totalReports || 0}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Ações Rápidas</h2>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => onTabChange('plus')}
              className="flex items-center justify-between p-4 bg-brand-teal text-white rounded-2xl shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Plus size={20} />
                </div>
                <span className="font-semibold">Novo Relatório</span>
              </div>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Atividade Recente</h2>
          <div className="space-y-3">
            {recentReports.map(report => (
              <button 
                key={report.id} 
                onClick={() => onSelectReport(report.id)}
                className="w-full bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                  <FileText size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    Relatório #{report.contract_number}.{(report.sequence_number || 1).toString().padStart(2, '0')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {report.construction_name} • {format(parseISO(report.inspection_date), "dd/MM/yy")}
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] px-2 py-1 font-bold rounded-full uppercase",
                  report.status === 'finalizado' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {report.status.replace('_', ' ')}
                </span>
              </button>
            ))}
            {recentReports.length === 0 && (
              <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400">Nenhuma atividade recente.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const ObrasList = ({ onEdit, showToast }: { onEdit: (obra: Construction) => void, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [obras, setObras] = useState<Construction[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/api/constructions').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setObras(data);
    });
  }, []);

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const res = await apiFetch(`/api/constructions/${deletingId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('OBRA EXCLUÍDA COM SUCESSO!');
        setObras(obras.filter(o => o.id !== deletingId));
      } else {
        const err = await res.json();
        showToast(err.error || 'Erro ao excluir obra', 'error');
      }
    } catch (error) {
      showToast('Erro de conexão ao excluir obra', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="pb-24">
      <Header title="Obras" subtitle="Gerenciamento de Canteiros" />
      <div className="p-6 space-y-4">
        {obras.map((obra) => (
          <motion.div 
            key={obra.id}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100"
          >
            <div className="h-32 bg-slate-200 relative">
              {obra.photo ? (
                <img src={obra.photo} alt={obra.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <HardHat size={40} />
                </div>
              )}
              <div className="absolute top-3 right-3 flex gap-2">
                <button 
                  onClick={() => onEdit(obra)}
                  className="bg-white/90 backdrop-blur-sm p-2 rounded-full text-brand-teal shadow-sm"
                >
                  <Settings size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeletingId(obra.id!); }}
                  className="bg-white/90 backdrop-blur-sm p-2 rounded-full text-rose-500 shadow-sm"
                >
                  <Trash2 size={16} />
                </button>
                <span className={cn(
                  "text-[10px] px-2 py-1 font-bold rounded-full uppercase tracking-wider",
                  obra.status === 'em_andamento' ? "bg-brand-teal text-white" : "bg-slate-500 text-white"
                )}>
                  {obra.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-slate-900 text-lg">{obra.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-slate-500">
                <MapPin size={14} />
                <span className="text-xs truncate">{obra.address}</span>
              </div>
              <div className="mt-4 flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Responsável</p>
                  <p className="text-xs font-medium text-slate-700">{obra.responsible}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Início</p>
                  <p className="text-xs font-medium text-slate-700">{obra.start_date}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {obras.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <HardHat size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">Nenhuma obra cadastrada.</p>
          </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={deletingId !== null}
        title="Excluir Obra"
        message="Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita e só será permitida se não houver relatórios vinculados."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};

const CreateReportFlow = ({ onCancel, onSuccess, initialData, showToast }: { onCancel: () => void, onSuccess: () => void, initialData?: Report, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [step, setStep] = useState(initialData ? 3 : 1);
  const [obras, setObras] = useState<Construction[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedObra, setSelectedObra] = useState<Construction | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [photos, setPhotos] = useState<ReportPhoto[]>(initialData?.photos || []);
  const [observations, setObservations] = useState(initialData?.technical_observations || '');
  const [checklist, setChecklist] = useState<ReportChecklistItem[]>(initialData?.checklist || []);
  const [reportDate, setReportDate] = useState(initialData?.inspection_date || format(new Date(), 'yyyy-MM-dd'));
  const [photoSourceMenuOpen, setPhotoSourceMenuOpen] = useState(false);

  useEffect(() => {
    apiFetch('/api/constructions').then(res => res.json()).then(data => {
      if (Array.isArray(data)) {
        setObras(data);
        if (initialData) {
          const obra = data.find((o: Construction) => o.id === initialData.construction_id);
          if (obra) setSelectedObra(obra);
        }
      }
    });
    apiFetch('/api/checklist-templates').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setTemplates(data);
    });
  }, [initialData]);

  const handleSelectTemplate = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setChecklist(template.items.map(item => ({ item_name: item, status: '', observation: '' })));
    setStep(3);
  };

  const skipChecklist = () => {
    setChecklist([]);
    setStep(3);
  };

  const handleAddPhoto = (mode: 'camera' | 'gallery') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (mode === 'camera') {
      input.setAttribute('capture', 'environment');
    }
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re: any) => {
          setPhotos([...photos, { image_url: re.target.result, caption: '', order_index: photos.length }]);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const saveReport = async (status: 'em_preenchimento' | 'finalizado') => {
    if (!selectedObra) return;
    
    const payload = {
      construction_id: selectedObra.id,
      inspection_date: reportDate,
      technical_observations: observations,
      photos,
      checklist,
      status
    };

    const url = initialData ? `/api/reports/${initialData.id}` : '/api/reports';
    const method = initialData ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      showToast('RELATÓRIO SALVO COM SUCESSO!');
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-[60] overflow-y-auto pb-24">
      <Header 
        title={
          step === 1 ? "Selecionar Obra" : 
          step === 2 ? "Selecionar Modelo" : 
          step === 3 ? "Data e Fotos" : 
          step === 4 ? "Observações" : 
          "Checklist e Finalizar"
        } 
        showBack 
        onBack={() => step > 1 ? setStep(step - 1) : onCancel()}
      />

      <div className="p-6">
        {/* Photo Source Menu */}
        <AnimatePresence>
          {photoSourceMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setPhotoSourceMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[100]"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.9, opacity: 0 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-[300px] bg-white rounded-3xl p-6 z-[101] shadow-2xl"
              >
                <h3 className="text-center font-bold text-slate-900 mb-6">Adicionar Foto</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { handleAddPhoto('camera'); setPhotoSourceMenuOpen(false); }}
                    className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl transition-colors active:bg-slate-100"
                  >
                    <div className="w-12 h-12 bg-brand-teal text-white rounded-full flex items-center justify-center">
                      <Camera size={24} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Câmera</span>
                  </button>
                  <button 
                    onClick={() => { handleAddPhoto('gallery'); setPhotoSourceMenuOpen(false); }}
                    className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl transition-colors active:bg-slate-100"
                  >
                    <div className="w-12 h-12 bg-brand-teal text-white rounded-full flex items-center justify-center">
                      <ImageIcon size={24} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Galeria</span>
                  </button>
                </div>
                <button 
                  onClick={() => setPhotoSourceMenuOpen(false)}
                  className="w-full mt-6 py-3 text-slate-400 font-bold text-xs uppercase tracking-wider"
                >
                  Cancelar
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {step === 1 && (
          <div className="space-y-3">
            {obras.map(obra => (
              <button 
                key={obra.id}
                onClick={() => { setSelectedObra(obra); setStep(2); }}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border transition-all",
                  selectedObra?.id === obra.id ? "border-brand-teal bg-teal-50" : "border-slate-200 bg-white"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden">
                    {obra.photo && <img src={obra.photo} className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{obra.name}</p>
                    <p className="text-xs text-slate-500">{obra.contractor}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <button 
              onClick={skipChecklist}
              className="w-full text-center p-4 rounded-2xl border border-dashed border-slate-300 text-slate-500 font-bold text-sm bg-white mb-4"
            >
              PULAR CHECKLIST (OPCIONAL)
            </button>
            {templates.map(template => (
              <button 
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-brand-teal transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{template.title}</p>
                    <p className="text-xs text-slate-500">{template.items.length} itens no checklist</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </button>
            ))}
            {templates.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">Nenhum modelo de checklist cadastrado.</p>
                <p className="text-xs text-slate-400 mt-1">Vá em Configurações para criar modelos.</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Data do Relatório</label>
              <input 
                type="date" 
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 bg-white"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase">Evidências Fotográficas ({photos.length})</label>
                <button onClick={() => setPhotoSourceMenuOpen(true)} className="text-brand-teal text-xs font-bold flex items-center gap-1">
                  <Plus size={16} /> ADICIONAR
                </button>
              </div>

              <div className="space-y-4">
                {photos.map((photo, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <img src={photo.image_url} className="w-full h-48 object-cover" />
                    <div className="p-3 flex gap-2">
                      <input 
                        placeholder="Legenda da foto (Obrigatório)"
                        value={photo.caption}
                        onChange={(e) => {
                          const newPhotos = [...photos];
                          newPhotos[idx].caption = e.target.value;
                          setPhotos(newPhotos);
                        }}
                        className="flex-1 text-sm p-4 bg-slate-50 rounded-xl border-none focus:ring-1 focus:ring-brand-teal"
                      />
                      <VoiceButton 
                        showToast={showToast}
                        onResult={(text) => {
                          const newPhotos = [...photos];
                          newPhotos[idx].caption = (newPhotos[idx].caption + ' ' + text).trim();
                          setPhotos(newPhotos);
                        }}
                      />
                    </div>
                  </div>
                ))}
                {photos.length === 0 ? (
                  <button 
                    onClick={() => setPhotoSourceMenuOpen(true)}
                    className="w-full py-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-2"
                  >
                    <Camera size={32} />
                    <span className="text-sm font-medium">Toque para adicionar fotos</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => setPhotoSourceMenuOpen(true)}
                    className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-1"
                  >
                    <Plus size={24} />
                    <span className="text-xs font-medium">Adicionar mais fotos</span>
                  </button>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => setStep(4)}
              disabled={photos.length === 0 || photos.some(p => !p.caption)}
              className="w-full py-4 bg-brand-teal text-white rounded-xl font-bold disabled:opacity-50"
            >
              PRÓXIMA ETAPA
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase">Observações Técnicas</label>
                <VoiceButton showToast={showToast} onResult={(text) => setObservations(prev => (prev + ' ' + text).trim())} />
              </div>
              <textarea 
                rows={8}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Descreva o andamento da obra, problemas encontrados e recomendações..."
                className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>
            <button 
              onClick={() => setStep(5)}
              className="w-full py-4 bg-brand-teal text-white rounded-xl font-bold"
            >
              PRÓXIMA ETAPA
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-xs font-bold text-slate-500 uppercase">Checklist: {selectedTemplate?.title || 'Personalizado'}</label>
                <span className="text-[10px] text-slate-400 font-bold">{checklist.filter(c => c.status === 'C').length}/{checklist.length} CONFORME</span>
              </div>
              {checklist.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-medium text-slate-700">{item.item_name}</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(['C', 'NC', 'NA'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            const newCheck = [...checklist];
                            newCheck[idx].status = status;
                            setChecklist(newCheck);
                          }}
                          className={cn(
                            "py-2 rounded-lg text-xs font-bold transition-all border",
                            item.status === status 
                              ? status === 'C' ? "bg-emerald-500 text-white border-emerald-500" :
                                status === 'NC' ? "bg-rose-500 text-white border-rose-500" :
                                "bg-slate-500 text-white border-slate-500"
                              : "bg-white text-slate-400 border-slate-200"
                          )}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input 
                    placeholder="Observação (opcional)"
                    value={item.observation}
                    onChange={(e) => {
                      const newCheck = [...checklist];
                      newCheck[idx].observation = e.target.value;
                      setChecklist(newCheck);
                    }}
                    className="w-full text-xs p-2 bg-slate-50 rounded-lg border-none"
                  />
                </div>
              ))}
              {checklist.length === 0 && (
                <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400">Checklist ignorado para este relatório.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button 
                onClick={() => saveReport('em_preenchimento')}
                className="py-4 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm"
              >
                SALVAR RASCUNHO
              </button>
              <button 
                onClick={() => saveReport('finalizado')}
                className="py-4 bg-brand-teal text-white rounded-xl font-bold text-sm"
              >
                FINALIZAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsScreen = ({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [settings, setSettings] = useState<CompanySettings>({
    name: '', cnpj: '', logo: '', technical_responsible: '', email: '', phone: '', default_checklist: '[]',
    resp1_name: '', resp1_reg_name: '', resp1_reg_num: '', resp1_title: '', resp1_signature: '',
    resp2_name: '', resp2_reg_name: '', resp2_reg_num: '', resp2_title: '', resp2_signature: '',
    primary_resp: 'resp1'
  });
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateItems, setNewTemplateItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<any | null>(null);

  useEffect(() => {
    apiFetch('/api/settings').then(res => res.json()).then(data => {
      if (data && data.id) setSettings(data);
    });
    apiFetch('/api/checklist-templates').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setTemplates(data);
    });
    apiFetch('/api/users').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setUsers(data);
    });
  }, []);

  const handleSaveSettings = async () => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showToast('CONFIGURAÇÕES SALVAS COM SUCESSO');
      } else {
        showToast('ERRO AO SALVAR CONFIGURAÇÕES', 'error');
      }
    } catch (error) {
      showToast('ERRO DE CONEXÃO', 'error');
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplateTitle || newTemplateItems.length === 0) return;
    const res = await apiFetch('/api/checklist-templates', {
      method: 'POST',
      body: JSON.stringify({ title: newTemplateTitle, items: newTemplateItems }),
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates([...templates, { id: data.id, title: newTemplateTitle, items: newTemplateItems }]);
      setNewTemplateTitle('');
      setNewTemplateItems([]);
      showToast('MODELO DE CHECKLIST CRIADO COM SUCESSO!');
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    const res = await apiFetch(`/api/checklist-templates/${deletingTemplate.id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates(templates.filter(t => t.id !== deletingTemplate.id));
      showToast('MODELO EXCLUÍDO');
    }
    setDeletingTemplate(null);
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    const res = await apiFetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(users.filter(u => u.id !== deletingUser.id));
      showToast('USUÁRIO EXCLUÍDO');
    } else {
      const err = await res.json();
      showToast(err.error || 'Erro ao excluir usuário', 'error');
    }
    setDeletingUser(null);
  };

  const handleSignatureUpload = (resp: 'resp1' | 'resp2', e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re: any) => setSettings({ ...settings, [`${resp}_signature`]: re.target.result });
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re: any) => setSettings({ ...settings, logo: re.target.result });
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="pb-24">
      <Header title="Configurações" subtitle="Dados da Empresa e Modelos" />
      <div className="p-6 space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Dados da Empresa</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div 
                onClick={() => document.getElementById('logo-up')?.click()}
                className="w-20 h-20 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 cursor-pointer overflow-hidden"
              >
                {settings.logo ? <img src={settings.logo} className="w-full h-full object-contain" /> : <ImageIcon size={24} />}
                <input id="logo-up" type="file" className="hidden" onChange={handleLogoUpload} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs font-bold text-slate-500">Logotipo</p>
                <p className="text-[10px] text-slate-400">PNG ou JPG. Recomendado 400x400px.</p>
              </div>
            </div>
            <input 
              placeholder="Nome da Empresa" 
              value={settings.name}
              onChange={e => setSettings({...settings, name: e.target.value})}
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm"
            />
            <input 
              placeholder="CNPJ" 
              value={settings.cnpj}
              onChange={e => setSettings({...settings, cnpj: e.target.value})}
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm"
            />
            <input 
              placeholder="Responsável Técnico Geral (Opcional)" 
              value={settings.technical_responsible || ''}
              onChange={e => setSettings({...settings, technical_responsible: e.target.value})}
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input 
                placeholder="E-mail da Empresa" 
                value={settings.email || ''}
                onChange={e => setSettings({...settings, email: e.target.value})}
                className="p-4 rounded-xl border border-slate-200 bg-white text-sm"
              />
              <input 
                placeholder="Telefone" 
                value={settings.phone || ''}
                onChange={e => setSettings({...settings, phone: e.target.value})}
                className="p-4 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Responsáveis Técnicos</h2>
          <div className="space-y-6">
            {/* Responsável 1 */}
            <div className={cn(
              "bg-white p-4 rounded-2xl border transition-all space-y-3",
              settings.primary_resp === 'resp1' ? "border-brand-teal ring-1 ring-brand-teal" : "border-slate-200"
            )}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-brand-teal uppercase">Responsável 1</p>
                <button 
                  onClick={() => setSettings({...settings, primary_resp: 'resp1'})}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors",
                    settings.primary_resp === 'resp1' ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-400"
                  )}
                >
                  {settings.primary_resp === 'resp1' ? 'Principal' : 'Tornar Principal'}
                </button>
              </div>
              <input placeholder="Nome Completo" value={settings.resp1_name || ''} onChange={e => setSettings({...settings, resp1_name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Doc (ex: CREA/SC)" value={settings.resp1_reg_name || ''} onChange={e => setSettings({...settings, resp1_reg_name: e.target.value})} className="p-3 rounded-xl border border-slate-200 text-sm" />
                <input placeholder="Número do Registro" value={settings.resp1_reg_num || ''} onChange={e => setSettings({...settings, resp1_reg_num: e.target.value})} className="p-3 rounded-xl border border-slate-200 text-sm" />
              </div>
              <input placeholder="Título (ex: Eng. Mecânico)" value={settings.resp1_title || ''} onChange={e => setSettings({...settings, resp1_title: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Assinatura</p>
                <div onClick={() => document.getElementById('sig1')?.click()} className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden">
                  {settings.resp1_signature ? <img src={settings.resp1_signature} className="h-full object-contain" /> : <ImageIcon size={20} className="text-slate-300" />}
                  <input id="sig1" type="file" className="hidden" onChange={e => handleSignatureUpload('resp1', e)} />
                </div>
              </div>
            </div>

            {/* Responsável 2 */}
            <div className={cn(
              "bg-white p-4 rounded-2xl border transition-all space-y-3",
              settings.primary_resp === 'resp2' ? "border-brand-teal ring-1 ring-brand-teal" : "border-slate-200"
            )}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-brand-teal uppercase">Responsável 2</p>
                <button 
                  onClick={() => setSettings({...settings, primary_resp: 'resp2'})}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors",
                    settings.primary_resp === 'resp2' ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-400"
                  )}
                >
                  {settings.primary_resp === 'resp2' ? 'Principal' : 'Tornar Principal'}
                </button>
              </div>
              <input placeholder="Nome Completo" value={settings.resp2_name || ''} onChange={e => setSettings({...settings, resp2_name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Doc (ex: CREA/SC)" value={settings.resp2_reg_name || ''} onChange={e => setSettings({...settings, resp2_reg_name: e.target.value})} className="p-3 rounded-xl border border-slate-200 text-sm" />
                <input placeholder="Número do Registro" value={settings.resp2_reg_num || ''} onChange={e => setSettings({...settings, resp2_reg_num: e.target.value})} className="p-3 rounded-xl border border-slate-200 text-sm" />
              </div>
              <input placeholder="Título (ex: Eng. de Segurança)" value={settings.resp2_title || ''} onChange={e => setSettings({...settings, resp2_title: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Assinatura</p>
                <div onClick={() => document.getElementById('sig2')?.click()} className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden">
                  {settings.resp2_signature ? <img src={settings.resp2_signature} className="h-full object-contain" /> : <ImageIcon size={20} className="text-slate-300" />}
                  <input id="sig2" type="file" className="hidden" onChange={e => handleSignatureUpload('resp2', e)} />
                </div>
              </div>
            </div>

            <button 
              onClick={handleSaveSettings}
              className="w-full py-4 bg-brand-teal text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md"
            >
              <Save size={18} /> SALVAR CONFIGURAÇÕES
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Gerenciar Usuários</h2>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email} • <span className="capitalize">{user.role}</span></p>
                </div>
                {user.email !== 'admin@proteforms.com' && (
                  <button onClick={() => setDeletingUser(user)} className="text-red-400 p-2">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-4">Nenhum usuário cadastrado.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Modelos de Checklist</h2>
          
          {/* Create New Template */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Criar Novo Modelo</h3>
            <input 
              placeholder="Título do Checklist (ex: Inspeção Elétrica)" 
              value={newTemplateTitle}
              onChange={e => setNewTemplateTitle(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
            />
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <input 
                  placeholder="Adicionar item ao modelo" 
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                />
                <button 
                  onClick={() => { if(newItem) { setNewTemplateItems([...newTemplateItems, newItem]); setNewItem(''); } }}
                  className="p-3 bg-brand-teal text-white rounded-xl"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="space-y-1">
                {newTemplateItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-600">{item}</span>
                    <button onClick={() => setNewTemplateItems(newTemplateItems.filter((_, i) => i !== idx))} className="text-red-400">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={handleAddTemplate}
              disabled={!newTemplateTitle || newTemplateItems.length === 0}
              className="w-full py-3 bg-brand-teal text-white rounded-xl font-bold text-xs disabled:opacity-50"
            >
              CRIAR MODELO
            </button>
          </div>

          {/* List Existing Templates */}
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-slate-900">{template.title}</h4>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">{template.items.length} itens</p>
                  </div>
                  <button onClick={() => setDeletingTemplate(template)} className="text-red-400 p-1">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {template.items.slice(0, 3).map((item, i) => (
                    <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{item}</span>
                  ))}
                  {template.items.length > 3 && <span className="text-[10px] text-slate-400">+{template.items.length - 3} mais</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ConfirmationModal 
        isOpen={deletingUser !== null}
        title="Excluir Usuário"
        message={`Tem certeza que deseja excluir o usuário ${deletingUser?.name}?`}
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeletingUser(null)}
      />

      <ConfirmationModal 
        isOpen={deletingTemplate !== null}
        title="Excluir Modelo"
        message={`Tem certeza que deseja excluir o modelo "${deletingTemplate?.title}"?`}
        onConfirm={confirmDeleteTemplate}
        onCancel={() => setDeletingTemplate(null)}
      />
    </div>
  );
};

const ReportsList = ({ onSelect, showToast }: { onSelect: (report: Report) => void, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/api/reports').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setReports(data);
    });
  }, []);

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const res = await apiFetch(`/api/reports/${deletingId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('RELATÓRIO EXCLUÍDO COM SUCESSO!');
        setReports(reports.filter(r => r.id !== deletingId));
      } else {
        const err = await res.json();
        showToast(err.error || 'Erro ao excluir relatório', 'error');
      }
    } catch (error) {
      showToast('Erro de conexão ao excluir relatório', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="pb-24">
      <Header title="Relatórios" subtitle="Histórico de Inspeções" />
      <div className="p-6 space-y-3">
        {reports.map(report => (
          <div key={report.id} className="relative group">
            <button 
              onClick={() => onSelect(report)}
              className="w-full text-left bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 pr-12"
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                report.status === 'finalizado' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
              )}>
                <FileText size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900">
                  {report.contract_number ? `${report.contract_number}.${(report.sequence_number || 1).toString().padStart(2, '0')}` : `#${report.id}`} - RTI_{report.construction_name?.substring(0, 5).toUpperCase()}
                </p>
                <p className="text-xs text-slate-500">{report.construction_name} • {format(parseISO(report.inspection_date), 'dd/MM/yyyy')}</p>
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-[9px] px-2 py-1 font-bold rounded-full uppercase",
                  report.status === 'finalizado' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                )}>
                  {report.status.replace('_', ' ')}
                </span>
              </div>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setDeletingId(report.id!); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-rose-500 transition-colors"
              title="Excluir Relatório"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {reports.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">Nenhum relatório encontrado.</p>
          </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={deletingId !== null}
        title="Excluir Relatório"
        message="Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};

const ReportDetail = ({ reportId, onBack, onEdit, showToast }: { reportId: number, onBack: () => void, onEdit: (report: Report) => void, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [report, setReport] = useState<Report | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [construction, setConstruction] = useState<Construction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const rRes = await apiFetch(`/api/reports/${reportId}`);
      const rData = await rRes.json();
      setReport(rData);

      const sRes = await apiFetch('/api/settings');
      const sData = await sRes.json();
      setSettings(sData);

      const cRes = await apiFetch('/api/constructions');
      const cData = await cRes.json();
      const obra = cData.find((o: Construction) => o.id === rData.construction_id);
      setConstruction(obra);
    };
    loadData();
  }, [reportId]);

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('RELATÓRIO EXCLUÍDO COM SUCESSO!');
        onBack();
      } else {
        const err = await res.json();
        showToast(err.error || 'Erro ao excluir relatório', 'error');
      }
    } catch (error) {
      showToast('Erro de conexão ao excluir relatório', 'error');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const generatePDF = () => {
    if (!report || !settings || !construction) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Capa
    if (settings.logo) {
      doc.addImage(settings.logo, 'PNG', pageWidth / 2 - 35, 20, 70, 70);
    }
    
    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text(`VISITA TÉCNICA CANTEIRO DE ${construction.name.toUpperCase()}`, pageWidth / 2, 100, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    const constructionNameSplit = doc.splitTextToSize(construction.name.toUpperCase(), pageWidth - 40);
    doc.text(constructionNameSplit, pageWidth / 2, 115, { align: 'center' });
    
    doc.setFontSize(28);
    doc.setTextColor(13, 78, 94);
    doc.text("Relatório de Inspeção", pageWidth / 2, 145, { align: 'center' });
    
    const reportNum = `${construction.contract_number}.${(report.sequence_number || 1).toString().padStart(2, '0')}`;
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.text(`Nº ${reportNum}`, pageWidth / 2, 160, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(format(parseISO(report.inspection_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR }), pageWidth / 2, 185, { align: 'center' });

    // Rodapé da Capa
    doc.setDrawColor(200);
    doc.line(20, 210, pageWidth - 20, 210);
    doc.setFontSize(12);
    doc.setTextColor(13, 78, 94);
    doc.setFont("helvetica", "bold");
    doc.text("EMPRESA", 20, 220);
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.text(construction.contractor, 20, 230);

    doc.line(20, 240, pageWidth - 20, 240);
    doc.setFontSize(12);
    doc.setTextColor(13, 78, 94);
    doc.setFont("helvetica", "bold");
    doc.text("RESPONSÁVEL TÉCNICO", 20, 250);

    // Assinaturas na Capa
    if (settings.resp1_signature) {
      doc.addImage(settings.resp1_signature, 'PNG', 20, 255, 60, 20);
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      doc.text(settings.resp1_name || '', 50, 278, { align: 'center' });
      doc.text(settings.resp1_title || '', 50, 282, { align: 'center' });
      doc.text(`${settings.resp1_reg_name} ${settings.resp1_reg_num}`, 50, 286, { align: 'center' });
    }

    if (settings.resp2_signature) {
      doc.addImage(settings.resp2_signature, 'PNG', pageWidth - 80, 255, 60, 20);
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      doc.text(settings.resp2_name || '', pageWidth - 50, 278, { align: 'center' });
      doc.text(settings.resp2_title || '', pageWidth - 50, 282, { align: 'center' });
      doc.text(`${settings.resp2_reg_name} ${settings.resp2_reg_num}`, pageWidth - 50, 286, { align: 'center' });
    }

    // Nova Página - Dados
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(13, 78, 94);
    doc.text(`1. DADOS DA ${construction.name.toUpperCase()}`, 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(0);
    const obraData = [
      ["Nome da Obra", construction.name],
      ["Endereço", construction.address],
      ["Contratante", construction.contractor],
      ["Responsável", construction.responsible]
    ];
    
    autoTable(doc, {
      startY: 25,
      head: [['Campo', 'Informação']],
      body: obraData,
      theme: 'striped',
      headStyles: { fillColor: [13, 78, 94] }
    });

    // Observações
    doc.setFontSize(16);
    doc.setTextColor(13, 78, 94);
    doc.text("2. OBSERVAÇÕES TÉCNICAS", 20, (doc as any).lastAutoTable.finalY + 15);
    
    doc.setFontSize(10);
    doc.setTextColor(50);
    const splitText = doc.splitTextToSize(report.technical_observations, pageWidth - 40);
    doc.text(splitText, 20, (doc as any).lastAutoTable.finalY + 25);

    // Fotos - 2x2 Grid
    if (report.photos && report.photos.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(13, 78, 94);
      doc.text("3. EVIDÊNCIAS FOTOGRÁFICAS", 20, 20);
      
      const margin = 15;
      const gridWidth = (pageWidth - (margin * 3)) / 2;
      const gridHeight = 80;
      const captionHeight = 20;
      
      let currentX = margin;
      let currentY = 30;
      let count = 0;

      report.photos.forEach((photo, i) => {
        if (count > 0 && count % 4 === 0) {
          doc.addPage();
          currentY = 20;
          currentX = margin;
        }

        // Add Image
        doc.addImage(photo.image_url, 'JPEG', currentX, currentY, gridWidth, gridHeight);
        
        // Add Caption
        doc.setFontSize(8);
        doc.setTextColor(50);
        const splitCaption = doc.splitTextToSize(photo.caption, gridWidth);
        doc.text(splitCaption, currentX, currentY + gridHeight + 5);

        // Update positions
        if (count % 2 === 0) {
          currentX += gridWidth + margin;
        } else {
          currentX = margin;
          currentY += gridHeight + captionHeight + 10;
        }
        count++;
      });
    }

    // Checklist
    if (report.checklist && report.checklist.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(13, 78, 94);
      doc.text("4. CHECKLIST DE CONFORMIDADE", 20, 20);
      
      autoTable(doc, {
        startY: 25,
        head: [['Item', 'Status', 'Observação']],
        body: report.checklist.map(c => [c.item_name, c.status || '-', c.observation]),
        theme: 'grid',
        headStyles: { fillColor: [13, 78, 94] }
      });
    }

    // Declaração Final
    doc.addPage();
    const sectionNum = (report.checklist && report.checklist.length > 0) ? 5 : 4;
    doc.setFontSize(16);
    doc.setTextColor(13, 78, 94);
    doc.setFont("helvetica", "bold");
    doc.text(`${sectionNum}. DECLARAÇÃO FINAL`, 20, 20);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    const declarationText = "Este relatório reflete as condições observadas no momento da inspeção, com base nas evidências visuais e informações disponíveis na data da vistoria. As recomendações apresentadas têm caráter técnico preventivo e corretivo, visando à melhoria das condições de segurança, conformidade normativa e integridade das instalações avaliadas. Ressalta-se que a adoção das medidas indicadas é de responsabilidade do responsável pela execução e gestão das atividades, devendo ser implementadas dentro de prazos compatíveis com o nível de risco identificado, bem como mantido acompanhamento periódico para verificação da efetividade das correções realizadas.";
    doc.text(declarationText, 20, 35, { maxWidth: pageWidth - 40, align: 'justify' });

    // Data e Assinatura
    const reportDateFormatted = format(parseISO(report.inspection_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    doc.text(`São José/SC, ${reportDateFormatted}`, pageWidth - 20, 80, { align: 'right' });

    const primaryResp = settings.primary_resp === 'resp2' ? 'resp2' : 'resp1';
    const sigData = primaryResp === 'resp1' ? settings.resp1_signature : settings.resp2_signature;
    const nameData = primaryResp === 'resp1' ? settings.resp1_name : settings.resp2_name;
    const titleData = primaryResp === 'resp1' ? settings.resp1_title : settings.resp2_title;
    const regNameData = primaryResp === 'resp1' ? settings.resp1_reg_name : settings.resp2_reg_name;
    const regNumData = primaryResp === 'resp1' ? settings.resp1_reg_num : settings.resp2_reg_num;

    if (sigData) {
      doc.addImage(sigData, 'PNG', pageWidth / 2 - 30, 100, 60, 20);
      doc.setDrawColor(0);
      doc.line(pageWidth / 2 - 50, 122, pageWidth / 2 + 50, 122);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(titleData || '', pageWidth / 2, 128, { align: 'center' });
      doc.setFont("helvetica", "normal");
      doc.text(nameData || '', pageWidth / 2, 134, { align: 'center' });
      doc.text(`${regNameData} ${regNumData}`, pageWidth / 2, 140, { align: 'center' });
    }

    doc.save(`RTI_${construction.name.replace(/\s/g, '_')}_${report.inspection_date}.pdf`);
  };

  const generateDOCX = async () => {
    if (!report || !settings || !construction) return;

    const photoRows: TableRow[] = [];
    if (report.photos) {
      for (let i = 0; i < report.photos.length; i += 2) {
        const cells: TableCell[] = [];
        
        // Photo 1
        const p1 = report.photos[i];
        const img1 = await fetch(p1.image_url).then(r => r.arrayBuffer());
        cells.push(new TableCell({
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: img1,
                  transformation: { width: 300, height: 200 },
                } as any),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [new TextRun({ text: p1.caption, size: 16 })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
        }));

        // Photo 2 (if exists)
        if (i + 1 < report.photos.length) {
          const p2 = report.photos[i + 1];
          const img2 = await fetch(p2.image_url).then(r => r.arrayBuffer());
          cells.push(new TableCell({
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: img2,
                    transformation: { width: 300, height: 200 },
                  } as any),
                ],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [new TextRun({ text: p2.caption, size: 16 })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }));
        } else {
          cells.push(new TableCell({ children: [] }));
        }

        photoRows.push(new TableRow({ children: cells }));
      }
    }

    const reportNum = `${construction.contract_number}.${(report.sequence_number || 1).toString().padStart(2, '0')}`;
    const logoImg = settings.logo ? await fetch(settings.logo).then(r => r.arrayBuffer()) : null;
    const sig1Img = settings.resp1_signature ? await fetch(settings.resp1_signature).then(r => r.arrayBuffer()) : null;
    const sig2Img = settings.resp2_signature ? await fetch(settings.resp2_signature).then(r => r.arrayBuffer()) : null;

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          ...(logoImg ? [
            new Paragraph({
              children: [new ImageRun({ data: logoImg, transformation: { width: 100, height: 100 } } as any)],
              alignment: AlignmentType.CENTER,
            })
          ] : []),
          new Paragraph({
            text: `VISITA TÉCNICA CANTEIRO DE ${construction.name.toUpperCase()}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: construction.name.toUpperCase(), bold: true, size: 32 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: "Relatório de Inspeção", bold: true, size: 48, color: "0D4E5E" })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: `Nº ${reportNum}`, size: 28 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: format(parseISO(report.inspection_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "EMPRESA", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: construction.contractor }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "RESPONSÁVEL TÉCNICO", heading: HeadingLevel.HEADING_3 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: TableBorders.NONE,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      ...(sig1Img ? [new Paragraph({ children: [new ImageRun({ data: sig1Img, transformation: { width: 150, height: 50 } } as any)], alignment: AlignmentType.CENTER })] : []),
                      new Paragraph({ children: [new TextRun({ text: settings.resp1_name || '', size: 16 })], alignment: AlignmentType.CENTER }),
                      new Paragraph({ children: [new TextRun({ text: settings.resp1_title || '', size: 14 })], alignment: AlignmentType.CENTER }),
                      new Paragraph({ children: [new TextRun({ text: `${settings.resp1_reg_name} ${settings.resp1_reg_num}`, size: 14 })], alignment: AlignmentType.CENTER }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      ...(sig2Img ? [new Paragraph({ children: [new ImageRun({ data: sig2Img, transformation: { width: 150, height: 50 } } as any)], alignment: AlignmentType.CENTER })] : []),
                      new Paragraph({ children: [new TextRun({ text: settings.resp2_name || '', size: 16 })], alignment: AlignmentType.CENTER }),
                      new Paragraph({ children: [new TextRun({ text: settings.resp2_title || '', size: 14 })], alignment: AlignmentType.CENTER }),
                      new Paragraph({ children: [new TextRun({ text: `${settings.resp2_reg_name} ${settings.resp2_reg_num}`, size: 14 })], alignment: AlignmentType.CENTER }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "", pageBreakBefore: true }),
          new Paragraph({ text: `1. DADOS DA ${construction.name.toUpperCase()}`, heading: HeadingLevel.HEADING_2 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [new TableCell({ children: [new Paragraph("Campo")] }), new TableCell({ children: [new Paragraph("Informação")] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph("Nome")] }), new TableCell({ children: [new Paragraph(construction.name)] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph("Endereço")] }), new TableCell({ children: [new Paragraph(construction.address)] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph("Contratante")] }), new TableCell({ children: [new Paragraph(construction.contractor)] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph("Responsável")] }), new TableCell({ children: [new Paragraph(construction.responsible)] })] }),
            ]
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "2. OBSERVAÇÕES TÉCNICAS", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: report.technical_observations }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "3. EVIDÊNCIAS FOTOGRÁFICAS", heading: HeadingLevel.HEADING_2 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: photoRows,
          }),
          new Paragraph({ text: "", pageBreakBefore: true }),
          new Paragraph({ 
            children: [new TextRun({ text: `${(report.checklist && report.checklist.length > 0) ? 5 : 4}. DECLARAÇÃO FINAL`, bold: true, size: 32, color: "0D4E5E" })],
            heading: HeadingLevel.HEADING_2 
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Este relatório reflete as condições observadas no momento da inspeção, com base nas evidências visuais e informações disponíveis na data da vistoria. As recomendações apresentadas têm caráter técnico preventivo e corretivo, visando à melhoria das condições de segurança, conformidade normativa e integridade das instalações avaliadas. Ressalta-se que a adoção das medidas indicadas é de responsabilidade do responsável pela execução e gestão das atividades, devendo ser implementadas dentro de prazos compatíveis com o nível de risco identificado, bem como mantido acompanhamento periódico para verificação da efetividade das correções realizadas.", size: 22 })],
            alignment: AlignmentType.JUSTIFIED,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: `São José/SC, ${format(parseISO(report.inspection_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`, size: 22 })],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          ...(() => {
            const primaryResp = settings.primary_resp === 'resp2' ? 'resp2' : 'resp1';
            const sigData = primaryResp === 'resp1' ? sig1Img : sig2Img;
            const nameData = primaryResp === 'resp1' ? settings.resp1_name : settings.resp2_name;
            const titleData = primaryResp === 'resp1' ? settings.resp1_title : settings.resp2_title;
            const regNameData = primaryResp === 'resp1' ? settings.resp1_reg_name : settings.resp2_reg_name;
            const regNumData = primaryResp === 'resp1' ? settings.resp1_reg_num : settings.resp2_reg_num;

            if (!sigData) return [];

            return [
              new Paragraph({
                children: [new ImageRun({ data: sigData, transformation: { width: 150, height: 50 } } as any)],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [new TextRun({ text: "_______________________________________________________", size: 22 })],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [new TextRun({ text: titleData || '', bold: true, size: 22 })],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [new TextRun({ text: nameData || '', size: 22 })],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [new TextRun({ text: `${regNameData} ${regNumData}`, size: 22 })],
                alignment: AlignmentType.CENTER,
              }),
            ];
          })(),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `RTI_${construction.name.replace(/\s/g, '_')}_${report.inspection_date}.docx`);
  };

  if (!report) return <div className="p-12 text-center">Carregando...</div>;

  return (
    <div className="pb-24 bg-slate-50 min-h-screen">
      <Header title="Detalhes do Relatório" showBack onBack={onBack} />
      <div className="p-6 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{construction?.name}</h2>
              <p className="text-xs font-bold text-brand-teal mb-1">
                Nº {construction?.contract_number}.{(report.sequence_number || 1).toString().padStart(2, '0')}
              </p>
              <p className="text-sm text-slate-500">{format(parseISO(report.inspection_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={cn(
                "text-[10px] px-2 py-1 font-bold rounded-full uppercase",
                report.status === 'finalizado' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
              )}>
                {report.status.replace('_', ' ')}
              </span>
              <button 
                onClick={() => onEdit(report)}
                className="text-[10px] font-bold text-brand-teal flex items-center gap-1 hover:underline"
              >
                <Settings size={12} /> EDITAR
              </button>
              <button 
                onClick={handleDelete}
                className="text-[10px] font-bold text-rose-500 flex items-center gap-1 hover:underline"
              >
                <Trash2 size={12} /> EXCLUIR
              </button>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Observações Técnicas</h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{report.technical_observations}</p>
          </div>
        </div>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase">Fotos ({report.photos?.length})</h3>
          <div className="grid grid-cols-1 gap-4">
            {report.photos?.map((photo, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <img src={photo.image_url} className="w-full h-48 object-cover" />
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-600 italic">"{photo.caption}"</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {report.status === 'finalizado' && (
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={generatePDF}
              className="w-full py-4 bg-brand-teal text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              <Download size={20} /> EXPORTAR PDF
            </button>
            <button 
              onClick={generateDOCX}
              className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              <FileText size={20} /> EXPORTAR DOCX
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={showDeleteConfirm}
        title="Excluir Relatório"
        message="Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

const CreateObra = ({ onCancel, onSuccess, initialData, showToast }: { onCancel: () => void, onSuccess: () => void, initialData?: Construction, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const { register, handleSubmit, setValue, watch } = useForm<Partial<Construction>>({
    defaultValues: initialData || {}
  });
  const photo = watch('photo');

  const onSubmit = async (data: any) => {
    const url = initialData ? `/api/constructions/${initialData.id}` : '/api/constructions';
    const method = initialData ? 'PUT' : 'POST';
    
    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(data),
      });
      
      if (res.ok) {
        showToast(initialData ? 'OBRA ATUALIZADA COM SUCESSO!' : 'OBRA CADASTRADA COM SUCESSO!');
        onSuccess();
      } else {
        const err = await res.json();
        showToast(`Erro: ${err.error || 'Falha ao salvar'}`, 'error');
      }
    } catch (error) {
      showToast('Erro de conexão com o servidor', 'error');
    }
  };

  const handlePhoto = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re: any) => setValue('photo', re.target.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-[60] overflow-y-auto pb-24">
      <Header title="Nova Obra" showBack onBack={onCancel} />
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
        <div 
          onClick={() => document.getElementById('obra-photo')?.click()}
          className="w-full h-40 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 cursor-pointer overflow-hidden"
        >
          {photo ? <img src={photo} className="w-full h-full object-cover" /> : (
            <>
              <Camera size={32} />
              <span className="text-sm font-medium">Foto da Obra</span>
            </>
          )}
          <input id="obra-photo" type="file" className="hidden" onChange={handlePhoto} />
        </div>

        <input {...register('name')} placeholder="Nome da Obra" className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
        <input {...register('address')} placeholder="Endereço Completo" className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
        <input {...register('contractor')} placeholder="Contratante / Cliente" className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
        <input {...register('contract_number')} placeholder="Número do Contrato (ex: 26/126)" className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
        <input {...register('responsible')} placeholder="Engenheiro Responsável" className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Início</label>
            <input type="date" {...register('start_date')} className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Previsão Término</label>
            <input type="date" {...register('end_date')} className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
          </div>
        </div>

        <button type="submit" className="w-full py-4 bg-brand-blue text-white rounded-xl font-bold mt-4">
          {initialData ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR OBRA'}
        </button>
      </form>
    </div>
  );
};

const CreateUser = ({ onCancel, onSuccess, showToast }: { onCancel: () => void, onSuccess: () => void, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const { register, handleSubmit } = useForm();

  const onSubmit = async (data: any) => {
    const res = await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (res.ok) {
      showToast('USUÁRIO CADASTRADO COM SUCESSO!');
      onSuccess();
    } else {
      const err = await res.json();
      showToast(`Erro: ${err.error}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-[60] overflow-y-auto pb-24">
      <Header title="Novo Usuário" showBack onBack={onCancel} />
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome Completo</label>
          <input {...register('name')} placeholder="Nome" className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
          <input {...register('email')} type="email" placeholder="email@protefor.com" className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha</label>
          <input {...register('password')} type="password" placeholder="••••••••" className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Cargo / Função</label>
          <select {...register('role')} className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm" required>
            <option value="tecnico">Técnico de Campo</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <button type="submit" className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold mt-4 shadow-md">
          CADASTRAR USUÁRIO
        </button>
      </form>
    </div>
  );
};

const AnalysisScreen = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/analytics')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-12 text-center text-slate-400">Carregando indicadores...</div>;
  if (!data) return <div className="p-12 text-center text-slate-400">Erro ao carregar indicadores.</div>;

  const COLORS = ['#0D4E5E', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="pb-24">
      <Header title="Análise" subtitle="Indicadores de Performance" />
      <div className="p-6 space-y-8">
        
        {/* Reports by Month */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={18} className="text-brand-teal" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Relatórios por Mês</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.reportsByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => {
                    const [year, month] = val.split('-');
                    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                    return months[parseInt(month) - 1];
                  }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" name="Relatórios" fill="#0D4E5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Reports by Construction */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Relatórios por Obra</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.reportsByConstruction}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="construction"
                >
                  {data.reportsByConstruction.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Suggestion: Status Distribution */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Status dos Relatórios</h2>
          <div className="space-y-4">
            {data.statusDistribution.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    item.status === 'finalizado' ? "bg-emerald-500" : "bg-amber-500"
                  )} />
                  <span className="text-sm font-medium text-slate-600 capitalize">{item.status.replace('_', ' ')}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [currentFlow, setCurrentFlow] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editingObra, setEditingObra] = useState<Construction | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    apiFetch('/api/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not logged in');
      })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsAuthReady(true));
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    setUser(null);
    setActiveTab('dashboard');
    showToast('SESSÃO ENCERRADA');
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative">
        <LoginScreen onLogin={setUser} showToast={showToast} />
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className={cn(
                "fixed top-10 left-1/2 z-[200] px-8 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm whitespace-nowrap flex items-center gap-2",
                toast.type === 'success' ? "bg-emerald-600" : "bg-rose-600"
              )}
            >
              {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const handleTabChange = (tab: string) => {
    if (tab === 'plus') {
      setShowPlusMenu(true);
    } else {
      setActiveTab(tab);
      setSelectedReportId(null);
      setCurrentFlow(null);
      setEditingReport(null);
      setEditingObra(null);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative">
      <AnimatePresence mode="wait">
        {selectedReportId && !editingReport ? (
          <motion.div key="detail" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }}>
            <ReportDetail 
              reportId={selectedReportId} 
              onBack={() => setSelectedReportId(null)} 
              onEdit={(report) => setEditingReport(report)}
              showToast={showToast}
            />
          </motion.div>
        ) : editingReport ? (
          <CreateReportFlow 
            initialData={editingReport}
            onCancel={() => setEditingReport(null)} 
            onSuccess={() => { setEditingReport(null); setSelectedReportId(null); setActiveTab('dashboard'); }} 
            showToast={showToast}
          />
        ) : editingObra ? (
          <CreateObra 
            initialData={editingObra}
            onCancel={() => setEditingObra(null)} 
            onSuccess={() => { setEditingObra(null); setActiveTab('obras'); }} 
            showToast={showToast}
          />
        ) : currentFlow === 'new_report' ? (
          <CreateReportFlow onCancel={() => setCurrentFlow(null)} onSuccess={() => { setCurrentFlow(null); setActiveTab('dashboard'); }} showToast={showToast} />
        ) : currentFlow === 'new_obra' ? (
          <CreateObra onCancel={() => setCurrentFlow(null)} onSuccess={() => { setCurrentFlow(null); setActiveTab('obras'); }} showToast={showToast} />
        ) : currentFlow === 'new_user' ? (
          <CreateUser onCancel={() => setCurrentFlow(null)} onSuccess={() => { setCurrentFlow(null); setActiveTab('dashboard'); }} showToast={showToast} />
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard onTabChange={handleTabChange} onSelectReport={(id) => setSelectedReportId(id)} />}
            {activeTab === 'obras' && <ObrasList onEdit={(obra) => setEditingObra(obra)} showToast={showToast} />}
            {activeTab === 'relatorios' && <ReportsList onSelect={(r) => setSelectedReportId(r.id)} showToast={showToast} />}
            {activeTab === 'analise' && <AnalysisScreen />}
            {activeTab === 'settings' && <SettingsScreen showToast={showToast} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Button (Top Right) */}
      {!selectedReportId && !currentFlow && (
        <div className="fixed top-8 right-6 z-50 flex gap-2">
          <button 
            onClick={handleLogout}
            className="p-2 bg-white rounded-full shadow-sm border border-slate-100 text-rose-500"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className="p-2 bg-white rounded-full shadow-sm border border-slate-100 text-slate-500"
            title="Configurações"
          >
            <Settings size={20} />
          </button>
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={cn(
              "fixed top-10 left-1/2 z-[200] px-8 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm whitespace-nowrap flex items-center gap-2",
              toast.type === 'success' ? "bg-emerald-600" : "bg-rose-600"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Plus Menu Modal */}
      <AnimatePresence>
        {showPlusMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowPlusMenu(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70]"
            />
            <motion.div 
              initial={{ y: 300 }} 
              animate={{ y: 0 }} 
              exit={{ y: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-8 z-[80] safe-bottom"
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-8" />
              <div className="space-y-4">
                <button 
                  onClick={() => { setCurrentFlow('new_report'); setShowPlusMenu(false); }}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl text-left"
                >
                  <div className="w-12 h-12 bg-brand-blue text-white rounded-xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Novo Relatório</p>
                    <p className="text-xs text-slate-500">Registrar inspeção em campo</p>
                  </div>
                </button>
                <button 
                  onClick={() => { setCurrentFlow('new_obra'); setShowPlusMenu(false); }}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl text-left"
                >
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                    <HardHat size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Nova Obra</p>
                    <p className="text-xs text-slate-500">Cadastrar novo canteiro</p>
                  </div>
                </button>
                <button 
                  onClick={() => { setCurrentFlow('new_user'); setShowPlusMenu(false); }}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl text-left"
                >
                  <div className="w-12 h-12 bg-amber-500 text-white rounded-xl flex items-center justify-center">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Novo Usuário</p>
                    <p className="text-xs text-slate-500">Adicionar técnico à equipe</p>
                  </div>
                </button>
                <button 
                  onClick={() => setShowPlusMenu(false)}
                  className="w-full py-4 text-slate-400 font-bold text-sm"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
