/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  Upload, 
  BookOpen, 
  PlusCircle, 
  MessageCircle, 
  Flame, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Sparkles, 
  Send,
  X,
  FileText,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, timeAgo } from './lib/utils';
import { AppState, Deck, Card, QuizQuestion, Activity } from './types';
import { generateFlashcards, generateQuiz, getAIHint, getAI, MODELS } from './lib/gemini';

const STORAGE_KEY = 'study_with_coco_v4';

const DEFAULT_STATE: AppState = {
  decks: [
    {
      id: 'd1',
      name: 'Biology Basics',
      icon: '🧬',
      desc: 'Cell biology fundamentals',
      cards: [
        { id: 'c1', front: 'What is a cell?', back: 'Basic structural and functional unit of all living organisms' },
        { id: 'c2', front: 'What is mitosis?', back: 'Cell division producing two identical daughter cells' },
        { id: 'c3', front: 'What is ATP?', back: 'Adenosine triphosphate — the energy currency of the cell' },
        { id: 'c4', front: 'What is DNA?', back: 'Deoxyribonucleic acid — carries genetic instructions' }
      ],
      studied: 0,
      correct: 0,
      lastStudied: null
    }
  ],
  activity: [],
  stats: {
    totalStudied: 0,
    totalCorrect: 0,
    streak: 0,
    lastStudyDate: null
  }
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_STATE;
  });

  const [activePage, setActivePage] = useState('home');
  const [studyDeckId, setStudyDeckId] = useState<string | null>(null);
  const [editDeckId, setEditDeckId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  // Save state whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const logActivity = (text: string) => {
    setState(prev => ({
      ...prev,
      activity: [{ text, time: Date.now() }, ...prev.activity].slice(0, 50)
    }));
  };

  const updateStreak = () => {
    const today = new Date().toDateString();
    const last = state.stats.lastStudyDate;
    if (last === today) return;

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    setState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        streak: last === yesterday ? prev.stats.streak + 1 : 1,
        lastStudyDate: today
      }
    }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-cream/95 backdrop-blur-md border-b border-rose-100 px-4 md:px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-2 font-display text-xl font-bold text-pink-500 cursor-pointer" onClick={() => setActivePage('home')}>
          🌸 <span>Study with Coco</span>
        </div>
        
        <div className="hidden md:flex gap-1">
          <NavTab active={activePage === 'home'} onClick={() => setActivePage('home')} icon={<Home size={16} />} label="Home" />
          <NavTab active={activePage === 'upload'} onClick={() => setActivePage('upload')} icon={<Upload size={16} />} label="Upload" />
          <NavTab active={activePage === 'study'} onClick={() => setActivePage('study')} icon={<BookOpen size={16} />} label="Study" />
          <NavTab active={activePage === 'create'} onClick={() => setActivePage('create')} icon={<PlusCircle size={16} />} label="Create" />
          <NavTab active={activePage === 'ai'} onClick={() => setActivePage('ai')} icon={<Sparkles size={16} />} label="AI Tutor" />
        </div>

        <div className="flex items-center gap-2 bg-blush rounded-full px-4 py-1.5 text-sm font-semibold text-pink-600">
          <Flame size={16} className="text-pink-500" />
          <span>{state.stats.streak} day streak</span>
        </div>
      </nav>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-rose-100 flex justify-around py-2 z-50">
        <MobileNavTab active={activePage === 'home'} onClick={() => setActivePage('home')} icon={<Home size={20} />} />
        <MobileNavTab active={activePage === 'upload'} onClick={() => setActivePage('upload')} icon={<Upload size={20} />} />
        <MobileNavTab active={activePage === 'study'} onClick={() => setActivePage('study')} icon={<BookOpen size={20} />} />
        <MobileNavTab active={activePage === 'create'} onClick={() => setActivePage('create')} icon={<PlusCircle size={20} />} />
        <MobileNavTab active={activePage === 'ai'} onClick={() => setActivePage('ai')} icon={<Sparkles size={20} />} />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
        <AnimatePresence mode="wait">
          {activePage === 'home' && (
            <HomePage 
              state={state} 
              setState={setState} 
              onStudy={(id) => { setActivePage('study-session'); setStudyDeckId(id); }}
              onEdit={(id) => { setEditDeckId(id); setActivePage('create'); }}
            />
          )}
          {activePage === 'upload' && (
            <UploadPage 
              onDeckCreated={(deck) => {
                setState(prev => ({ ...prev, decks: [...prev.decks, deck] }));
                logActivity(`Generated deck "${deck.name}" from file`);
                setActivePage('study');
                showToast(`Deck "${deck.name}" created! ✨`);
              }}
              setIsProcessing={setIsProcessing}
              setProcessingStep={setProcessingStep}
            />
          )}
          {activePage === 'study' && (
            <StudyPage 
              decks={state.decks} 
              onStartStudy={(id) => { setStudyDeckId(id); setActivePage('study-session'); }} 
            />
          )}
          {activePage === 'study-session' && studyDeckId && (
            <StudySession 
              deck={state.decks.find(d => d.id === studyDeckId)!}
              onFinish={(results) => {
                setState(prev => {
                  const newDecks = prev.decks.map(d => {
                    if (d.id === studyDeckId) {
                      return {
                        ...d,
                        studied: (d.studied || 0) + results.total,
                        correct: (d.correct || 0) + results.correct,
                        lastStudied: Date.now()
                      };
                    }
                    return d;
                  });
                  return {
                    ...prev,
                    decks: newDecks,
                    stats: {
                      ...prev.stats,
                      totalStudied: prev.stats.totalStudied + results.total,
                      totalCorrect: prev.stats.totalCorrect + results.correct
                    }
                  };
                });
                updateStreak();
                logActivity(`Studied "${state.decks.find(d => d.id === studyDeckId)?.name}"`);
                setActivePage('study');
              }}
              onExit={() => setActivePage('study')}
            />
          )}
          {activePage === 'create' && (
            <CreatePage 
              editDeck={editDeckId ? state.decks.find(d => d.id === editDeckId) : undefined}
              onSave={(deck) => {
                setState(prev => {
                  const exists = prev.decks.find(d => d.id === deck.id);
                  if (exists) {
                    return { ...prev, decks: prev.decks.map(d => d.id === deck.id ? deck : d) };
                  }
                  return { ...prev, decks: [...prev.decks, deck] };
                });
                logActivity(editDeckId ? `Updated deck "${deck.name}"` : `Created deck "${deck.name}"`);
                setEditDeckId(null);
                setActivePage('home');
                showToast(editDeckId ? 'Deck updated! ✅' : 'Deck created! 🎉');
              }}
              onCancel={() => { setEditDeckId(null); setActivePage('home'); }}
            />
          )}
          {activePage === 'ai' && (
            <AITutorPage decks={state.decks} />
          )}
        </AnimatePresence>
      </main>

      {/* Overlays */}
      {isProcessing && (
        <div className="fixed inset-0 bg-text-dark/60 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl"
          >
            <div className="w-14 h-14 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin mx-auto mb-6" />
            <h3 className="font-display text-xl font-bold mb-2">✨ AI is working...</h3>
            <p className="text-text-mid text-sm mb-4">Reading your file and generating content</p>
            <div className="text-pink-500 font-semibold text-sm">{processingStep}</div>
          </motion.div>
        </div>
      )}

      {toast && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-20 md:bottom-8 right-4 md:right-8 bg-text-dark text-white px-6 py-3 rounded-xl shadow-lg z-[100] text-sm font-medium"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

// --- Navigation Helpers ---

function NavTab({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
        active ? "bg-pink-500 text-white shadow-md" : "text-text-mid hover:bg-pink-50 hover:text-pink-500"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileNavTab({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-2xl transition-all",
        active ? "text-pink-500 bg-pink-50" : "text-text-light"
      )}
    >
      {icon}
    </button>
  );
}

// --- Home Page ---

function HomePage({ state, setState, onStudy, onEdit }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>>, onStudy: (id: string) => void, onEdit: (id: string) => void }) {
  const accuracy = state.stats.totalStudied > 0 ? Math.round((state.stats.totalCorrect / state.stats.totalStudied) * 100) : null;

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteDeck = (id: string) => {
    setState(prev => ({
      ...prev,
      decks: prev.decks.filter(d => d.id !== id),
      activity: [{ text: `Deleted deck "${prev.decks.find(d => d.id === id)?.name}"`, time: Date.now() }, ...prev.activity].slice(0, 50)
    }));
    setDeleteId(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="text-4xl">🗑️</div>
              <h3 className="font-display text-2xl font-bold text-text-dark">Delete Deck?</h3>
              <p className="text-text-mid">This will permanently remove your deck and all its cards. Are you sure? 🌸</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteId(null)}
                  className="flex-1 bg-rose-50 text-rose-600 font-bold py-3 rounded-xl hover:bg-rose-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => deleteDeck(deleteId)}
                  className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="text-center py-8">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-text-dark mb-2">
          Hello, <span className="text-pink-500 italic">Coco</span>! 🌸
        </h1>
        <p className="text-text-mid text-lg">Ready to make studying feel like self-care?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard value={state.stats.totalStudied} label="Cards Studied" />
        <StatCard value={state.decks.length} label="Active Decks" />
        <StatCard value={accuracy !== null ? `${accuracy}%` : '—'} label="Accuracy" />
      </div>

      <section>
        <h2 className="font-display text-2xl font-bold text-text-dark mb-6 flex items-center gap-2">
          <BookOpen className="text-pink-500" /> My Decks
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.decks.map(deck => (
            <DeckCard 
              key={deck.id} 
              deck={deck} 
              onStudy={() => onStudy(deck.id)} 
              onEdit={() => onEdit(deck.id)}
              onDelete={() => setDeleteId(deck.id)}
            />
          ))}
          <button 
            onClick={() => onEdit('')}
            className="bg-pink-50 border-2 border-dashed border-pink-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 hover:bg-pink-100 hover:border-pink-300 transition-all group min-h-[200px]"
          >
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-pink-500 shadow-sm group-hover:scale-110 transition-transform">
              <PlusCircle size={24} />
            </div>
            <div className="text-center">
              <div className="font-bold text-pink-600">New Deck</div>
              <div className="text-xs text-pink-400">or upload a file</div>
            </div>
          </button>
        </div>
      </section>

      <section className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm">
        <h2 className="font-display text-xl font-bold text-text-dark mb-4 flex items-center gap-2">
          <RotateCcw size={20} className="text-pink-500" /> Recent Activity
        </h2>
        <div className="space-y-3">
          {state.activity.length > 0 ? (
            state.activity.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-pink-300" />
                <span className="text-text-mid flex-1">{a.text}</span>
                <span className="text-text-light text-xs">{timeAgo(a.time)}</span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-text-light italic">No activity yet — start studying! 🌱</div>
          )}
        </div>
      </section>
    </motion.div>
  );
}

