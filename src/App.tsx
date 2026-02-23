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
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { cn } from './utils';
import { Construction, Report, CompanySettings, ReportPhoto, ReportChecklistItem } from './types';

// --- Components ---

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

// --- Screens ---

const Dashboard = ({ onTabChange }: { onTabChange: (tab: string) => void }) => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/stats').then(res => res.json()).then(setStats);
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
            <p className="text-2xl font-bold text-brand-lime">{stats?.totalReports || 0}</p>
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

        {/* Recent Activity Placeholder */}
        <section>
          <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Atividade Recente</h2>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                  <FileText size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Relatório Semanal #00{i}</p>
                  <p className="text-xs text-slate-500">Obra Residencial Alpha • Ontem</p>
                </div>
                <span className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-600 font-bold rounded-full">FINALIZADO</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const ObrasList = ({ onSelect }: { onSelect: (obra: Construction) => void }) => {
  const [obras, setObras] = useState<Construction[]>([]);

  useEffect(() => {
    fetch('/api/constructions').then(res => res.json()).then(setObras);
  }, []);

  return (
    <div className="pb-24">
      <Header title="Obras" subtitle="Gerenciamento de Canteiros" />
      <div className="p-6 space-y-4">
        {obras.map((obra) => (
          <motion.div 
            key={obra.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(obra)}
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
              <div className="absolute top-3 right-3">
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
    </div>
  );
};

const CreateReportFlow = ({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) => {
  const [step, setStep] = useState(1);
  const [obras, setObras] = useState<Construction[]>([]);
  const [selectedObra, setSelectedObra] = useState<Construction | null>(null);
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [observations, setObservations] = useState('');
  const [checklist, setChecklist] = useState<ReportChecklistItem[]>([]);
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [photoSourceMenuOpen, setPhotoSourceMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/constructions').then(res => res.json()).then(setObras);
    fetch('/api/settings').then(res => res.json()).then(settings => {
      if (settings.default_checklist) {
        try {
          const items = JSON.parse(settings.default_checklist);
          setChecklist(items.map((item: string) => ({ item_name: item, status: false, observation: '' })));
        } catch (e) {}
      }
    });
  }, []);

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
          setPhotos([...photos, { image_data: re.target.result, caption: '', order_index: photos.length }]);
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
      date: reportDate,
      technical_observations: observations,
      photos,
      checklist,
      status
    };

    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-[60] overflow-y-auto pb-24">
      <Header 
        title={step === 1 ? "Selecionar Obra" : step === 2 ? "Data e Fotos" : step === 3 ? "Observações" : "Checklist e Finalizar"} 
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
                    <div className="w-12 h-12 bg-brand-lime text-white rounded-full flex items-center justify-center">
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
                  selectedObra?.id === obra.id ? "border-brand-blue bg-blue-50" : "border-slate-200 bg-white"
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
                    <img src={photo.image_data} className="w-full h-48 object-cover" />
                    <div className="p-3">
                      <input 
                        placeholder="Legenda da foto (Obrigatório)"
                        value={photo.caption}
                        onChange={(e) => {
                          const newPhotos = [...photos];
                          newPhotos[idx].caption = e.target.value;
                          setPhotos(newPhotos);
                        }}
                        className="w-full text-sm p-2 bg-slate-50 rounded-lg border-none focus:ring-1 focus:ring-brand-blue"
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
              onClick={() => setStep(3)}
              disabled={photos.length === 0 || photos.some(p => !p.caption)}
              className="w-full py-4 bg-brand-teal text-white rounded-xl font-bold disabled:opacity-50"
            >
              PRÓXIMA ETAPA
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Observações Técnicas</label>
              <textarea 
                rows={8}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Descreva o andamento da obra, problemas encontrados e recomendações..."
                className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>
            <button 
              onClick={() => setStep(4)}
              className="w-full py-4 bg-brand-teal text-white rounded-xl font-bold"
            >
              PRÓXIMA ETAPA
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase">Checklist de Conformidade</label>
              {checklist.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{item.item_name}</span>
                    <input 
                      type="checkbox"
                      checked={item.status}
                      onChange={(e) => {
                        const newCheck = [...checklist];
                        newCheck[idx].status = e.target.checked;
                        setChecklist(newCheck);
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                    />
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
                className="py-4 bg-brand-orange text-white rounded-xl font-bold text-sm"
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

const SettingsScreen = () => {
  const [settings, setSettings] = useState<CompanySettings>({
    name: '', cnpj: '', logo: '', technical_responsible: '', email: '', phone: '', default_checklist: '[]'
  });
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      if (data.id) {
        setSettings(data);
        try {
          setChecklistItems(JSON.parse(data.default_checklist || '[]'));
        } catch (e) {}
      }
    });
  }, []);

  const handleSave = async () => {
    const payload = { ...settings, default_checklist: JSON.stringify(checklistItems) };
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert('Configurações salvas!');
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
      <Header title="Configurações" subtitle="Dados da Empresa e Padrões" />
      <div className="p-6 space-y-6">
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
              placeholder="Responsável Técnico" 
              value={settings.technical_responsible}
              onChange={e => setSettings({...settings, technical_responsible: e.target.value})}
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm"
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Checklist Padrão</h2>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input 
                placeholder="Novo item de checklist" 
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                className="flex-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
              />
              <button 
                onClick={() => { if(newItem) { setChecklistItems([...checklistItems, newItem]); setNewItem(''); } }}
                className="p-3 bg-brand-teal text-white rounded-xl"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-sm text-slate-700">{item}</span>
                  <button onClick={() => setChecklistItems(checklistItems.filter((_, i) => i !== idx))} className="text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <button 
          onClick={handleSave}
          className="w-full py-4 bg-brand-teal text-white rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <Save size={20} /> SALVAR CONFIGURAÇÕES
        </button>
      </div>
    </div>
  );
};

const ReportsList = ({ onSelect }: { onSelect: (report: Report) => void }) => {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    fetch('/api/reports').then(res => res.json()).then(setReports);
  }, []);

  return (
    <div className="pb-24">
      <Header title="Relatórios" subtitle="Histórico de Inspeções" />
      <div className="p-6 space-y-3">
        {reports.map(report => (
          <button 
            key={report.id}
            onClick={() => onSelect(report)}
            className="w-full text-left bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4"
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              report.status === 'finalizado' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
            )}>
              <FileText size={24} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-900">RTI_{report.construction_name?.substring(0, 5).toUpperCase()}_{report.date.replace(/-/g, '')}</p>
              <p className="text-xs text-slate-500">{report.construction_name} • {format(parseISO(report.date), 'dd/MM/yyyy')}</p>
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
        ))}
        {reports.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">Nenhum relatório encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ReportDetail = ({ reportId, onBack }: { reportId: number, onBack: () => void }) => {
  const [report, setReport] = useState<Report | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [construction, setConstruction] = useState<Construction | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const rRes = await fetch(`/api/reports/${reportId}`);
      const rData = await rRes.json();
      setReport(rData);

      const sRes = await fetch('/api/settings');
      const sData = await sRes.json();
      setSettings(sData);

      const cRes = await fetch('/api/constructions');
      const cData = await cRes.json();
      const obra = cData.find((o: Construction) => o.id === rData.construction_id);
      setConstruction(obra);
    };
    loadData();
  }, [reportId]);

  const generatePDF = () => {
    if (!report || !settings || !construction) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Capa
    if (settings.logo) {
      doc.addImage(settings.logo, 'PNG', pageWidth / 2 - 25, 40, 50, 50);
    }
    
    doc.setFontSize(22);
    doc.setTextColor(13, 78, 94);
    doc.text("RELATÓRIO TÉCNICO DE INSPEÇÃO", pageWidth / 2, 110, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`OBRA: ${construction.name}`, pageWidth / 2, 125, { align: 'center' });
    doc.text(`DATA: ${format(parseISO(report.date), 'dd/MM/yyyy')}`, pageWidth / 2, 135, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Emitido por: ${settings.name}`, pageWidth / 2, 250, { align: 'center' });
    doc.text(`Responsável: ${settings.technical_responsible}`, pageWidth / 2, 255, { align: 'center' });

    // Nova Página - Dados
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(13, 78, 94);
    doc.text("1. DADOS DA OBRA", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(0);
    const obraData = [
      ["Nome da Obra", construction.name],
      ["Endereço", construction.address],
      ["Contratante", construction.contractor],
      ["Contrato Nº", construction.contract_number],
      ["Responsável", construction.responsible]
    ];
    
    (doc as any).autoTable({
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

    // Fotos
    if (report.photos && report.photos.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(13, 78, 94);
      doc.text("3. EVIDÊNCIAS FOTOGRÁFICAS", 20, 20);
      
      let y = 30;
      report.photos.forEach((photo, i) => {
        if (y > 220) {
          doc.addPage();
          y = 20;
        }
        doc.addImage(photo.image_data, 'JPEG', 20, y, 170, 80);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Foto ${i + 1}: ${photo.caption}`, 20, y + 85);
        y += 100;
      });
    }

    // Checklist
    if (report.checklist && report.checklist.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(13, 78, 94);
      doc.text("4. CHECKLIST DE CONFORMIDADE", 20, 20);
      
      (doc as any).autoTable({
        startY: 25,
        head: [['Item', 'Status', 'Observação']],
        body: report.checklist.map(c => [c.item_name, c.status ? 'CONFORME' : 'NÃO CONFORME', c.observation]),
        theme: 'grid',
        headStyles: { fillColor: [13, 78, 94] }
      });
    }

    doc.save(`RTI_${construction.name.replace(/\s/g, '_')}_${report.date}.pdf`);
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
              <p className="text-sm text-slate-500">{format(parseISO(report.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            </div>
            <span className={cn(
              "text-[10px] px-2 py-1 font-bold rounded-full uppercase",
              report.status === 'finalizado' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
            )}>
              {report.status.replace('_', ' ')}
            </span>
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
                <img src={photo.image_data} className="w-full h-48 object-cover" />
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-600 italic">"{photo.caption}"</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {report.status === 'finalizado' && (
          <button 
            onClick={generatePDF}
            className="w-full py-4 bg-brand-orange text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
          >
            <Download size={20} /> EXPORTAR PDF PROFISSIONAL
          </button>
        )}
      </div>
    </div>
  );
};

