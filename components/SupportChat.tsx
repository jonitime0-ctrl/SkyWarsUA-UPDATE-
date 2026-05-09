import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, X, Send, User, ShieldCheck, Reply, Trash2, ChevronLeft } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { VerifiedBadge } from './VerifiedBadge';
import { AdminBadge } from './AdminBadge';
import { ModerBadge } from './ModerBadge';
import { HelperBadge } from './HelperBadge';

interface SupportMessage {
  id: string;
  text: string;
  authorId: string;
  authorName?: string;
  role?: string;
  photoURL?: string;
  isVerified?: boolean;
  createdAt: any;
  replyTo?: string;
  replyToText?: string;
}

interface SupportChatProps {
  isAdmin?: boolean;
}

export const SupportChat: React.FC<SupportChatProps> = ({ isAdmin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string, text: string, authorId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(docSnap => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      });
    }
  }, []);

  // For admins: load all chats. For users: just set activeChatId to their own uid
  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;

    if (isAdmin) {
      const q = query(collection(db, 'support_chats'), orderBy('updatedAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'support_chats');
      });
      return () => unsubscribe();
    } else {
      setActiveChatId(auth.currentUser.uid);
    }
  }, [isOpen, isAdmin]);

  // Load messages for active chat
  useEffect(() => {
    if (!isOpen || !activeChatId) return;

    const q = query(collection(db, 'support_chats', activeChatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportMessage)));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `support_chats/${activeChatId}/messages`);
    });

    return () => unsubscribe();
  }, [isOpen, activeChatId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !auth.currentUser || !activeChatId) return;

    const text = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // Ensure chat document exists
      if (!isAdmin && messages.length === 0) {
        await setDoc(doc(db, 'support_chats', activeChatId), {
          userId: auth.currentUser.uid,
          userName: userProfile?.displayName || auth.currentUser.email?.split('@')[0] || 'Користувач',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: text
        });
      } else {
        await updateDoc(doc(db, 'support_chats', activeChatId), {
          updatedAt: serverTimestamp(),
          lastMessage: text
        });
      }

      const payload: any = {
        text,
        authorId: auth.currentUser.uid,
        authorName: userProfile?.displayName || auth.currentUser.email?.split('@')[0] || 'Користувач',
        role: userProfile?.role || 'user',
        photoURL: userProfile?.photoURL || auth.currentUser.photoURL || '',
        isVerified: userProfile?.isVerified || false,
        createdAt: serverTimestamp()
      };

      if (replyingTo) {
        payload.replyTo = replyingTo.authorId;
        payload.replyToText = replyingTo.text;
      }

      await addDoc(collection(db, 'support_chats', activeChatId, 'messages'), payload);
      setReplyingTo(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `support_chats/${activeChatId}/messages`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!activeChatId) return;
    try {
      await deleteDoc(doc(db, 'support_chats', activeChatId, 'messages', messageId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `support_chats/${activeChatId}/messages/${messageId}`);
    }
  };

  // Swipe to reply logic
  const [swipeState, setSwipeState] = useState<{ id: string, offset: number } | null>(null);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    
    // Only allow swipe left (diff < 0)
    if (diff < 0 && diff > -100) {
      setSwipeState({ id, offset: diff });
    }
  };

  const handleTouchEnd = (msg: SupportMessage) => {
    if (swipeState && swipeState.id === msg.id && swipeState.offset < -50) {
      setReplyingTo({ id: msg.id, text: msg.text, authorId: msg.authorId });
    }
    setSwipeState(null);
    touchStartX.current = null;
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center z-[60]"
      >
        <Phone className="w-6 h-6 animate-pulse" />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full h-[90vh] sm:h-[600px] sm:max-w-md bg-white dark:bg-[#0A0A0A] sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl border border-[#E5E5E5] dark:border-[#1A1A1A]"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#E5E5E5] dark:border-[#1A1A1A] flex items-center justify-between bg-green-500 text-white">
                <div className="flex items-center gap-3">
                  {isAdmin && activeChatId && (
                    <button onClick={() => setActiveChatId(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Технічна підтримка</h2>
                    <p className="text-xs text-green-100">
                      {isAdmin && !activeChatId ? 'Список звернень' : 'Ми онлайн'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto bg-[#F4F4F4] dark:bg-[#111111] flex flex-col relative">
                {isAdmin && !activeChatId ? (
                  // Admin Chat List
                  <div className="p-2 space-y-2">
                    {chats.length === 0 && (
                      <div className="text-center text-gray-500 mt-10">Немає активних звернень</div>
                    )}
                    {chats.map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => setActiveChatId(chat.id)}
                        className="w-full text-left p-4 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-[#E5E5E5] dark:border-[#333] hover:border-green-500 transition-colors"
                      >
                        <div className="font-bold text-[#1A1A1A] dark:text-white">{chat.userName}</div>
                        <div className="text-sm text-gray-500 truncate mt-1">{chat.lastMessage}</div>
                        {chat.updatedAt && (
                          <div className="text-xs text-gray-400 mt-2">
                            {format(chat.updatedAt.toDate(), 'dd MMM HH:mm', { locale: uk })}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  // Chat Messages
                  <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                    {messages.length === 0 && (
                      <div className="text-center text-gray-500 mt-10">
                        <p>Опишіть вашу проблему, і ми вам допоможемо!</p>
                      </div>
                    )}

                    {messages.map((msg) => {
                      const isMe = msg.authorId === auth.currentUser?.uid;
                      const isStaff = msg.authorId !== activeChatId; // If not the user who started the chat, it's staff
                      
                      const offset = swipeState?.id === msg.id ? swipeState.offset : 0;

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0, x: offset }}
                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                          onTouchStart={(e) => handleTouchStart(e, msg.id)}
                          onTouchMove={(e) => handleTouchMove(e, msg.id)}
                          onTouchEnd={() => handleTouchEnd(msg)}
                          className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} relative`}
                        >
                          {/* Swipe Reply Icon Background */}
                          <div className="absolute right-[-40px] top-1/2 -translate-y-1/2 text-gray-400 opacity-0 transition-opacity" style={{ opacity: offset < -30 ? 1 : 0 }}>
                            <Reply className="w-5 h-5" />
                          </div>

                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${isStaff ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                            {msg.photoURL ? (
                              <img src={msg.photoURL} alt={msg.authorName || ''} className="w-full h-full object-cover" />
                            ) : isStaff ? (
                              <ShieldCheck className="w-5 h-5" />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          
                          <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {isStaff && !isMe && msg.authorName && (
                              <div className="flex items-center gap-1.5 mb-1 px-1">
                                <span className="text-xs text-gray-500 font-medium">{msg.authorName}</span>
                                {msg.isVerified && <VerifiedBadge className="w-3 h-3" />}
                                {msg.role === 'admin' && <AdminBadge className="text-[8px] px-1 py-0.5" />}
                                {msg.role === 'moder' && <ModerBadge className="text-[8px] px-1 py-0.5" />}
                                {msg.role === 'helper' && <HelperBadge className="text-[8px] px-1 py-0.5" />}
                              </div>
                            )}
                            <div className={`p-3 rounded-2xl relative group ${isMe ? 'bg-green-500 text-white rounded-tr-sm' : 'bg-white dark:bg-[#1A1A1A] text-[#1A1A1A] dark:text-white rounded-tl-sm border border-[#E5E5E5] dark:border-[#333] shadow-sm'}`}>
                              
                              {msg.replyToText && (
                                <div className="text-xs opacity-70 mb-1 border-l-2 border-current pl-2 line-clamp-2">
                                  {msg.replyToText}
                                </div>
                              )}
                              
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                              
                              {!isMe && (
                                <button
                                  onClick={() => setReplyingTo({ id: msg.id, text: msg.text, authorId: msg.authorId })}
                                  className="absolute top-2 -right-8 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-green-500 hidden sm:block"
                                >
                                  <Reply className="w-3 h-3" />
                                </button>
                              )}
                              
                              {(isMe || isAdmin) && (
                                <button
                                  onClick={() => handleDelete(msg.id)}
                                  className={`absolute top-2 ${isMe ? '-left-8' : '-right-16'} p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50 hidden sm:block`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            
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
                )}
              </div>

              {/* Input */}
              {(!isAdmin || activeChatId) && (
                <div className="p-3 border-t border-[#E5E5E5] dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                  {replyingTo && (
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-3 py-2 rounded-t-xl text-sm border-b border-green-100 dark:border-green-800/30">
                      <span className="flex items-center gap-2 truncate">
                        <Reply className="w-4 h-4 shrink-0" />
                        <span className="truncate">{replyingTo.text}</span>
                      </span>
                      <button 
                        onClick={() => setReplyingTo(null)}
                        className="hover:text-green-800 dark:hover:text-green-200 ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className={`flex items-center gap-2 ${replyingTo ? 'bg-white dark:bg-[#1A1A1A] rounded-b-xl border border-t-0 border-[#E5E5E5] dark:border-[#333] p-1' : ''}`}>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Напишіть повідомлення..."
                      className={`flex-1 bg-[#F4F4F4] dark:bg-[#111111] text-black dark:text-white placeholder-gray-500 outline-none transition-all ${replyingTo ? 'px-3 py-2' : 'rounded-full px-4 py-3'}`}
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="w-12 h-12 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white rounded-full flex items-center justify-center transition-colors shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
