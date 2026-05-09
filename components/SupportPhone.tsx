import React, { useState, useEffect, useRef } from 'react';
import { Send, ChevronLeft, MessageCircle, X, User, Paperclip, Video, Mic, Trash2, ShieldAlert } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

export const SupportWidget: React.FC<{ sessionId: string, isAdmin: boolean }> = ({ sessionId, isAdmin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [activeRoom, setActiveRoom] = useState<string | null>(isAdmin ? null : sessionId);
  const [onlineAdmins, setOnlineAdmins] = useState<any[]>([]);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdmin && auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(docSnap => {
        if (docSnap.exists()) {
          setAdminProfile(docSnap.data());
        }
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchOnlineAdmins = async () => {
      try {
        const adminsQuery = query(collection(db, 'users'), where('role', 'in', ['admin', 'moder', 'helper']));
        const adminsSnap = await getDocs(adminsQuery);
        const adminIds = adminsSnap.docs.map(d => d.id);
        if (adminIds.length > 0) {
          const presenceQuery = query(collection(db, 'presence'), where('state', '==', 'online'));
          const unsubscribe = onSnapshot(presenceQuery, (snap) => {
            const onlineIds = snap.docs.map(d => d.id);
            const onlineAdminUsers = adminsSnap.docs
              .filter(d => onlineIds.includes(d.id))
              .map(d => ({ id: d.id, ...d.data() }));
            setOnlineAdmins(onlineAdminUsers);
          });
          return unsubscribe;
        }
      } catch (error) {
        console.error("Error fetching admins", error);
      }
    };
    const unsubPromise = fetchOnlineAdmins();
    return () => {
      unsubPromise.then(unsub => { if (unsub) unsub(); });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let q;
    if (isAdmin) {
      q = query(collection(db, 'support_chat'), orderBy('timestamp', 'asc'));
    } else {
      q = query(collection(db, 'support_chat'), where('room', '==', sessionId), orderBy('timestamp', 'asc'));
    }
    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [isAdmin, sessionId, isOpen]);

  useEffect(() => {
    if (!isAdmin) {
      setActiveRoom(sessionId);
    } else if (activeRoom === sessionId) {
      setActiveRoom(null);
    }
  }, [isAdmin, sessionId, activeRoom]);

  const sendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !imageUrl) || !activeRoom) return;
    const text = input.trim();
    setInput('');
    try {
      const messageData: any = {
        text,
        senderId: isAdmin ? 'admin' : sessionId,
        room: activeRoom,
        isAdmin,
        timestamp: serverTimestamp()
      };
      if (imageUrl) messageData.imageUrl = imageUrl;
      if (isAdmin && adminProfile) {
        messageData.adminInfo = {
          displayName: adminProfile.displayName || auth.currentUser?.displayName || 'Адміністратор',
          photoURL: adminProfile.photoURL || auth.currentUser?.photoURL || '',
          role: adminProfile.role || 'admin'
        };
      }
      await addDoc(collection(db, 'support_chat'), messageData);
    } catch (error) {
      console.error("Error sending message", error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (base64String.length < 800000) {
           sendMessage(undefined, base64String);
        } else {
           alert("Файл занадто великий. Максимальний розмір ~500KB.");
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("Наразі підтримуються лише зображення.");
    }
    if (e.target) e.target.value = '';
  };

  const chatRooms = isAdmin ? Array.from(new Set(messages.map(m => m.room))).filter(Boolean) as string[] : [];

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Адміністратор';
      case 'moder': return 'Модератор';
      case 'helper': return 'Хелпер';
      default: return 'Підтримка';
    }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, roomToDelete: string) => {
    e.stopPropagation();
    if (!window.confirm('Ви впевнені, що хочете видалити цей діалог? Це незворотна дія.')) return;
    try {
      setIsDeleting(true);
      const msgsToDelete = messages.filter(m => m.room === roomToDelete);
      for (const msg of msgsToDelete) {
        if (msg.id) await deleteDoc(doc(db, 'support_chat', msg.id));
      }
      if (activeRoom === roomToDelete) setActiveRoom(null);
    } catch (error) {
      console.error("Error deleting room", error);
      alert('Помилка при видаленні діалогу');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllRooms = async () => {
    if (!window.confirm('ОБЕРЕЖНО! Ви впевнені, що хочете видалити ВСІ діалоги з усіма користувачами? Це неможливо відмінити.')) return;
    try {
      setIsDeleting(true);
      for (const msg of messages) {
        if (msg.id) await deleteDoc(doc(db, 'support_chat', msg.id));
      }
      setActiveRoom(null);
    } catch (error) {
      console.error("Error deleting all rooms", error);
      alert('Помилка при видаленні всіх діалогів');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-6 z-[100] w-14 h-14 bg-gradient-to-tr from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 text-white rounded-full shadow-[0_4px_14px_0_rgba(99,102,241,0.39)] flex items-center justify-center cursor-pointer hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] transition-all ${isOpen ? 'hidden' : 'flex'}`}
      >
        <MessageCircle className="w-6 h-6" />
        {!isAdmin && messages.length > 0 && messages[messages.length - 1].isAdmin && (
          <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[100] bg-slate-50 dark:bg-[#0A0A0A] flex flex-col"
          >
            {/* Toolbar Full Width */}
            <div className="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-[#111] border-b border-slate-200 dark:border-[#222] shrink-0">
              <div className="flex items-center gap-3">
                {isAdmin && activeRoom && (
                  <button onClick={() => setActiveRoom(null)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#222] transition-colors">
                    <ChevronLeft className="w-6 h-6 text-slate-800 dark:text-slate-200" />
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {isAdmin && !activeRoom ? 'Технічна Підтримка - Адмін' : isAdmin ? `Діалог #${activeRoom?.slice(0, 6)}` : 'Служба Підтримки'}
                  </h2>
                  {!isAdmin && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${onlineAdmins.length > 0 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {onlineAdmins.length > 0 ? 'Оператори на зв`язку' : 'Залиште повідомлення'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {isAdmin && !activeRoom && (
                  <button 
                    onClick={handleDeleteAllRooms}
                    disabled={isDeleting || chatRooms.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-full font-medium text-sm transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Очистити всі
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#222] transition-colors"
                >
                  <X className="w-6 h-6 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex w-full max-w-7xl mx-auto">
              
              {/* Admin Side / User Main */}
              {isAdmin && !activeRoom ? (
                <div className="w-full h-full p-6 overflow-y-auto">
                  {chatRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                       <MessageCircle className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-700" />
                       <p className="font-semibold text-lg">Немає звернень</p>
                       <p className="text-sm mt-2">Всі діалоги порожні</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {chatRooms.map(room => {
                        const roomMsgs = messages.filter(m => m.room === room);
                        const lastMsg = roomMsgs[roomMsgs.length - 1];
                        return (
                          <div key={room} className="bg-white dark:bg-[#111] rounded-[24px] border border-slate-200 dark:border-[#222] shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1a1a1a] flex justify-between items-center">
                              <span className="font-bold text-slate-900 dark:text-white">Клієнт #{room.slice(0, 6)}</span>
                              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md">
                                {lastMsg?.timestamp ? new Date(lastMsg.timestamp.toMillis()).toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'}) : ''}
                              </span>
                            </div>
                            <div className="px-5 py-4 flex-1">
                              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                                {lastMsg?.isAdmin ? <span className="font-semibold text-slate-900 dark:text-slate-300">Ви: </span> : ''}{lastMsg?.text || (lastMsg?.imageUrl ? '[Прикріплено фото]' : '')}
                              </p>
                            </div>
                            <div className="px-4 py-3 bg-slate-50 dark:bg-[#0A0A0A] border-t border-slate-100 dark:border-[#1a1a1a] flex items-center justify-between">
                              <button 
                                onClick={() => setActiveRoom(room)}
                                className="flex-1 mr-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-black rounded-lg font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                              >
                                Відкрити чат
                              </button>
                              <button 
                                onClick={(e) => handleDeleteRoom(e, room)}
                                disabled={isDeleting}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Видалити чат"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col w-full max-w-4xl mx-auto h-full bg-white dark:bg-[#111] shadow-2xl border-x border-slate-200 dark:border-[#222]">
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    {!isAdmin && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-[#1A1A1A] text-slate-900 dark:text-white rounded-2xl p-5 max-w-md">
                          <h4 className="font-bold text-lg mb-2">Чим ми можемо допомогти? 👋</h4>
                          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Опишіть вашу проблему, і ми зв'яжемося з вами найближчим часом.</p>
                        </div>
                      </div>
                    )}

                    {messages.filter(m => m.room === activeRoom).map((msg, index, arr) => {
                      const isMe = msg.senderId === (isAdmin ? 'admin' : sessionId);
                      const showAdminProfile = !isMe && msg.isAdmin && msg.adminInfo && (index === 0 || arr[index-1].senderId !== msg.senderId);

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {showAdminProfile && (
                            <div className="flex items-center gap-3 mb-2 ml-1">
                              {msg.adminInfo.photoURL ? (
                                <img src={msg.adminInfo.photoURL} alt="Admin" className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-[#222]" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                  <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">
                                  {msg.adminInfo.displayName}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
                                  {getRoleLabel(msg.adminInfo.role)}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-4 shadow-sm ${
                              isMe 
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-tr-none' 
                                : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-[#2a2a2a]'
                            }`}>
                              {msg.imageUrl && (
                                <img src={msg.imageUrl} alt="Attached" className="max-w-full rounded-xl mb-3 border border-black/10 dark:border-white/10" />
                              )}
                              {msg.text && <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.text}</p>}
                              <div className={`text-[11px] font-medium mt-3 text-right ${isMe ? 'text-slate-300 dark:text-slate-500' : 'text-slate-500 dark:text-slate-500'}`}>
                                {msg.timestamp ? new Date(msg.timestamp.toMillis()).toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'}) : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>

                  {/* Chat Input */}
                  {activeRoom && (
                    <div className="p-4 md:p-6 bg-white dark:bg-[#111] border-t border-slate-200 dark:border-[#222]">
                      <form onSubmit={sendMessage} className="flex gap-2 items-end">
                        <div className="flex bg-slate-100 dark:bg-[#1A1A1A] rounded-3xl p-1 shrink-0 h-[52px]">
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx" />
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#222] rounded-full transition-colors">
                            <Paperclip className="w-5 h-5" />
                          </button>
                          <input type="file" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" capture="environment" />
                          <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#222] rounded-full transition-colors">
                            <Video className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex-1 bg-slate-100 dark:bg-[#1A1A1A] rounded-3xl flex items-center px-4 overflow-hidden focus-within:ring-2 focus-within:ring-slate-400 dark:focus-within:ring-slate-600 transition-shadow">
                          <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(e);
                              }
                            }}
                            placeholder="Введіть ваше повідомлення..."
                            className="flex-1 bg-transparent border-none py-4 text-sm md:text-base focus:outline-none dark:text-white resize-none max-h-32 min-h-[52px]"
                            rows={1}
                          />
                        </div>
                        
                        <button 
                          type="submit"
                          disabled={!input.trim()}
                          className="w-[52px] h-[52px] rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center disabled:opacity-50 transition-colors shrink-0 hover:bg-slate-800 dark:hover:bg-slate-200"
                        >
                          <Send className="w-5 h-5 ml-1" />
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
