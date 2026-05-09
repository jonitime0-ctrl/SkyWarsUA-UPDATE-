import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Phone, Video, MoreVertical, Send, Image as ImageIcon, Smile, Paperclip, Mic, X, ShieldAlert, Flag, Trash2, BellOff, Ban, Search as SearchIcon, User } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { VerifiedBadge } from '../components/VerifiedBadge';

export const Chat: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [presence, setPresence] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setUser({ id: userDoc.id, ...userDoc.data() });
        }
      } catch (error) {
        console.error("Error fetching user", error);
      }
    };

    fetchUser();

    const unsubPresence = onSnapshot(doc(db, 'presence', userId), (docSnap) => {
      if (docSnap.exists()) {
        setPresence(docSnap.data());
      }
    });

    return () => unsubPresence();
  }, [userId]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserProfile({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !userId) return;

    const chatId = [auth.currentUser.uid, userId].sort().join('_');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`));

    return () => unsubscribe();
  }, [userId]);

  const formatPresence = (presence: any) => {
    if (!presence) return 'недавно';
    if (presence.state === 'online') return 'в мережі';
    if (!presence.lastChanged) return 'недавно';

    const lastChanged = presence.lastChanged.toDate();
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastChanged.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0 && now.getDate() === lastChanged.getDate()) {
      return `був(ла) о ${format(lastChanged, 'HH:mm', { locale: uk })}`;
    } else if (diffDays < 8) {
      return 'був(ла) недавно';
    } else {
      return 'був(ла) давно';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !userId) return;

    if (isBlockedByMe || isBlockedByThem || messagesNotAllowed) return;

    const chatId = [auth.currentUser.uid, userId].sort().join('_');
    
    try {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        text: newMessage,
        senderId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
  };

  const handleBlockUser = async () => {
    if (!auth.currentUser || !userId) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        blockedUsers: arrayUnion(userId)
      });
      setShowMoreMenu(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const handleUnblockUser = async () => {
    if (!auth.currentUser || !userId) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        blockedUsers: arrayRemove(userId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  if (!user) return <div className="p-8 text-center">Завантаження...</div>;

  const isBlockedByMe = currentUserProfile?.blockedUsers?.includes(userId);
  const isBlockedByThem = user?.blockedUsers?.includes(auth.currentUser?.uid);
  const messagesNotAllowed = user?.allowMessages === false;

  if (showChatProfile) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-[#0a0c10]">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setShowChatProfile(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-900 dark:text-white" />
          </button>
          <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            {/* Edit icon placeholder */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-900 dark:text-white"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
        </div>

        {/* Profile Info */}
        <div className="relative flex flex-col items-center">
          <div 
            className="absolute top-0 left-0 w-full h-40 -z-10"
            style={{ 
              backgroundColor: user.bannerColor || 'transparent',
              backgroundImage: user.bannerUrl ? `url(${user.bannerUrl})` : (user.bannerColor ? 'none' : 'linear-gradient(to bottom right, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))'),
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 mb-4 shadow-lg border-4 border-slate-50 dark:border-[#0a0c10] mt-20">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-slate-500 font-bold">
                {user.displayName?.charAt(0)}
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-1">
            {user.displayName}
            {user.isVerified && <VerifiedBadge className="w-5 h-5" />}
          </h1>
          <p className="text-slate-500 mt-1">@{user.email?.split('@')[0]}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-6 mt-8 px-4">
          <div className="flex flex-col items-center gap-2">
            <button className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
              <Phone className="w-6 h-6" />
            </button>
            <span className="text-xs text-slate-500">Зателефонувати</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
              <Video className="w-6 h-6" />
            </button>
            <span className="text-xs text-slate-500">Відеовиклик</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={() => navigate(`/profile/${userId}`)}
              className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              <User className="w-6 h-6" />
            </button>
            <span className="text-xs text-slate-500">Профіль</span>
          </div>
          <div className="flex flex-col items-center gap-2 relative">
            <button 
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              <MoreVertical className="w-6 h-6" />
            </button>
            <span className="text-xs text-slate-500">Ще</span>

            {/* More Menu Dropdown */}
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-40"
                  >
                    <div className="py-2">
                      <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">Ігнорувати розмову</span>
                        <BellOff className="w-5 h-5 text-slate-500" />
                      </button>
                      <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left border-b border-slate-100 dark:border-slate-800/50">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">Пошук</span>
                        <SearchIcon className="w-5 h-5 text-slate-500" />
                      </button>
                      
                      <button 
                        onClick={() => {
                          handleBlockUser();
                          setShowChatProfile(false);
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left border-b border-slate-100 dark:border-slate-800/50"
                      >
                        <span className="text-sm font-medium text-slate-900 dark:text-white">Заблокувати повідомлення</span>
                        <Ban className="w-5 h-5 text-slate-500" />
                      </button>

                      <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left">
                        <span className="text-sm font-medium text-red-500">Поскаржитися на розмову</span>
                        <Flag className="w-5 h-5 text-red-500" />
                      </button>
                      <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left border-b border-slate-100 dark:border-slate-800/50">
                        <span className="text-sm font-medium text-red-500">Поскаржитися на користувача</span>
                        <Flag className="w-5 h-5 text-red-500" />
                      </button>

                      <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left">
                        <span className="text-sm font-medium text-red-500">Видалити розмову</span>
                        <Trash2 className="w-5 h-5 text-red-500" />
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Settings List */}
        <div className="mt-8 px-4 space-y-2">
          <div className="bg-slate-100 dark:bg-[#161b22] rounded-2xl overflow-hidden">
            <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-slate-900 dark:text-white" />
                <span className="font-medium text-slate-900 dark:text-white">Медіафайли, посилання, документи</span>
              </div>
              <ArrowLeft className="w-5 h-5 text-slate-400 rotate-180" />
            </button>
            <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-900 dark:text-white"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span className="font-medium text-slate-900 dark:text-white">Зникаючі повідомлення</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">Вимк.</span>
                <ArrowLeft className="w-5 h-5 text-slate-400 rotate-180" />
              </div>
            </button>
            <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <span className="font-medium text-slate-400">Блокувати знімки екрана</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">Вимк.</span>
                <ArrowLeft className="w-5 h-5 text-slate-400 rotate-180" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-[#0a0c10]">
      {/* Header */}
      <div className="bg-white dark:bg-[#161b22] border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-900 dark:text-white" />
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowChatProfile(true)}>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">
                  {user.displayName?.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-1 text-sm">
                {user.displayName}
                {user.isVerified && <VerifiedBadge className="w-3.5 h-3.5" />}
              </h2>
              <p className="text-xs text-slate-500">
                {formatPresence(presence)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 relative">
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400">
            <Video className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-white"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* More Menu Dropdown */}
          <AnimatePresence>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-40"
                >
                  <div className="py-2">
                    <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">Ігнорувати розмову</span>
                      <BellOff className="w-5 h-5 text-slate-500" />
                    </button>
                    <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">Пошук</span>
                      <SearchIcon className="w-5 h-5 text-slate-500" />
                    </button>
                    
                    <button 
                      onClick={handleBlockUser}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left border-b border-slate-100 dark:border-slate-800/50"
                    >
                      <span className="text-sm font-medium text-slate-900 dark:text-white">Заблокувати повідомлення</span>
                      <Ban className="w-5 h-5 text-slate-500" />
                    </button>

                    <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left">
                      <span className="text-sm font-medium text-red-500">Поскаржитися на розмову</span>
                      <Flag className="w-5 h-5 text-red-500" />
                    </button>
                    <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-sm font-medium text-red-500">Поскаржитися на користувача</span>
                      <Flag className="w-5 h-5 text-red-500" />
                    </button>

                    <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left">
                      <span className="text-sm font-medium text-red-500">Видалити розмову</span>
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center text-xs text-slate-500 my-4">
          Сьогодні
        </div>
        
        {messages.map((msg) => {
          const isMine = msg.senderId === auth.currentUser?.uid;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                isMine 
                  ? 'bg-blue-500 text-white rounded-br-sm' 
                  : 'bg-white dark:bg-[#161b22] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-bl-sm'
              }`}>
                <p className="text-sm">{msg.text}</p>
                <div className={`text-[10px] mt-1 text-right ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>
                  {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-[#161b22] border-t border-slate-200 dark:border-slate-800 shrink-0">
        {isBlockedByMe ? (
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-sm text-slate-500 mb-3 flex items-center justify-center gap-2">
              <Ban className="w-4 h-4" />
              Ви заблокували цього користувача.
            </p>
            <button 
              onClick={handleUnblockUser}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-bold transition-colors"
            >
              Розблокувати
            </button>
          </div>
        ) : isBlockedByThem ? (
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center justify-center gap-2 font-medium">
              ✖️ Користувач заблокував вас.
            </p>
          </div>
        ) : messagesNotAllowed ? (
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
              <Ban className="w-4 h-4" />
              🚫 Ви не можете надсилати повідомлення цьому користувачеві.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <button type="button" className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0">
              <Paperclip className="w-6 h-6" />
            </button>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center px-4 py-2 min-h-[48px]">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Незашифроване повідомлення"
                className="flex-1 bg-transparent border-none focus:outline-none text-slate-900 dark:text-white text-sm"
              />
              <button type="button" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-2">
                <Smile className="w-5 h-5" />
              </button>
            </div>
            {newMessage.trim() ? (
              <button 
                type="submit"
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button type="button" className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0">
                <Mic className="w-6 h-6" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