function StatCard({ value, label }: { value: string | number, label: string }) {
  return (
    <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm text-center hover:translate-y-[-2px] transition-transform">
      <div className="font-display text-3xl font-bold text-pink-500">{value}</div>
      <div className="text-xs font-semibold text-text-light uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function DeckCard({ deck, onStudy, onEdit, onDelete }: { deck: Deck, onStudy: () => void, onEdit: () => void, onDelete: () => void }) {
  const progress = deck.cards.length > 0 ? Math.min(100, Math.round(((deck.studied || 0) / deck.cards.length) * 100)) : 0;

  return (
    <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-300 to-pink-500" />
      
      <div className="text-3xl mb-3">{deck.icon || '📚'}</div>
      <h3 className="font-bold text-text-dark mb-1">{deck.name}</h3>
      <div className="text-xs text-text-light mb-4">
        {deck.cards.length} cards {deck.fromFile && '· 📄 From file'}
      </div>
      
      <div className="space-y-1 mb-6">
        <div className="flex justify-between text-[10px] font-bold text-text-light uppercase">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-rose-50 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-pink-300 to-pink-500"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onStudy} className="flex-1 bg-pink-500 text-white text-xs font-bold py-2 rounded-xl hover:bg-pink-600 transition-colors">Study</button>
        <button onClick={onEdit} className="p-2 bg-blush text-pink-600 rounded-xl hover:bg-pink-100 transition-colors"><Edit2 size={16} /></button>
        <button onClick={onDelete} className="p-2 bg-rose-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

// --- Upload Page ---

function UploadPage({ onDeckCreated, setIsProcessing, setProcessingStep }: { onDeckCreated: (deck: Deck) => void, setIsProcessing: (v: boolean) => void, setProcessingStep: (v: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [genType, setGenType] = useState<'fc' | 'qz'>('fc');
  const [deckName, setDeckName] = useState('');
  const [itemCount, setItemCount] = useState(12);
  const [focus, setFocus] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setDeckName(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      // PDF handling would go here, for now just text
      const text = await f.text();
      setFileContent(text);
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFileContent(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      const text = await f.text();
      setFileContent(text);
    }
  };

  const handleGenerate = async () => {
    if (!fileContent) return;
    setIsProcessing(true);
    setProcessingStep('Analyzing content...');
    
    try {
      if (genType === 'fc') {
        setProcessingStep('Generating flashcards...');
        const cards = await generateFlashcards(fileContent, itemCount, focus);
        const deck: Deck = {
          id: 'dk_' + Date.now(),
          name: deckName || 'New Deck',
          icon: '📄',
          desc: `Generated from ${file?.name}`,
          cards: cards.map((c: any) => ({ ...c, id: 'c_' + Math.random().toString(36).slice(2) })),
          studied: 0,
          correct: 0,
          lastStudied: null,
          fromFile: file?.name
        };
        onDeckCreated(deck);
      } else {
        setProcessingStep('Building quiz questions...');
        // Quiz logic would be similar but maybe a different view
        // For now, let's just do flashcards as the primary feature
        const quizQuestions = await generateQuiz(fileContent, itemCount, focus);
        const deck: Deck = {
          id: 'dk_' + Date.now(),
          name: deckName || 'Quiz Deck',
          icon: '🧠',
          desc: `Quiz generated from ${file?.name}`,
          cards: quizQuestions.map((q: any) => ({ 
            id: 'c_' + Math.random().toString(36).slice(2),
            front: q.question,
            back: `Correct Answer: ${q.options[q.correct]}\n\nExplanation: ${q.explanation}`,
            quizOptions: q.options,
            quizCorrect: q.correct,
            quizExplanation: q.explanation
          })),
          studied: 0,
          correct: 0,
          lastStudied: null,
          fromFile: file?.name
        };
        onDeckCreated(deck);
      }
    } catch (error) {
      console.error(error);
      alert('Generation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      <div className="bg-white border border-rose-100 rounded-3xl p-8 shadow-sm">
        <h2 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
          <FileText className="text-pink-500" /> Upload & Generate
        </h2>
        <p className="text-text-mid mb-8">Drop your notes or PDFs — AI will instantly create a study deck for you!</p>
        
        <label className="block">
          <div className={cn(
            "border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all",
            file ? "bg-pink-50 border-pink-500" : "bg-cream border-rose-200 hover:border-pink-300 hover:bg-pink-50"
          )}>
            <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.txt,.md,.png,.jpg,.jpeg" />
            <div className="text-4xl mb-4">{file ? '✅' : '📂'}</div>
            <div className="font-bold text-text-dark mb-1">{file ? file.name : 'Drop your file here'}</div>
            <div className="text-sm text-text-light">{file ? 'File ready!' : 'or click to browse your device'}</div>
          </div>
        </label>
      </div>

      {file && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => setGenType('fc')}
              className={cn(
                "p-6 rounded-3xl border-2 text-center transition-all",
                genType === 'fc' ? "border-pink-500 bg-blush" : "border-rose-100 bg-white hover:border-pink-200"
              )}
            >
              <div className="text-3xl mb-2">🃏</div>
              <div className="font-bold text-text-dark">Flashcard Deck</div>
              <div className="text-xs text-text-light">Flip cards to study Q&A</div>
            </button>
            <button 
              onClick={() => setGenType('qz')}
              className={cn(
                "p-6 rounded-3xl border-2 text-center transition-all",
                genType === 'qz' ? "border-pink-500 bg-blush" : "border-rose-100 bg-white hover:border-pink-200"
              )}
            >
              <div className="text-3xl mb-2">🧠</div>
              <div className="font-bold text-text-dark">Quiz Deck</div>
              <div className="text-xs text-text-light">Multiple choice questions</div>
            </button>
          </div>

          <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-mid uppercase">Deck Name</label>
                <input 
                  type="text" 
                  value={deckName} 
                  onChange={e => setDeckName(e.target.value)}
                  className="w-full bg-cream border border-rose-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-mid uppercase">Number of Items</label>
                <select 
                  value={itemCount} 
                  onChange={e => setItemCount(Number(e.target.value))}
                  className="w-full bg-cream border border-rose-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-400"
                >
                  <option value={8}>8 items</option>
                  <option value={12}>12 items</option>
                  <option value={16}>16 items</option>
                  <option value={20}>20 items</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-mid uppercase">Focus Area (optional)</label>
              <input 
                type="text" 
                value={focus} 
                onChange={e => setFocus(e.target.value)}
                placeholder="e.g. definitions only, key dates..."
                className="w-full bg-cream border border-rose-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-400"
              />
            </div>
            <button 
              onClick={handleGenerate}
              className="w-full bg-pink-500 text-white font-bold py-4 rounded-2xl hover:bg-pink-600 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={20} /> Generate with AI
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// --- Study Page ---

function StudyPage({ decks, onStartStudy }: { decks: Deck[], onStartStudy: (id: string) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <h2 className="font-display text-3xl font-bold text-text-dark flex items-center gap-3">
        <BookOpen className="text-pink-500" /> Choose a Deck to Study
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {decks.map(deck => (
          <div key={deck.id} className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
            <div className="text-4xl mb-4">{deck.icon || '📚'}</div>
            <h3 className="font-bold text-text-dark text-lg mb-1">{deck.name}</h3>
            <div className="text-sm text-text-light mb-6">{deck.cards.length} cards</div>
            <button 
              onClick={() => onStartStudy(deck.id)}
              className="w-full bg-pink-500 text-white font-bold py-3 rounded-xl hover:bg-pink-600 transition-colors flex items-center justify-center gap-2"
            >
              Study Now <ChevronRight size={18} />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- Study Session ---

function StudySession({ deck, onFinish, onExit }: { deck: Deck, onFinish: (results: { total: number, correct: number }) => void, onExit: () => void }) {
  const [cards, setCards] = useState<Card[]>(() => [...deck.cards].sort(() => Math.random() - 0.5));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState({ total: 0, correct: 0 });
  const [isFinished, setIsFinished] = useState(false);
  const [aiHintText, setAiHintText] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const currentCard = cards[currentIndex];
  const progress = Math.round((currentIndex / cards.length) * 100);

  const handleRate = (correct: boolean) => {
    setResults(prev => ({ total: prev.total + 1, correct: prev.correct + (correct ? 1 : 0) }));
    if (currentIndex + 1 < cards.length) {
      // Flip back first
      setIsFlipped(false);
      setAiHintText(null);
      setSelectedOption(null);
      
      // Wait for the flip animation to hide the back before changing content
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 250);
    } else {
      setIsFinished(true);
    }
  };

  const handleOptionSelect = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    setIsFlipped(true);
    
    const isCorrect = idx === currentCard.quizCorrect;
    setResults(prev => ({ total: prev.total + 1, correct: prev.correct + (isCorrect ? 1 : 0) }));
  };

  const handleGetHint = async () => {
    setIsLoadingHint(true);
    try {
      const hint = await getAIHint(currentCard.front, currentCard.back);
      setAiHintText(hint || "Try to visualize the answer!");
    } catch (error) {
      setAiHintText("No hint available right now 🌸");
    } finally {
      setIsLoadingHint(false);
    }
  };

  if (isFinished) {
    const isPerfect = results.total > 0 && results.correct === results.total;
    
    return (
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md mx-auto text-center space-y-8 py-12"
      >
        <motion.div 
          animate={isPerfect ? { 
            scale: [1, 1.2, 1],
          } : {}}
          transition={{ repeat: isPerfect ? Infinity : 0, duration: 2 }}
          className="text-6xl"
        >
          {isPerfect ? '👑' : '🎉'}
        </motion.div>
        
        <div className="space-y-2">
          <h2 className="font-display text-4xl font-bold text-text-dark">
            {isPerfect ? "Perfect Score!" : "Session Complete!"}
          </h2>
          <p className="text-text-mid text-lg">
            {isPerfect 
              ? "OMG Coco! You're a genius! 🌸 100% correct! I'm so proud of you! 💖✨" 
              : "Amazing work, Coco! Keep it up 💖"}
          </p>
        </div>
        
        <div className="flex justify-center gap-4">
          <div className={cn(
            "px-6 py-3 rounded-2xl font-bold transition-all",
            isPerfect ? "bg-pink-500 text-white shadow-lg scale-110" : "bg-green-50 text-green-700"
          )}>
            ✅ {results.correct} Correct
          </div>
          <div className="bg-rose-50 text-rose-700 px-6 py-3 rounded-2xl font-bold flex items-center justify-center">
            🃏 {results.total} Total
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => onFinish(results)}
            className="w-full bg-pink-500 text-white font-bold py-4 rounded-2xl hover:bg-pink-600 transition-all"
          >
            Finish Session
          </button>
          <button 
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setIsFinished(false);
              setResults({ total: 0, correct: 0 });
              setCards([...deck.cards].sort(() => Math.random() - 0.5));
            }}
            className="w-full bg-blush text-pink-600 font-bold py-4 rounded-2xl hover:bg-pink-100 transition-all"
          >
            Study Again 🔁
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="bg-blush text-pink-600 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-pink-100 transition-colors">
          <ChevronLeft size={18} /> Exit
        </button>
        <h2 className="font-display text-xl font-bold text-text-dark">{deck.name}</h2>
        <div className="text-right">
          <div className="w-32 h-2 bg-rose-50 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] font-bold text-text-light mt-1">{currentIndex + 1} / {cards.length}</div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-8">
        <div 
          className={cn(
            "w-full h-80 group transition-all duration-300",
            !currentCard.quizOptions && "cursor-pointer"
          )}
          onClick={() => !currentCard.quizOptions && setIsFlipped(!isFlipped)}
        >
          <div className="relative w-full h-full">
            <AnimatePresence initial={false} mode="wait">
              {!isFlipped ? (
                <motion.div 
                  key="front"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-white border border-rose-100 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-xl"
                >
                  <div className="text-[10px] font-bold text-text-light uppercase tracking-widest mb-4">Question</div>
                  <div className="text-lg md:text-xl font-medium text-text-dark leading-relaxed whitespace-pre-wrap">{currentCard.front}</div>
                  {!currentCard.quizOptions && (
                    <div className="mt-auto text-xs text-text-light italic">Tap to reveal answer</div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="back"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-gradient-to-br from-pink-400 to-pink-600 text-white border border-pink-500 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-xl"
                >
                  <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-4">Answer</div>
                  <div className="text-lg md:text-xl font-medium leading-relaxed whitespace-pre-wrap">{currentCard.back}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {isFlipped ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-4">
            {currentCard.quizOptions ? (
              <div className="space-y-3">
                <div className="text-center text-xs font-bold text-text-light uppercase tracking-wider mb-2">
                  {selectedOption === currentCard.quizCorrect ? "✅ Correct!" : "❌ Incorrect"}
                </div>
                <button 
                  onClick={() => handleRate(selectedOption === currentCard.quizCorrect)}
                  className="w-full bg-pink-500 text-white font-bold py-4 rounded-2xl hover:bg-pink-600 transition-all shadow-lg"
                >
                  Next Question ➡️
                </button>
              </div>
            ) : (
              <>
                <div className="text-center text-xs font-bold text-text-light uppercase tracking-wider">How well did you know it?</div>
                <div className="flex gap-3">
                  <button onClick={() => handleRate(false)} className="flex-1 bg-rose-50 text-rose-600 font-bold py-4 rounded-2xl hover:bg-rose-100 transition-all flex items-center justify-center gap-2">
                    <XCircle size={20} /> Didn't Know
                  </button>
                  <button onClick={() => handleRate(true)} className="flex-1 bg-green-50 text-green-600 font-bold py-4 rounded-2xl hover:bg-green-100 transition-all flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} /> Got It!
                  </button>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <div className="w-full flex flex-col items-center gap-4">
            {currentCard.quizOptions ? (
              <div className="grid grid-cols-1 gap-3 w-full">
                {currentCard.quizOptions.map((opt, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOptionSelect(idx)}
                    className="w-full bg-white border border-rose-100 text-text-dark font-medium py-4 px-6 rounded-2xl hover:bg-pink-50 hover:border-pink-200 transition-all text-left flex items-center gap-4 shadow-sm hover:shadow-md"
                  >
                    <span className="w-8 h-8 rounded-full bg-blush text-pink-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <>
                <button 
                  onClick={() => setIsFlipped(true)}
                  className="w-full bg-pink-500 text-white font-bold py-4 rounded-2xl hover:bg-pink-600 transition-all shadow-lg"
                >
                  Reveal Answer ✨
                </button>
                
                {aiHintText ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-blush border border-pink-200 rounded-2xl p-4 w-full"
                  >
                    <div className="text-[10px] font-bold text-pink-600 uppercase mb-1">✨ AI Hint</div>
                    <div className="text-sm text-text-mid italic">{aiHintText}</div>
                  </motion.div>
                ) : (
                  <button 
                    onClick={handleGetHint}
                    disabled={isLoadingHint}
                    className="text-pink-600 text-sm font-bold flex items-center gap-2 hover:underline disabled:opacity-50"
                  >
                    {isLoadingHint ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Get AI Hint
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Create Page ---

function CreatePage({ editDeck, onSave, onCancel }: { editDeck?: Deck, onSave: (deck: Deck) => void, onCancel: () => void }) {
  const [name, setName] = useState(editDeck?.name || '');
  const [desc, setDesc] = useState(editDeck?.desc || '');
  const [icon, setIcon] = useState(editDeck?.icon || '📚');
  const [cards, setCards] = useState<Card[]>(editDeck?.cards || [{ id: '1', front: '', back: '' }, { id: '2', front: '', back: '' }]);
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const addCard = () => setCards(prev => [...prev, { id: Math.random().toString(36).slice(2), front: '', back: '' }]);
  const removeCard = (id: string) => setCards(prev => prev.filter(c => c.id !== id));
  const updateCard = (id: string, field: 'front' | 'back', value: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAiGenerate = async () => {
    if (!aiTopic) return;
    setIsGenerating(true);
    try {
      const generated = await generateFlashcards(`Topic: ${aiTopic}`, 8);
      setCards(prev => [
        ...prev.filter(c => c.front || c.back),
        ...generated.map((c: any) => ({ ...c, id: Math.random().toString(36).slice(2) }))
      ]);
      if (!name) setName(aiTopic);
      setAiTopic('');
    } catch (error) {
      alert('AI generation failed. Try again!');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const validCards = cards.filter(c => c.front.trim() && c.back.trim());
    if (!name.trim()) return alert('Please enter a deck name');
    if (validCards.length === 0) return alert('Please add at least one card');
    
    onSave({
      id: editDeck?.id || 'dk_' + Date.now(),
      name,
      desc,
      icon,
      cards: validCards,
      studied: editDeck?.studied || 0,
      correct: editDeck?.correct || 0,
      lastStudied: editDeck?.lastStudied || null
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8"
    >
      <div className="space-y-6">
        <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-display text-xl font-bold text-text-dark">📦 Deck Settings</h3>
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-mid uppercase">Deck Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full bg-cream border border-rose-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-mid uppercase">Description</label>
            <textarea 
              value={desc} 
              onChange={e => setDesc(e.target.value)}
              className="w-full bg-cream border border-rose-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-400 min-h-[80px] resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-mid uppercase">Icon</label>
            <div className="grid grid-cols-5 gap-2">
              {['📚','🧬','📐','🌍','💻','🎨','🎵','📖','🔬','⚡','🌸','🧪','📝','🏛️','🌿'].map(e => (
                <button 
                  key={e} 
                  onClick={() => setIcon(e)}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all",
                    icon === e ? "bg-pink-500 text-white shadow-md scale-110" : "bg-pink-50 hover:bg-pink-100"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSave} className="w-full bg-pink-500 text-white font-bold py-3 rounded-xl hover:bg-pink-600 transition-all">
            💾 Save Deck
          </button>
          <button onClick={onCancel} className="w-full bg-rose-50 text-rose-600 font-bold py-3 rounded-xl hover:bg-rose-100 transition-all">
            Cancel
          </button>
        </div>

        <div className="bg-blush border border-pink-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-display text-xl font-bold text-pink-600 flex items-center gap-2">
            <Sparkles size={20} /> AI Generate
          </h3>
          <p className="text-xs text-text-mid leading-relaxed">Type a topic and AI will create cards for you instantly!</p>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={aiTopic} 
              onChange={e => setAiTopic(e.target.value)}
              placeholder="e.g. Photosynthesis"
              className="flex-1 bg-white border border-pink-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-400"
            />
            <button 
              onClick={handleAiGenerate}
              disabled={isGenerating || !aiTopic}
              className="bg-pink-500 text-white p-2 rounded-xl hover:bg-pink-600 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-bold text-text-dark">🃏 Cards <span className="bg-blush text-pink-600 px-3 py-1 rounded-full text-xs ml-2">{cards.length}</span></h3>
          <span className="text-[10px] font-bold text-text-light uppercase tracking-widest">Front | Back</span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-2 max-h-[600px]">
          {cards.map((card, i) => (
            <div key={card.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-start bg-pink-50/50 p-3 rounded-2xl border border-rose-50">
              <textarea 
                value={card.front} 
                onChange={e => updateCard(card.id, 'front', e.target.value)}
                placeholder="Question"
                className="bg-white border border-rose-100 rounded-xl p-3 text-sm outline-none focus:border-pink-400 resize-none min-h-[60px]"
              />
              <textarea 
                value={card.back} 
                onChange={e => updateCard(card.id, 'back', e.target.value)}
                placeholder="Answer"
                className="bg-white border border-rose-100 rounded-xl p-3 text-sm outline-none focus:border-pink-400 resize-none min-h-[60px]"
              />
              <button 
                onClick={() => removeCard(card.id)}
                className="p-2 text-text-light hover:text-red-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={addCard}
          className="mt-6 w-full border-2 border-dashed border-pink-200 rounded-2xl py-4 text-pink-400 font-bold hover:bg-pink-50 hover:border-pink-300 transition-all"
        >
          + Add Card
        </button>
      </div>
    </motion.div>
  );
}

// --- AI Tutor Page ---

function AITutorPage({ decks }: { decks: Deck[] }) {
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([
    { role: 'ai', text: "Hi Coco! 🌸 I'm your AI study tutor. I can quiz you, explain concepts, or give memory tricks. What would you like to learn today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || input;
    if (!text.trim()) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsTyping(true);

    try {
      const ai = getAI();
      const selectedDeck = selectedDeckId ? decks.find(d => d.id === selectedDeckId) : null;
      
      let systemInstruction = "You are Coco, a warm, encouraging AI study tutor. Make studying fun! Use 💖 occasionally. Keep replies concise (2-4 paragraphs max).";
      if (selectedDeck) {
        systemInstruction += `\n\nStudent is studying deck "${selectedDeck.name}":\n${selectedDeck.cards.map(c => `Q: ${c.front} | A: ${c.back}`).join('\n')}\nHelp study these. Quiz one question at a time if asked.`;
      }

      const chat = ai.chats.create({
        model: MODELS.flash,
        config: { systemInstruction }
      });

      // Send history
      const history = messages.slice(-6).map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text
      }));
      
      // In a real app we'd use the chat history properly, but for simplicity:
      const response = await ai.models.generateContent({
        model: MODELS.flash,
        contents: [...history.map(h => h.content), text].join('\n'),
        config: { systemInstruction }
      });

      setMessages(prev => [...prev, { role: 'ai', text: response.text || "Sorry, I'm a bit sleepy. Can you repeat that? 🌸" }]);
    } catch (error: any) {
      const msg = error.message?.includes("GEMINI_API_KEY") 
        ? "🌸 Please ensure your GEMINI_API_KEY is configured."
        : "Oops, connection issue 💖 Try again!";
      setMessages(prev => [...prev, { role: 'ai', text: msg }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 h-[calc(100vh-160px)]"
    >
      <div className="hidden md:flex flex-col gap-4 overflow-y-auto pr-2">
        <div className="text-[10px] font-bold text-text-light uppercase tracking-widest">Study With</div>
        <button 
          onClick={() => setSelectedDeckId(null)}
          className={cn(
            "text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all border",
            selectedDeckId === null ? "bg-pink-500 text-white border-pink-500 shadow-md" : "bg-white border-rose-100 text-text-mid hover:bg-pink-50"
          )}
        >
          🌸 General Tutor
        </button>
        
        <div className="text-[10px] font-bold text-text-light uppercase tracking-widest mt-4">My Decks</div>
        {decks.map(deck => (
          <button 
            key={deck.id}
            onClick={() => setSelectedDeckId(deck.id)}
            className={cn(
              "text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all border truncate",
              selectedDeckId === deck.id ? "bg-pink-500 text-white border-pink-500 shadow-md" : "bg-white border-rose-100 text-text-mid hover:bg-pink-50"
            )}
          >
            {deck.icon} {deck.name}
          </button>
        ))}
      </div>

      <div className="bg-white border border-rose-100 rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-rose-50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-300 to-pink-500 flex items-center justify-center text-xl shadow-sm">🌸</div>
          <div>
            <div className="font-bold text-text-dark text-sm">Coco AI Tutor</div>
            <div className="text-[10px] text-text-light uppercase font-bold tracking-wider">
              {selectedDeckId ? decks.find(d => d.id === selectedDeckId)?.name : 'General Assistant'}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === 'user' ? "flex-row-reverse" : "")}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0",
                m.role === 'ai' ? "bg-pink-100 text-pink-600" : "bg-pink-500 text-white"
              )}>
                {m.role === 'ai' ? '🌸' : '👩'}
              </div>
              <div className={cn(
                "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                m.role === 'ai' ? "bg-blush text-text-dark rounded-tl-none" : "bg-pink-500 text-white rounded-tr-none shadow-sm"
              )}>
                {m.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm">🌸</div>
              <div className="bg-blush px-4 py-3 rounded-2xl rounded-tl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-rose-50 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['Quiz me', 'Simplify this', 'Memory trick', 'Study plan'].map(q => (
              <button 
                key={q} 
                onClick={() => handleSend(q)}
                className="whitespace-nowrap bg-pink-50 text-pink-600 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-pink-100 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything... 🌸"
              className="flex-1 bg-cream border border-rose-200 rounded-full px-6 py-3 text-sm outline-none focus:border-pink-400"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="w-12 h-12 bg-pink-500 text-white rounded-full flex items-center justify-center hover:bg-pink-600 transition-all disabled:opacity-50 shadow-md"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Global State Helpers ---
// Removed global variables
