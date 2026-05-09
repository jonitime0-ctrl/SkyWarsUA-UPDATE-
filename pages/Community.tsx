import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Plus, Send, Mic, MicOff, User, Reply, X, Trash2, MoreHorizontal, Pin, Smile, Paperclip, Palette, BarChart2, Lock, Search, Settings } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, increment, arrayUnion } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AdminBadge } from '../components/AdminBadge';
import { ModerBadge } from '../components/ModerBadge';
import { HelperBadge } from '../components/HelperBadge';
import { FakeBadge } from '../components/FakeBadge';
import { ScamBadge } from '../components/ScamBadge';
import { BanBadge } from '../components/BanBadge';
import { Link, useNavigate } from 'react-router-dom';
import { CreateChannelModal } from '../components/CreateChannelModal';
import { PasscodeModal } from '../components/PasscodeModal';

const ChannelCard: React.FC<{ channel: any, onClick: () => void, isAdmin: boolean, onDelete: (id: string) => void }> = ({ channel, onClick, isAdmin, onDelete }) => {
  const { t } = useLanguage();
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative mb-4 sm:mb-5 group px-4 sm:px-0"
    >
      <div 
        onClick={onClick}
        className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-slate-200/60 dark:border-white/5 shadow-xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 cursor-pointer hover:border-indigo-500/30 hover:shadow-indigo-500/10 transition-all duration-300"
      >
        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-[1.25rem] overflow-hidden bg-slate-100 dark:bg-[#0a0a0a] shadow-inner shrink-0 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300 border border-slate-200/50 dark:border-white/5">
          {channel.avatarUrl ? (
            <img src={channel.avatarUrl} alt={channel.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-black text-indigo-400 dark:text-indigo-600">{channel.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <h3 className="font-extrabold text-[17px] sm:text-[19px] text-slate-900 dark:text-white flex items-center gap-2 truncate tracking-tight">
            {channel.name}
            {channel.passcode && <Lock className="w-4 h-4 text-slate-400 shrink-0" />}
          </h3>
          <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
            <User className="w-3.5 h-3.5 opacity-70 border border-slate-400 rounded-full p-0.5" />
            {channel.members?.length || 0} {t('community.members')}
          </p>
        </div>
      </div>
      {(isAdmin || channel.adminId === auth.currentUser?.uid) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(channel.id);
          }}
          className="absolute top-1/2 -translate-y-1/2 right-6 sm:right-4 p-2.5 text-red-500/70 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-[1rem] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 border border-transparent hover:border-red-200 dark:hover:border-red-500/30"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </motion.div>
  );
};

const PostCard: React.FC<{ 
  topic: any, 
  isAdmin: boolean, 
  onDelete: (id: string, authorId: string) => void,
  onPin: (id: string, currentPinned: boolean) => void,
  usersCache: Record<string, any>,
  fetchUser: (id: string) => void
}> = ({ topic, isAdmin, onDelete, onPin, usersCache, fetchUser }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [activeDropdown, setActiveDropdown] = useState(false);
  const [activeReactionTopicId, setActiveReactionTopicId] = useState<string | null>(null);
  
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);

  // Edit topic state
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(topic.title || '');
  const [editedImage, setEditedImage] = useState<string | null>(topic.image || null);
  const [editedPoll, setEditedPoll] = useState<{ options: string[], votes?: Record<number, string[]> } | null>(topic.poll || null);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  const handleEditSave = async () => {
    if (!editedTitle.trim() && !editedImage && (!editedPoll || editedPoll.options.filter(o => o.trim()).length < 2)) return;
    try {
      await updateDoc(doc(db, 'topics', topic.id), {
        title: editedTitle.trim(),
        ...(editedImage ? { image: editedImage } : { image: null }),
        ...(editedPoll && editedPoll.options.filter(o => o.trim()).length >= 2 ? { poll: editedPoll } : { poll: null }),
        isEdited: true
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `topics/${topic.id}`);
    }
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setEditedImage(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!usersCache[topic.authorId]) {
      fetchUser(topic.authorId);
    }
    topic.coAuthors?.forEach((uid: string) => {
      if (!usersCache[uid]) fetchUser(uid);
    });
  }, [topic.authorId, topic.coAuthors]);

  useEffect(() => {
    if (!isExpanded) return;
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(m => m.topicId === topic.id);
      setMessages(msgs);
      msgs.forEach(msg => {
        if (!usersCache[msg.authorId]) {
          fetchUser(msg.authorId);
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));
    return () => unsubscribe();
  }, [isExpanded, topic.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    try {
      const msgData: any = {
        text: newMessage.trim(),
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        topicId: topic.id,
        isVoice: false,
        likes: []
      };

      if (replyingTo) {
        msgData.replyTo = replyingTo.id;
      }

      await addDoc(collection(db, 'messages'), msgData);
      await updateDoc(doc(db, 'topics', topic.id), {
        messageCount: increment(1)
      });
      
      setNewMessage('');
      setReplyingTo(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const isRecordingIntentRef = useRef(false);

  const startRecording = async () => {
    try {
      isRecordingIntentRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // If user stopped recording before permission was granted
      if (!isRecordingIntentRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        
        // Prevent sending empty or extremely short recordings
        if (audioBlob.size < 1000) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (base64Audio.length > 1000000) {
            alert('Голосове повідомлення занадто велике (макс 1MB). Спробуйте коротше.');
            return;
          }
          
          if (auth.currentUser) {
            try {
              await addDoc(collection(db, 'messages'), {
                text: 'Голосове повідомлення',
                authorId: auth.currentUser.uid,
                createdAt: serverTimestamp(),
                topicId: topic.id,
                isVoice: true,
                audioData: base64Audio,
                likes: []
              });
              await updateDoc(doc(db, 'topics', topic.id), {
                messageCount: increment(1)
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'messages');
            }
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      isRecordingIntentRef.current = false;
      console.error('Error accessing microphone:', error);
      alert('Не вдалося отримати доступ до мікрофона');
    }
  };

  const stopRecording = () => {
    isRecordingIntentRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDeleteMessage = async (messageId: string, authorId: string) => {
    if (!isAdmin && auth.currentUser?.uid !== authorId) return;
    try {
      await deleteDoc(doc(db, 'messages', messageId));
      await updateDoc(doc(db, 'topics', topic.id), {
        messageCount: increment(-1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `messages/${messageId}`);
    }
  };

  const handleTopicReaction = async (topicId: string, currentReactions: Record<string, string[]>, emoji: string) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    // Create a copy of current reactions or initialize empty object
    const newReactions = { ...currentReactions };
    
    // If user already reacted with this emoji, remove it
    if (newReactions[emoji] && newReactions[emoji].includes(uid)) {
      newReactions[emoji] = newReactions[emoji].filter(id => id !== uid);
      if (newReactions[emoji].length === 0) {
        delete newReactions[emoji];
      }
    } else {
      // Add the new reaction
      if (!newReactions[emoji]) {
        newReactions[emoji] = [];
      }
      newReactions[emoji].push(uid);
    }
    
    try {
      await updateDoc(doc(db, 'topics', topicId), {
        reactions: newReactions
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `topics/${topicId}`);
    }
  };

  const handlePollVote = async (topicId: string, optionIndex: number) => {
    if (!auth.currentUser) return;
    try {
      const topicRef = doc(db, 'topics', topicId);
      const topicDoc = await getDoc(topicRef);
      if (topicDoc.exists()) {
        const data = topicDoc.data();
        if (data.poll) {
          const currentVotes = data.poll.votes || {};
          const newVotes = { ...currentVotes };
          
          Object.keys(newVotes).forEach(key => {
            newVotes[key] = newVotes[key].filter((uid: string) => uid !== auth.currentUser?.uid);
          });
          
          if (!newVotes[optionIndex]) newVotes[optionIndex] = [];
          newVotes[optionIndex].push(auth.currentUser.uid);
          
          await updateDoc(topicRef, {
            'poll.votes': newVotes
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `topics/${topicId}`);
    }
  };

  const handleMessageReaction = async (messageId: string, currentReactions: Record<string, string[]>, emoji: string) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    const newReactions = { ...currentReactions };
    
    if (newReactions[emoji] && newReactions[emoji].includes(uid)) {
      newReactions[emoji] = newReactions[emoji].filter(id => id !== uid);
      if (newReactions[emoji].length === 0) {
        delete newReactions[emoji];
      }
    } else {
      if (!newReactions[emoji]) {
        newReactions[emoji] = [];
      }
      newReactions[emoji].push(uid);
    }
    
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        reactions: newReactions
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `messages/${messageId}`);
    }
  };

  const author = usersCache[topic.authorId];
  const authorName = author?.displayName || 'Невідомий';
  const authorHandle = author?.handle || author?.email?.split('@')[0] || 'user';
  const authorPhoto = author?.photoURL;

  return (
    <div className="bg-white relative dark:bg-[#111] rounded-[2.5rem] border border-slate-200/60 dark:border-white/5 shadow-2xl overflow-hidden mb-6 transition-all hover:-translate-y-1 mx-4 sm:mx-0">
      {/* Post Header */}
      <div className="p-4 sm:p-6 pb-3 flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 gap-3 sm:gap-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pr-8 sm:pr-0">
          <Link to={`/profile/${topic.authorId}`} className="flex items-center gap-3.5 hover:opacity-80 transition-opacity min-w-0 group shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[1.25rem] overflow-hidden bg-slate-100 dark:bg-[#0a0a0a] shadow-inner shrink-0 border border-slate-200/50 dark:border-white/5 group-hover:scale-105 transition-transform duration-300">
              {authorPhoto ? (
                <img src={authorPhoto} alt={authorName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 m-2 sm:m-3 text-slate-400" />
              )}
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-[14px] sm:text-[15px] leading-tight text-slate-900 dark:text-white truncate tracking-tight">{authorName}</span>
                {author?.isVerified && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
                {author?.chevronUrl && <img src={author.chevronUrl} alt="Chevron" className="w-3.5 h-3.5 object-contain shrink-0" />}
                {author?.role === 'admin' && <AdminBadge />}
                {author?.role === 'moder' && <ModerBadge />}
                {author?.role === 'helper' && <HelperBadge />}
                {author?.role === 'fake' && <FakeBadge />}
                {author?.role === 'scam' && <ScamBadge />}
                {author?.role === 'ban' && <BanBadge />}
              </div>
              <div className="flex items-center gap-2 text-[11px] sm:text-[12px] text-slate-500 font-bold uppercase tracking-wider">
                <span className="truncate">@{authorHandle}</span>
              </div>
            </div>
          </Link>
          
          {topic.coAuthors && topic.coAuthors.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pl-[46px] sm:pl-0 mt-[-4px] sm:mt-0">
              <span className="text-[10px] sm:hidden font-bold uppercase tracking-widest text-slate-400">Співавтори:</span>
              {topic.coAuthors.map((coAuthorId: string) => {
                const coAuthor = usersCache[coAuthorId];
                if (!coAuthor) return null;
                return (
                  <Link key={coAuthorId} to={`/profile/${coAuthorId}`} className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 border border-slate-200 dark:border-slate-800 rounded-full hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors bg-white dark:bg-[#0a0a0a]">
                      <img src={coAuthor.photoURL} alt={coAuthor.displayName} className="w-4 h-4 sm:w-6 sm:h-6 rounded-full object-cover" />
                      <span className="text-[10px] sm:text-[12px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[80px] sm:max-w-[100px]">{coAuthor.displayName}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-[11px] sm:text-[12px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mt-2 sm:mt-0">
          {topic.status === 'pending_coauthors' && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-md">
              Очікує співавторів
            </span>
          )}
          <span className="shrink-0">{topic.createdAt ? format(topic.createdAt.toDate(), 'dd MMM HH:mm', { locale: uk }) : '...'}</span>
        </div>
        
        {(isAdmin || auth.currentUser?.uid === topic.authorId) && (
          <div className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 shrink-0 sm:ml-2">
            <button onClick={() => setActiveDropdown(!activeDropdown)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-[1rem] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {activeDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] rounded-[1.25rem] shadow-xl border border-slate-200/60 dark:border-slate-800 z-10 overflow-hidden py-2">
                {isAdmin && (
                  <button 
                    onClick={() => { onPin(topic.id, !!topic.pinned); setActiveDropdown(false); }}
                    className="w-full text-left px-5 py-3 text-[13px] text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors uppercase tracking-widest"
                  >
                    <Pin className="w-4 h-4 text-indigo-500" />
                    {topic.pinned ? 'Відкріпити' : 'Закріпити'}
                  </button>
                )}
                {(isAdmin || auth.currentUser?.uid === topic.authorId) && (
                  <button 
                    onClick={() => { setIsEditing(true); setActiveDropdown(false); }}
                    className="w-full text-left px-5 py-3 text-[13px] text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors uppercase tracking-widest"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    Редагувати
                  </button>
                )}
                <button 
                  onClick={() => { onDelete(topic.id, topic.authorId); setActiveDropdown(false); }}
                  className="w-full text-left px-5 py-3 text-[13px] text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition-colors uppercase tracking-widest"
                >
                  <Trash2 className="w-4 h-4 text-red-500/70" />
                  Видалити пост
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="px-5 sm:px-6 pb-5">
        {topic.pinned && (
          <div className="flex items-center gap-1.5 text-indigo-500 mb-3 text-[10px] font-black uppercase tracking-widest bg-indigo-50/80 dark:bg-indigo-500/10 w-fit px-3 py-1.5 rounded-[0.75rem] border border-indigo-100/50 dark:border-indigo-500/20">
            <Pin className="w-3.5 h-3.5" />
            Закріплено
          </div>
        )}
        
        {isEditing ? (
          <div className="space-y-4">
            <textarea
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full bg-slate-100 dark:bg-[#1a1a1a] text-slate-800 dark:text-slate-200 border-none outline-none resize-none p-4 rounded-[1.5rem] min-h-[100px] text-[15px]"
              placeholder="Редагувати текст..."
            />
            {editedImage && (
              <div className="relative rounded-[1.5rem] overflow-hidden max-h-[400px] flex justify-center bg-slate-50 dark:bg-[#0a0a0a]">
                <img src={editedImage} alt="Preview" className="max-w-full max-h-[400px] object-cover" />
                <button
                  onClick={() => setEditedImage(null)}
                  className="absolute top-4 right-4 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {editedPoll && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm">Опитування</h4>
                  <button onClick={() => setEditedPoll(null)} className="text-red-500 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {editedPoll.options.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...editedPoll.options];
                      newOpts[i] = e.target.value;
                      setEditedPoll({ ...editedPoll, options: newOpts });
                    }}
                    placeholder={`Варіант ${i + 1}`}
                    className="w-full bg-white dark:bg-[#0a0a0a] text-slate-700 dark:text-slate-300 border-none outline-none px-3 py-2 rounded-xl mb-2 text-sm"
                  />
                ))}
                {editedPoll.options.length < 5 && (
                  <button
                    onClick={() => setEditedPoll({ ...editedPoll, options: [...editedPoll.options, ''] })}
                    className="text-xs font-bold uppercase text-indigo-500 hover:text-indigo-600 tracking-widest mt-2"
                  >
                    + Додати варіант
                  </button>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={editImageInputRef}
                  onChange={handleEditImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button onClick={() => editImageInputRef.current?.click()} className="p-2.5 text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                  <Paperclip className="w-5 h-5" />
                </button>
                {!editedPoll && (
                  <button onClick={() => setEditedPoll({ options: ['', ''] })} className="p-2.5 text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                    <BarChart2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest">
                  Скасувати
                </button>
                <button onClick={handleEditSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm">
                  Зберегти
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-slate-800 dark:text-slate-200 text-[15px] sm:text-[16px] leading-relaxed whitespace-pre-wrap break-words font-medium">
              {topic.title}
            </p>

            {topic.image && (
              <div className="mt-5 rounded-[1.5rem] overflow-hidden max-h-[600px] flex justify-center bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200/50 dark:border-slate-800/80">
                <img src={topic.image} alt="Post attachment" className="max-w-full max-h-[600px] object-cover transition-transform duration-700 hover:scale-[1.02]" loading="lazy" />
              </div>
            )}

            {topic.poll && (
              <div className="mt-5 bg-slate-50/50 dark:bg-[#0a0a0a] rounded-[2rem] p-5 border border-slate-200/60 dark:border-white/5 shadow-inner">
                <h4 className="font-extrabold text-[12px] text-slate-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Опитування
                </h4>
                <div className="space-y-3">
                  {topic.poll.options.map((option: string, idx: number) => {
                    const votes = topic.poll.votes || {};
                    const totalVotes = Object.values(votes).reduce((acc: number, curr: any) => acc + curr.length, 0) as number;
                    const optionVotes = votes[idx]?.length || 0;
                    const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                    const hasVoted = votes[idx]?.includes(auth.currentUser?.uid);

                    return (
                      <button
                        key={idx}
                        onClick={() => handlePollVote(topic.id, idx)}
                        className={`w-full relative overflow-hidden rounded-[1rem] border text-left transition-colors ${
                          hasVoted 
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' 
                            : 'border-slate-200/60 dark:border-slate-800 hover:bg-white dark:hover:bg-[#202020] hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div 
                          className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                            hasVoted ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-slate-100 dark:bg-slate-800'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                        <div className="relative z-10 p-4 flex justify-between items-center sm:px-5">
                          <span className={`text-[14px] font-bold tracking-tight ${hasVoted ? 'text-indigo-800 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300'}`}>
                            {option}
                          </span>
                          <span className={`text-[12px] uppercase tracking-widest font-black ml-4 ${hasVoted ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                            {percentage}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 flex justify-end items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                  Голосів: {Object.values(topic.poll.votes || {}).reduce((acc: number, curr: any) => acc + curr.length, 0) as number}
                </div>
              </div>
            )}
            
            {topic.isEdited && (
              <div className="mt-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center justify-end mb-1">
                Написав: Редаговано
              </div>
            )}
          </>
        )}
      </div>

      {/* Post Actions */}
      <div className="px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3.5 bg-slate-50/50 dark:bg-transparent">
        {/* Render Reactions */}
        {topic.reactions && Object.keys(topic.reactions).length > 0 && (
          <div className="flex flex-wrap gap-2 pb-3 mb-1 border-b border-slate-200/50 dark:border-slate-800/80">
            {Object.entries(topic.reactions).map(([emoji, uids]: [string, any]) => (
              <button
                key={emoji}
                onClick={() => handleTopicReaction(topic.id, topic.reactions || {}, emoji)}
                className={`flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                  uids.includes(auth.currentUser?.uid) 
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm' 
                    : 'bg-white dark:bg-[#151515] border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a1a1a]'
                }`}
              >
                <span>{emoji}</span>
                <span className="font-black text-xs opacity-80">{uids.length}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-bold group"
          >
            <div className="p-2 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-[#1a1a1a] group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-all group-hover:scale-110">
              <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </div>
            <span className="text-[13px] uppercase tracking-wide">{(topic.messageCount || 0) === 0 ? 'Коментувати' : `${topic.messageCount} коментарів`}</span>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setActiveReactionTopicId(activeReactionTopicId === topic.id ? null : topic.id)}
              className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-bold group"
            >
              <div className="p-2 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-[#1a1a1a] group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-all group-hover:scale-110">
                <Smile className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              </div>
            </button>
            
            <AnimatePresence>
              {activeReactionTopicId === topic.id && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-3 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 shadow-[0_10px_40px_rgb(0,0,0,0.12)] rounded-[1.5rem] p-2 flex items-center gap-1 z-20"
                >
                  {AVAILABLE_REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        handleTopicReaction(topic.id, topic.reactions || {}, emoji);
                        setActiveReactionTopicId(null);
                      }}
                      className={`hover:scale-125 hover:-translate-y-1 transition-all text-2xl p-1.5 origin-bottom ${
                        (topic.reactions?.[emoji] || []).includes(auth.currentUser?.uid) ? 'bg-slate-100 dark:bg-slate-800 rounded-full' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-[#0a0a0a]/30"
          >
            <div className="p-4 sm:p-5 space-y-5 max-h-96 overflow-y-auto hide-scrollbar">
              {messages.map((msg) => {
                const msgAuthor = usersCache[msg.authorId];
                const msgAuthorName = msgAuthor?.displayName || 'Невідомий';
                const msgAuthorPhoto = msgAuthor?.photoURL;
                const isMine = msg.authorId === auth.currentUser?.uid;

                return (
                  <div key={msg.id} className="flex gap-3 group">
                    <Link to={`/profile/${msg.authorId}`} className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 dark:bg-[#111] shrink-0 mt-0.5 hover:opacity-80 transition-opacity">
                      {msgAuthorPhoto ? (
                        <img src={msgAuthorPhoto} alt={msgAuthorName} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 m-2 text-slate-400" />
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="bg-white dark:bg-[#111] p-3.5 sm:p-4 rounded-[1.25rem] rounded-tl-[4px] border border-slate-200/50 dark:border-white/5 shadow-xl inline-block max-w-full">
                        <Link to={`/profile/${msg.authorId}`} className="flex items-center gap-1.5 mb-2 hover:opacity-80 transition-opacity w-fit">
                          <span className="font-extrabold text-[13px] tracking-tight text-slate-900 dark:text-white">{msgAuthorName}</span>
                          {msgAuthor?.isVerified && <VerifiedBadge className="w-3 h-3 shrink-0" />}
                          {msgAuthor?.chevronUrl && <img src={msgAuthor.chevronUrl} alt="Chevron" className="w-3 h-3 object-contain shrink-0" />}
                          {msgAuthor?.role === 'admin' && <AdminBadge />}
                          {msgAuthor?.role === 'moder' && <ModerBadge />}
                        </Link>
                        
                        {msg.replyTo && (
                          <div className="text-[11px] font-bold uppercase tracking-widest mb-2 p-2 px-3 rounded-xl border-l-[3px] bg-slate-50 dark:bg-slate-800/50 border-indigo-500 text-indigo-500 truncate max-w-sm">
                            <Reply className="w-3.5 h-3.5 inline mr-1.5" />
                            Відповідь
                          </div>
                        )}
                        
                        {msg.isVoice && msg.audioData ? (
                          <audio controls src={msg.audioData} className="h-10 w-full max-w-[200px]" />
                        ) : (
                          <p className="text-[14px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1.5 ml-2 relative px-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm', { locale: uk }) : '...'}
                        </span>

                        <button onClick={() => setReplyingTo(msg)} className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                          Відповісти
                        </button>
                        
                        <div className="relative">
                          <button 
                            onClick={() => setActiveReactionMessageId(activeReactionMessageId === msg.id ? null : msg.id)}
                            className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            Реакція
                          </button>
                          
                          <AnimatePresence>
                            {activeReactionMessageId === msg.id && (
                              <motion.div 
                                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                className="absolute bottom-full left-0 mb-3 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-700 shadow-[0_10px_40px_rgb(0,0,0,0.12)] rounded-[1.5rem] p-1.5 flex items-center gap-1 z-20"
                              >
                                {AVAILABLE_REACTIONS.map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={() => {
                                      handleMessageReaction(msg.id, msg.reactions || {}, emoji);
                                      setActiveReactionMessageId(null);
                                    }}
                                    className={`hover:scale-125 transition-transform text-xl p-1.5 ${
                                      (msg.reactions?.[emoji] || []).includes(auth.currentUser?.uid) ? 'bg-slate-100 dark:bg-slate-800 rounded-full' : ''
                                    }`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {(isAdmin || isMine) && (
                          <button onClick={() => handleDeleteMessage(msg.id, msg.authorId)} className="text-[11px] font-black uppercase tracking-widest text-red-500/50 hover:text-red-500 transition-opacity">
                            Видалити
                          </button>
                        )}
                      </div>
                      
                      {/* Render Message Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 ml-1">
                          {Object.entries(msg.reactions).map(([emoji, uids]: [string, any]) => (
                            <button
                              key={emoji}
                              onClick={() => handleMessageReaction(msg.id, msg.reactions || {}, emoji)}
                              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                uids.includes(auth.currentUser?.uid) 
                                  ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400' 
                                  : 'bg-white dark:bg-[#121212] border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-medium">{uids.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-6 font-medium">Немає коментарів. Будьте першим!</div>
              )}
            </div>

            {/* Comment Input */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/60 dark:bg-[#0a0a0a] dark:border-white/5">
              <AnimatePresence>
                {replyingTo && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 10, height: 0 }}
                    className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-3 rounded-2xl mb-4 text-xs font-bold shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 truncate tracking-tight">
                      <Reply className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{replyingTo.text}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-lg text-indigo-500 transition-colors shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                <div className="w-11 h-11 rounded-[1.25rem] overflow-hidden bg-slate-200 dark:bg-[#111] shadow-inner shrink-0 mb-0.5 border border-slate-200/50 dark:border-white/5 flex justify-center items-center">
                  {auth.currentUser?.photoURL ? (
                    <img src={auth.currentUser.photoURL} alt="Me" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 bg-white dark:bg-[#111] border border-slate-200/80 dark:border-white/5 rounded-[2rem] overflow-hidden focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-xl group p-1">
                  {isRecording ? (
                    <div className="w-full h-[48px] flex items-center justify-center text-red-500 font-bold animate-pulse text-sm uppercase tracking-widest">
                      Запис... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </div>
                  ) : (
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Додати коментар..."
                      className="w-full max-h-32 min-h-[44px] p-3 text-sm bg-transparent resize-none focus:outline-none text-slate-900 dark:text-white placeholder-slate-400"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                  )}
                </div>
                
                {newMessage.trim() ? (
                  <button 
                    type="submit"
                    className="p-3 text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all shadow-md shrink-0 mb-0.5"
                  >
                    <Send className="w-5 h-5 ml-[-2px]" />
                  </button>
                ) : (
                  <button 
                    type="button"
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`p-3 rounded-2xl transition-all shadow-sm shrink-0 mb-0.5 border ${
                      isRecording 
                        ? 'text-red-500 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30 animate-pulse' 
                        : 'text-slate-500 bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import { SummerItemDisplay } from '../components/SummerItemDisplay';

export const Community: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { t } = useLanguage();
  const [topics, setTopics] = useState<any[]>([]);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicCoAuthors, setNewTopicCoAuthors] = useState<string[]>([]);
  const [newTopicCollaborationEmail, setNewTopicCollaborationEmail] = useState('');
  const [newTopicImage, setNewTopicImage] = useState<string | null>(null);
  const [newTopicPoll, setNewTopicPoll] = useState<{ options: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [usersCache, setUsersCache] = useState<Record<string, any>>({});
  const [feedType, setFeedType] = useState<'all' | 'following' | 'channels' | 'users'>('all');
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleChannelClick = async (channel: any) => {
    if (auth.currentUser && channel.bannedUsers?.includes(auth.currentUser.uid)) {
      setBanError('Ви не можете приєднатися до цього каналу, оскільки вас заблокував його адміністратор');
      setTimeout(() => setBanError(null), 5000);
      return;
    }

    if (channel.passcode && channel.adminId !== auth.currentUser?.uid && !channel.members?.includes(auth.currentUser?.uid)) {
      setSelectedChannel(channel);
      setShowPasscodeModal(true);
    } else {
      if (auth.currentUser && !channel.members?.includes(auth.currentUser.uid)) {
        try {
          await updateDoc(doc(db, 'channels', channel.id), {
            members: arrayUnion(auth.currentUser.uid)
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `channels/${channel.id}`);
        }
      }
      navigate(`/channel/${channel.id}`);
    }
  };

  const handlePasscodeSuccess = async () => {
    setShowPasscodeModal(false);
    if (selectedChannel && auth.currentUser) {
      if (!selectedChannel.members?.includes(auth.currentUser.uid)) {
        try {
          await updateDoc(doc(db, 'channels', selectedChannel.id), {
            members: arrayUnion(auth.currentUser.uid)
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `channels/${selectedChannel.id}`);
        }
      }
      navigate(`/channel/${selectedChannel.id}`);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'channels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChannels(channelsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'channels'));
    return () => unsubscribe();
  }, []);

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
    const q = query(collection(db, 'topics'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const topicsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTopics(topicsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'topics'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUsersCache(prev => ({ ...prev, [userId]: userDoc.data() }));
      }
    } catch (error) {
      console.error("Error fetching user profile", error);
    }
  };

  const handleCreateTopic = async (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    console.log("handleCreateTopic called", { newTopicTitle, newTopicImage, newTopicPoll, newTopicCoAuthors });
    
    const validPollOptions = newTopicPoll?.options.filter(o => o.trim()) || [];
    const hasValidPoll = validPollOptions.length >= 2;
    
    // Allow post if it has text, image, or a valid poll
    const hasContent = newTopicTitle.trim() !== '' || newTopicImage !== null || hasValidPoll;
    
    if (!hasContent || !auth.currentUser) {
      console.log("Validation failed", { title: newTopicTitle.trim(), user: auth.currentUser, hasContent });
      return;
    }

    console.log("Poll validation", { validPollOptions, hasValidPoll });

    try {
      const isAutoPublishAdmin = isAdmin || auth.currentUser.email === 'olegkucher2311@gmail.com';
      const hasCoAuthors = newTopicCoAuthors.length > 0;
      
      const status = (!isAutoPublishAdmin && hasCoAuthors) ? 'pending_coauthors' : 'published';
      const coAuthors = (isAutoPublishAdmin && hasCoAuthors) ? newTopicCoAuthors : [];
      const pendingCoAuthors = (!isAutoPublishAdmin && hasCoAuthors) ? newTopicCoAuthors : [];

      await addDoc(collection(db, 'topics'), {
        title: newTopicTitle.trim(),
        authorId: auth.currentUser.uid,
        coAuthors,
        pendingCoAuthors,
        status,
        collaborationEmail: newTopicCollaborationEmail,
        createdAt: serverTimestamp(),
        messageCount: 0,
        pinned: false,
        ...(newTopicImage && { image: newTopicImage }),
        ...(hasValidPoll && { poll: { options: validPollOptions, votes: {} } })
      });
      console.log("Topic created successfully");
      setNewTopicTitle('');
      setNewTopicCoAuthors([]);
      setNewTopicCollaborationEmail('');
      setNewTopicImage(null);
      setNewTopicPoll(null);
    } catch (error) {
      console.error("Error creating topic", error);
      handleFirestoreError(error, OperationType.CREATE, 'topics');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        if (dataUrl.length > 500000) {
          alert('Зображення занадто велике. Зменшіть розмір і спробуйте знову.');
          return;
        }
        setNewTopicImage(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const togglePoll = () => {
    if (newTopicPoll) {
      setNewTopicPoll(null);
    } else {
      setNewTopicPoll({ options: ['', ''] });
    }
  };

  const handlePollOptionChange = (index: number, value: string) => {
    if (newTopicPoll) {
      const newOptions = [...newTopicPoll.options];
      newOptions[index] = value;
      setNewTopicPoll({ options: newOptions });
    }
  };

  const handleAddPollOption = () => {
    if (newTopicPoll && newTopicPoll.options.length < 5) {
      setNewTopicPoll({ options: [...newTopicPoll.options, ''] });
    }
  };

  const handleDeleteTopic = async (topicId: string, authorId: string) => {
    if (!isAdmin && auth.currentUser?.uid !== authorId) return;
    try {
      await deleteDoc(doc(db, 'topics', topicId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `topics/${topicId}`);
    }
  };

  const handlePinTopic = async (topicId: string, currentPinned: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'topics', topicId), {
        pinned: !currentPinned
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `topics/${topicId}`);
    }
  };

  const filteredTopics = topics.filter(topic => {
    // Hide cancelled topics
    if (topic.status === 'cancelled') return false;
    // Hide pending topics from general feed unless it's the author or admin
    if (topic.status === 'pending_coauthors' && !isAdmin && topic.authorId !== auth.currentUser?.uid) return false;

    if (feedType === 'all') return true;
    if (feedType === 'following') {
      return currentUserProfile?.following?.includes(topic.authorId) || topic.authorId === auth.currentUser?.uid;
    }
    return true;
  });

  const pendingInvitations = topics.filter(t => t.status === 'pending_coauthors' && t.pendingCoAuthors?.includes(auth.currentUser?.uid));

  const acceptInvitation = async (topicId: string, currentPending: string[], currentCoAuthors: string[] = []) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const newPending = currentPending.filter(id => id !== uid);
    const newCoAuthors = [...currentCoAuthors, uid];
    try {
      await updateDoc(doc(db, 'topics', topicId), {
        pendingCoAuthors: newPending,
        coAuthors: newCoAuthors,
        ...(newPending.length === 0 && { status: 'published' })
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `topics/${topicId}`);
    }
  };

  const declineInvitation = async (topicId: string, currentPending: string[]) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const newPending = currentPending.filter(id => id !== uid);
    try {
      await updateDoc(doc(db, 'topics', topicId), {
        status: 'cancelled',
        pendingCoAuthors: newPending
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `topics/${topicId}`);
    }
  };

  const sortedTopics = [...filteredTopics].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0; // Keep the original order (which is by createdAt desc)
  });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      {banError && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mx-4 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 font-medium flex items-center justify-between"
        >
          <span>{banError}</span>
          <button onClick={() => setBanError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[3rem] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-100/50 dark:border-white/5 mb-8 mx-4 sm:mx-0 mt-2"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex items-center gap-5">
             <div className="w-20 h-20 rounded-[2rem] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl">
               <MessageSquare className="w-10 h-10" />
             </div>
             <div>
               <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t('community.title')}</h1>
               <p className="text-slate-500 font-bold tracking-[0.15em] uppercase text-xs sm:text-[13px] mt-2">{t('community.subtitle')}</p>
             </div>
          </div>
          
          <div className="flex w-full bg-slate-100/50 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1.5 overflow-x-auto hide-scrollbar gap-1 border border-slate-200/50 dark:border-white/10">
            {[
              { id: 'all', label: t('community.tabs.all') },
              { id: 'following', label: t('community.tabs.following') },
              { id: 'channels', label: t('community.tabs.channels') },
              { id: 'users', label: t('community.tabs.users') }
            ].map(tab => (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                key={tab.id}
                onClick={() => setFeedType(tab.id as any)}
                className={`px-6 py-3.5 rounded-[1rem] text-[11px] sm:text-xs font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap flex-1 text-center ${
                  feedType === tab.id 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Create Post Section */}
      {feedType !== 'channels' && feedType !== 'users' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[3rem] p-6 lg:p-8 mb-8 text-slate-900 dark:text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-100/50 dark:border-white/5 mx-4 sm:mx-0 transition-all focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10"
        >
          <div className="flex gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-[1.5rem] overflow-hidden bg-slate-100 dark:bg-white/5 shrink-0 border border-slate-200/50 dark:border-white/10 shadow-inner flex items-center justify-center">
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="Me" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1 flex flex-col gap-4">
              <textarea
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder={t('community.createPost')}
                className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none outline-none text-[17px] sm:text-[19px] font-medium min-h-[50px] pt-2 sm:pt-4 leading-relaxed"
                maxLength={200}
              />
              
              {/* Co-author selection */}
              <div className="flex flex-wrap gap-2 mt-2">
                {newTopicCoAuthors.map(uid => {
                  const user = allUsers.find(u => u.id === uid);
                  return user ? (
                    <div key={uid} className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-200 dark:border-indigo-500/30">
                      <img src={user.photoURL} alt={user.displayName} className="w-5 h-5 rounded-full object-cover" />
                      {user.displayName}
                      <button onClick={() => setNewTopicCoAuthors(prev => prev.filter(id => id !== uid))} className="ml-1 text-indigo-500 hover:text-indigo-700">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null;
                })}
                <select 
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id && !newTopicCoAuthors.includes(id)) {
                      setNewTopicCoAuthors(prev => [...prev, id]);
                    }
                    e.target.value = '';
                  }}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 outline-none"
                >
                  <option value="">Додати співавтора</option>
                  {allUsers
                    .filter(u => u.id !== auth.currentUser?.uid && !newTopicCoAuthors.includes(u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.displayName}</option>
                    ))}
                </select>
                <input
                  type="email"
                  value={newTopicCollaborationEmail}
                  onChange={(e) => setNewTopicCollaborationEmail(e.target.value)}
                  placeholder="Email для співпраці"
                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 outline-none w-full mt-2"
                />
              </div>

              {newTopicImage && (
                <div className="relative w-full max-w-sm rounded-[1.5rem] overflow-hidden border border-slate-200/60 dark:border-slate-800 shadow-sm mt-2">
                  <img src={newTopicImage} alt="Preview" className="w-full h-auto object-cover" />
                  <button 
                    onClick={() => setNewTopicImage(null)}
                    className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-[1rem] text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {newTopicPoll && (
                <div className="bg-slate-50 dark:bg-[#0a0a0a] p-5 rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-inner mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-extrabold text-[13px] text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-indigo-500" />
                      {t('community.pollTitle')}
                    </h3>
                    <button onClick={togglePoll} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newTopicPoll.options.map((option, idx) => (
                      <div key={idx} className="flex flex-col relative group">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                          placeholder={`${t('community.pollOption')} ${idx + 1}`}
                          className="w-full bg-white dark:bg-[#151515] border border-slate-200 dark:border-slate-800 rounded-[1rem] px-5 py-4 text-[15px] font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                          maxLength={50}
                        />
                      </div>
                    ))}
                  </div>
                  {newTopicPoll.options.length < 5 && (
                    <button 
                      onClick={handleAddPollOption}
                      className="text-indigo-600 dark:text-indigo-400 text-[13px] font-black uppercase tracking-widest hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 px-4 py-2 mt-2 rounded-[1rem] hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors inline-flex"
                    >
                      <Plus className="w-4 h-4" /> {t('community.pollAddOption')}
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-2 pt-4 border-t border-slate-100 dark:border-white/5 gap-4 sm:gap-0">
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-500 bg-slate-50 dark:bg-[#0a0a0a] hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-white/5 border border-slate-200/60 dark:border-white/5 rounded-[1rem] transition-colors" title={t('community.addPhoto')}>
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button onClick={togglePoll} className={`p-3 border rounded-[1rem] transition-colors ${newTopicPoll ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30' : 'text-slate-500 bg-slate-50 dark:bg-[#0a0a0a] hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-white/5 border-slate-200/60 dark:border-white/5'}`} title={t('community.createPoll')}>
                    <BarChart2 className="w-5 h-5" />
                  </button>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateTopic}
                  disabled={!newTopicTitle.trim() && !newTopicImage && (!newTopicPoll || newTopicPoll.options.filter(o => o.trim()).length < 2)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.15em] text-[13px] py-4 px-8 w-full sm:w-auto rounded-[1.5rem] transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-[0_8px_30px_rgb(79,70,229,0.3)] flex items-center justify-center gap-2"
                >
                  {t('community.publish')}
                  <Send className="w-4 h-4 ml-1" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {feedType === 'channels' && (
        <div className="px-4 mb-6 sm:mb-8">
          <button
            onClick={() => setIsCreatingChannel(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] p-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            {t('community.createChannel')}
          </button>
        </div>
      )}

      <div className="space-y-6 px-1 sm:px-4">
        {feedType === 'users' ? (
          <div className="space-y-5">
            <div className="relative mx-4 sm:mx-0">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder={t('community.searchUsers')}
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#151515] border border-slate-200/60 dark:border-slate-800 rounded-[1.5rem] py-4 pl-14 pr-5 text-[15px] font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 sm:px-0">
              {allUsers
                .filter(u => u.id !== auth.currentUser?.uid && u.displayName?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                .map(u => (
                  <div key={u.id} className="bg-white dark:bg-[#151515] p-5 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:border-slate-700 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-[1.25rem] overflow-hidden bg-slate-100 dark:bg-[#1a1a1a] shrink-0 border border-slate-200/50 dark:border-slate-800 flex items-center justify-center">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <h3 className="font-extrabold text-[15px] sm:text-[16px] text-slate-900 dark:text-white flex items-center gap-1.5 tracking-tight">
                          {u.displayName}
                          {u.isVerified && <VerifiedBadge className="w-3.5 h-3.5" />}
                        </h3>
                        <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">@{u.email?.split('@')[0]}</p>
                      </div>
                    </div>
                    <Link
                      to={`/chat/${u.id}`}
                      className="p-3.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all group-hover:scale-105 active:scale-95"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        ) : feedType === 'channels' ? (
          <AnimatePresence>
            {channels.map(channel => (
              <ChannelCard 
                key={channel.id} 
                channel={channel} 
                onClick={() => handleChannelClick(channel)} 
                isAdmin={isAdmin}
                onDelete={async (id) => {
                  try {
                    await deleteDoc(doc(db, 'channels', id));
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, `channels/${id}`);
                  }
                }}
              />
            ))}
            {channels.length === 0 && (
              <div className="text-center text-slate-500 py-16 bg-white dark:bg-[#151515] rounded-[2rem] border border-slate-200/60 dark:border-slate-800 mx-4 sm:mx-0 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 dark:bg-[#1a1a1a] rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 border border-slate-200/50 dark:border-slate-800 shadow-inner">
                  <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="font-extrabold text-[15px] sm:text-[17px] uppercase tracking-widest text-slate-900 dark:text-white">{t('community.noChannels')}</p>
                <p className="text-[13px] mt-2 font-bold uppercase tracking-widest text-slate-400">{t('community.createFirstChannel')}</p>
              </div>
            )}
            
            <SummerItemDisplay section="channels" isAdmin={isAdmin} />
          </AnimatePresence>
        ) : (
          <>
            {pendingInvitations.length > 0 && (
              <div className="mb-6 mx-4 sm:mx-0 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Очікують вашого підтвердження:</h3>
                {pendingInvitations.map(topic => (
                  <div key={topic.id} className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Запрошення до співавторства</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Ви були обрані як співавтор для посту "{topic.title}"</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => acceptInvitation(topic.id, topic.pendingCoAuthors || [], topic.coAuthors || [])} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-sm">
                         Підтвердити
                       </button>
                       <button onClick={() => declineInvitation(topic.id, topic.pendingCoAuthors || [])} className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-sm">
                         Відхилити
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {sortedTopics.map(topic => (
              <PostCard 
                key={topic.id} 
                topic={topic} 
                isAdmin={isAdmin} 
                onDelete={handleDeleteTopic}
                onPin={handlePinTopic}
                usersCache={usersCache}
                fetchUser={fetchUserProfile}
              />
            ))}
            {sortedTopics.length === 0 && (
              <div className="text-center text-slate-500 py-16 bg-white dark:bg-[#151515] rounded-[2rem] border border-slate-200/60 dark:border-slate-800 mx-4 sm:mx-0 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 dark:bg-[#1a1a1a] rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 border border-slate-200/50 dark:border-slate-800 shadow-inner">
                  <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="font-extrabold text-[15px] sm:text-[17px] uppercase tracking-widest text-slate-900 dark:text-white">{t('community.noPosts')}</p>
                <p className="text-[13px] mt-2 font-bold uppercase tracking-widest text-slate-400">{t('community.createFirstPost')}</p>
              </div>
            )}
            
            <SummerItemDisplay section="feed" isAdmin={isAdmin} />
          </>
        )}
      </div>

      <AnimatePresence>
        {isCreatingChannel && (
          <CreateChannelModal onClose={() => setIsCreatingChannel(false)} />
        )}
        {showPasscodeModal && selectedChannel && (
          <PasscodeModal
            correctPasscode={selectedChannel.passcode}
            onSuccess={handlePasscodeSuccess}
            onClose={() => setShowPasscodeModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