const CreateObra = ({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) => {
  const { register, handleSubmit, setValue, watch } = useForm<Partial<Construction>>();
  const photo = watch('photo');

  const onSubmit = async (data: any) => {
    await fetch('/api/constructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    onSuccess();
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
          CADASTRAR OBRA
        </button>
      </form>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [currentFlow, setCurrentFlow] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const handleTabChange = (tab: string) => {
    if (tab === 'plus') {
      setShowPlusMenu(true);
    } else {
      setActiveTab(tab);
      setSelectedReportId(null);
      setCurrentFlow(null);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative">
      <AnimatePresence mode="wait">
        {selectedReportId ? (
          <motion.div key="detail" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }}>
            <ReportDetail reportId={selectedReportId} onBack={() => setSelectedReportId(null)} />
          </motion.div>
        ) : currentFlow === 'new_report' ? (
          <CreateReportFlow onCancel={() => setCurrentFlow(null)} onSuccess={() => { setCurrentFlow(null); setActiveTab('relatorios'); }} />
        ) : currentFlow === 'new_obra' ? (
          <CreateObra onCancel={() => setCurrentFlow(null)} onSuccess={() => { setCurrentFlow(null); setActiveTab('obras'); }} />
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard onTabChange={handleTabChange} />}
            {activeTab === 'obras' && <ObrasList onSelect={() => {}} />}
            {activeTab === 'relatorios' && <ReportsList onSelect={(r) => setSelectedReportId(r.id)} />}
            {activeTab === 'analise' && (
              <div className="p-6">
                <Header title="Análise" subtitle="Indicadores de Performance" />
                <div className="mt-12 text-center text-slate-400">
                  <BarChart3 size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium">Módulo de análise em desenvolvimento.</p>
                </div>
              </div>
            )}
            {activeTab === 'settings' && <SettingsScreen />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Button (Top Right) */}
      {!selectedReportId && !currentFlow && (
        <button 
          onClick={() => setActiveTab('settings')}
          className="fixed top-8 right-6 z-50 p-2 bg-white rounded-full shadow-sm border border-slate-100 text-slate-500"
        >
          <Settings size={20} />
        </button>
      )}

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
                  onClick={() => { alert('Funcionalidade de convite de usuário em breve.'); setShowPlusMenu(false); }}
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
