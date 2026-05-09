import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, User, ShieldCheck, MessageSquare, Reply, Star, Trash2 } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AdminBadge } from '../components/AdminBadge';
import { ModerBadge } from '../components/ModerBadge';
import { HelperBadge } from '../components/HelperBadge';
import { SupportChat } from '../components/SupportChat';

interface QAMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  role: string;
  isVerified?: boolean;
  replyTo?: string;
  replyToUserId?: string;
  rating?: number;
  createdAt: any;
}

import { SummerItemDisplay } from '../components/SummerItemDisplay';

const renderMessageText = (text: string, replyTo?: string) => {
  if (!replyTo) return text;
  
  const escapedReplyTo = replyTo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mention = `@${escapedReplyTo}`;
  const parts = text.split(new RegExp(`(${mention})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === mention.toLowerCase() ? (
          <span key={i} className="text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded-md">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

export const AIPage: React.FC<{ isAdmin?: boolean }> = ({ isAdmin }) => {
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string, name: string, userId: string } | null>(null);

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(docSnap => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      });
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'qa_messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QAMessage));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'qa_messages');
    });

    return () => unsubscribe();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !auth.currentUser) return;

    const text = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const payload: any = {
        text,
        authorId: auth.currentUser.uid,
        authorName: userProfile?.displayName || auth.currentUser.email?.split('@')[0] || 'Користувач',
        role: userProfile?.role || 'user',
        isVerified: userProfile?.isVerified || false,
        createdAt: serverTimestamp()
      };

      if (replyingTo) {
        payload.replyTo = replyingTo.name;
        payload.replyToUserId = replyingTo.userId;
      }

      await addDoc(collection(db, 'qa_messages'), payload);
      setReplyingTo(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'qa_messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRate = async (messageId: string, rating: number) => {
    try {
      await updateDoc(doc(db, 'qa_messages', messageId), { rating });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `qa_messages/${messageId}`);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'qa_messages', messageId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `qa_messages/${messageId}`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] max-w-3xl mx-auto md:px-4 md:py-6">
      <div className="flex flex-col h-full bg-white dark:bg-[#1a1a1a] md:rounded-[2rem] md:border border-slate-200 dark:border-slate-800 overflow-hidden md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:md:shadow-none">
        
        {/* Header */}
        <div className="px-6 py-4 flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/80 bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Питання та Відповіді
              </h2>
              <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                Спілкуйтеся з адміністрацією та спільнотою
              </p>
            </div>
          </div>
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <SummerItemDisplay section="qa" isAdmin={isAdmin} />
        
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>Тут поки немає повідомлень. Будьте першим!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.authorId === auth.currentUser?.uid;
          const isStaff = ['admin', 'moder', 'helper'].includes(msg.role);
          const isRateable = isStaff && msg.text.endsWith('.') && msg.replyToUserId === auth.currentUser?.uid;

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isStaff ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                {isStaff ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-bold text-slate-500">{msg.authorName}</span>
                  {msg.isVerified && <VerifiedBadge className="w-3 h-3" />}
                  {msg.role === 'admin' && <AdminBadge className="text-[9px] px-1.5 py-0.5" />}
                  {msg.role === 'moder' && <ModerBadge className="text-[9px] px-1.5 py-0.5" />}
                  {msg.role === 'helper' && <HelperBadge className="text-[9px] px-1.5 py-0.5" />}
                </div>
                
                <div className={`p-3.5 relative group ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-[1.25rem] rounded-tr-[0.25rem]' 
                    : isStaff 
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-slate-900 dark:text-white rounded-[1.25rem] rounded-tl-[0.25rem]' 
                      : 'bg-slate-50 dark:bg-[#222] text-slate-900 dark:text-white rounded-[1.25rem] rounded-tl-[0.25rem] border border-slate-100 dark:border-slate-800'
                }`}>
                  {msg.replyTo && (
                    <div className="text-xs opacity-70 mb-1 border-l-2 border-current pl-2">
                      Відповідь для @{msg.replyTo}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{renderMessageText(msg.text, msg.replyTo)}</p>
                  
                  {!isMe && (
                    <button
                      onClick={() => {
                        setReplyingTo({ id: msg.id, name: msg.authorName, userId: msg.authorId });
                        setInput(`@${msg.authorName} `);
                      }}
                      className="absolute top-2 -right-8 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-blue-500"
                    >
                      <Reply className="w-3 h-3" />
                    </button>
                  )}
                  
                  {(isMe || isAdmin) && (
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className={`absolute top-2 ${isMe ? '-left-8' : '-right-16'} p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {isRateable && !msg.rating && (
                  <div className="mt-2 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">
                    <span className="text-xs text-slate-500 mr-2">Оцініть відповідь:</span>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => handleRate(msg.id, star)}
                        className="text-slate-300 hover:text-yellow-400 transition-colors"
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    ))}
                  </div>
                )}

                {msg.rating && (
                  <div className="mt-1 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star 
                        key={star} 
                        className={`w-3 h-3 ${star <= msg.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 dark:text-slate-700'}`} 
                      />
                    ))}
                  </div>
                )}

                {msg.createdAt && (
                  <span className="text-[10px] text-gray-400 mt-1 px-1">
                    {format(msg.createdAt.toDate(), 'HH:mm', { locale: uk })}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#1a1a1a] shrink-0">
        {replyingTo && (
          <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-t-[1rem] text-[12px] font-bold border-b border-indigo-100 dark:border-indigo-500/20">
            <span className="flex items-center gap-2">
              <Reply className="w-3.5 h-3.5" />
              Відповідь для @{replyingTo.name}
            </span>
            <button 
              onClick={() => {
                setReplyingTo(null);
                setInput(input.replace(`@${replyingTo.name} `, ''));
              }}
              className="hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
            >
              Скасувати
            </button>
          </div>
        )}
        <div className={`flex items-center gap-3 ${replyingTo ? 'bg-white dark:bg-[#1a1a1a] rounded-b-[1rem] border border-t-0 border-slate-200 dark:border-slate-700 p-2' : ''}`}>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (replyingTo && !e.target.value.includes(`@${replyingTo.name}`)) {
                setReplyingTo(null);
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Напишіть ваше запитання..."
            className={`flex-1 bg-slate-50 dark:bg-[#222] text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all ${replyingTo ? 'px-4 py-2.5 rounded-[1rem]' : 'rounded-[1.25rem] px-5 py-3.5 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 border border-transparent focus:border-indigo-500/50'}`}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-[50px] h-[50px] bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-[1.25rem] flex items-center justify-center transition-colors shrink-0 shadow-sm shadow-indigo-500/20"
          >
            <Send className="w-5 h-5 -ml-0.5" />
          </button>
        </div>
      </div>
      
      </div>
      <SupportChat isAdmin={isAdmin} />
    </div>
  );
};
