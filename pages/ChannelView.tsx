import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Send, Image as ImageIcon, Settings, Users, Shield, Trash2, Mic, Square, BarChart2, X, Plus, MessageCircle, Smile } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AdminBadge } from '../components/AdminBadge';
import { ModerBadge } from '../components/ModerBadge';
import { HelperBadge } from '../components/HelperBadge';
import { FakeBadge } from '../components/FakeBadge';
import { ScamBadge } from '../components/ScamBadge';
import { BanBadge } from '../components/BanBadge';

import { ChannelInfoModal } from '../components/ChannelInfoModal';

import { SummerItemDisplay } from '../components/SummerItemDisplay';

export const ChannelView: React.FC<{ isAdmin?: boolean }> = ({ isAdmin }) => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [usersCache, setUsersCache] = useState<Record<string, any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Media & Polls state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);

  const fetchUser = async (userId: string) => {
    if (!userId || usersCache[userId]) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUsersCache(prev => ({ ...prev, [userId]: userDoc.data() }));
      }
    } catch (error) {
      console.error("Error fetching user", error);
    }
  };

  useEffect(() => {
    if (channel?.members) {
      channel.members.forEach((memberId: string) => fetchUser(memberId));
    }
    if (channel?.bannedUsers) {
      channel.bannedUsers.forEach((userId: string) => fetchUser(userId));
    }
  }, [channel]);

  useEffect(() => {
    messages.forEach(msg => {
      if (msg.authorId && !usersCache[msg.authorId]) {
        fetchUser(msg.authorId);
      }
    });
  }, [messages]);

  const handleDeleteChannel = async () => {
    // We shouldn't use window.confirm in iframe, but for now we'll just use a simple state or just delete
    // Let's just delete it for simplicity
    try {
      await deleteDoc(doc(db, 'channels', channelId!));
      navigate('/community');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `channels/${channelId}`);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'channels', channelId!, 'messages', messageId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `channels/${channelId}/messages/${messageId}`);
    }
  };

  useEffect(() => {
    if (!channelId) return;

    const fetchChannel = async () => {
      try {
        const docRef = doc(db, 'channels', channelId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.bannedUsers?.includes(auth.currentUser?.uid)) {
            navigate('/community');
            return;
          }
          setChannel({ id: docSnap.id, ...data });
        } else {
          navigate('/community');
        }
      } catch (error) {
        console.error("Error fetching channel", error);
        navigate('/community');
      } finally {
        setLoading(false);
      }
    };

    fetchChannel();

    const q = query(
      collection(db, 'channels', channelId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `channels/${channelId}/messages`);
    });

    return () => unsubscribe();
  }, [channelId, navigate]);

  useEffect(() => {
    if (!selectedMessageId || !channelId) return;

    const q = query(
      collection(db, 'channels', channelId, 'messages', selectedMessageId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `channels/${channelId}/messages/${selectedMessageId}/comments`);
    });

    return () => unsubscribe();
  }, [selectedMessageId, channelId]);

  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newComment.trim() || !auth.currentUser || !channelId || !selectedMessageId) return;

    try {
      const commentData = {
        text: newComment.trim(),
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Користувач',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'channels', channelId, 'messages', selectedMessageId, 'comments'), commentData);
      
      const messageRef = doc(db, 'channels', channelId, 'messages', selectedMessageId);
      const messageDoc = await getDoc(messageRef);
      if (messageDoc.exists()) {
        const currentCount = messageDoc.data().commentsCount || 0;
        await updateDoc(messageRef, { commentsCount: currentCount + 1 });

        // Add notification for comment
        const authorId = messageDoc.data().authorId;
        if (authorId !== auth.currentUser.uid) {
          const notificationRef = doc(collection(db, 'users', authorId, 'notifications'));
          await setDoc(notificationRef, {
            type: 'comment',
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Користувач',
            messageId: selectedMessageId,
            channelId: channelId,
            createdAt: serverTimestamp(),
            read: false
          });
        }
      }

      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `channels/${channelId}/messages/${selectedMessageId}/comments`);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!auth.currentUser || !channelId) return;

    try {
      const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        const data = messageDoc.data();
        const reactions = data.reactions || {};
        const userReactions = reactions[emoji] || [];
        
        let newReactions;
        const isAdding = !userReactions.includes(auth.currentUser.uid);
        if (!isAdding) {
          newReactions = userReactions.filter((id: string) => id !== auth.currentUser?.uid);
        } else {
          newReactions = [...userReactions, auth.currentUser.uid];
        }

        const updatedReactions = { ...reactions, [emoji]: newReactions };
        if (newReactions.length === 0) {
          delete updatedReactions[emoji];
        }

        await updateDoc(messageRef, { reactions: updatedReactions });
        setShowReactionPicker(null);

        // Add notification for reaction
        if (isAdding && data.authorId !== auth.currentUser.uid) {
          const notificationRef = doc(collection(db, 'users', data.authorId, 'notifications'));
          await setDoc(notificationRef, {
            type: 'reaction',
            emoji: emoji,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Користувач',
            messageId: messageId,
            channelId: channelId,
            createdAt: serverTimestamp(),
            read: false
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `channels/${channelId}/messages/${messageId}`);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const validPollOptions = pollOptions.filter(opt => opt.trim());
    const hasValidPoll = showPollCreator && validPollOptions.length >= 2;

    if (!newMessage.trim() && !selectedImage && !hasValidPoll && !auth.currentUser || !channelId) return;

    try {
      const messageData: any = {
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Користувач',
        authorAvatar: auth.currentUser.photoURL,
        createdAt: serverTimestamp(),
      };

      if (newMessage.trim()) messageData.text = newMessage.trim();
      if (selectedImage) messageData.image = selectedImage;
      if (hasValidPoll) messageData.poll = { options: validPollOptions, votes: {} };

      await addDoc(collection(db, 'channels', channelId, 'messages'), messageData);
      
      setNewMessage('');
      setSelectedImage(null);
      setShowPollCreator(false);
      setPollOptions(['', '']);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `channels/${channelId}/messages`);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size < 1000) {
          setIsRecording(false);
          setRecordingDuration(0);
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (auth.currentUser && channelId) {
            try {
              await addDoc(collection(db, 'channels', channelId, 'messages'), {
                isVoice: true,
                audioData: base64Audio,
                authorId: auth.currentUser.uid,
                authorName: auth.currentUser.displayName || 'Користувач',
                authorAvatar: auth.currentUser.photoURL,
                createdAt: serverTimestamp(),
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `channels/${channelId}/messages`);
            }
          }
        };
        
        setIsRecording(false);
        setRecordingDuration(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Не вдалося отримати доступ до мікрофона");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;

        if (width > height && width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        } else if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setSelectedImage(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleVote = async (messageId: string, optionIdx: number) => {
    if (!auth.currentUser || !channelId) return;
    
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.poll) return;

    try {
      const docRef = doc(db, 'channels', channelId, 'messages', messageId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.poll) {
          const currentVotes = data.poll.votes || {};
          const newVotes = { ...currentVotes };
          
          Object.keys(newVotes).forEach(key => {
            newVotes[key] = newVotes[key].filter((id: string) => id !== auth.currentUser!.uid);
          });
          
          if (!newVotes[optionIdx]) {
            newVotes[optionIdx] = [];
          }
          newVotes[optionIdx].push(auth.currentUser.uid);
          
          await updateDoc(docRef, {
            'poll.votes': newVotes
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `channels/${channelId}/messages/${messageId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!channel) return null;

  const isMember = channel.members?.includes(auth.currentUser?.uid) || channel.adminId === auth.currentUser?.uid;
  const canWrite = channel.adminId === auth.currentUser?.uid || (channel.writeAccess === 'all_members' && isMember);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowInfoModal(true)}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
              {channel.avatarUrl ? (
                <img src={channel.avatarUrl} alt={channel.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-slate-500">{channel.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white leading-tight">{channel.name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                {channel.members?.length || 0} учасників
                {channel.writeAccess === 'admin_only' && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <Shield className="w-3 h-3" />
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        
        {(channel.adminId === auth.currentUser?.uid || isAdmin) && (
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            {showSettings && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                <button
                  onClick={() => {
                    setShowInfoModal(true);
                    setShowSettings(false);
                  }}
                  className="w-full text-left px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Settings className="w-4 h-4" />
                  Налаштування
                </button>
                <button
                  onClick={handleDeleteChannel}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Видалити канал
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <SummerItemDisplay section="channel_view" isAdmin={channel.adminId === auth.currentUser?.uid} />
        
        {messages.map((msg, idx) => {
          const isMe = msg.authorId === auth.currentUser?.uid;
          const showAvatar = !isMe && (idx === 0 || messages[idx - 1].authorId !== msg.authorId);
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}
            >
              {!isMe && (
                <div className="w-8 shrink-0 flex items-end">
                  {showAvatar && (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                      {msg.authorAvatar ? (
                        <img src={msg.authorAvatar} alt={msg.authorName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                          {msg.authorName?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && showAvatar && (
                  <div className="flex items-center gap-1.5 ml-1 mb-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {msg.authorName}
                    </span>
                    {usersCache[msg.authorId]?.isVerified && <VerifiedBadge className="w-3 h-3" />}
                    {usersCache[msg.authorId]?.role === 'admin' && <AdminBadge className="text-[8px] px-1 py-0.5" />}
                    {usersCache[msg.authorId]?.role === 'moder' && <ModerBadge className="text-[8px] px-1 py-0.5" />}
                    {usersCache[msg.authorId]?.role === 'helper' && <HelperBadge className="text-[8px] px-1 py-0.5" />}
                    {usersCache[msg.authorId]?.role === 'fake' && <FakeBadge className="w-3 h-3" />}
                    {usersCache[msg.authorId]?.role === 'scam' && <ScamBadge className="w-3 h-3" />}
                    {usersCache[msg.authorId]?.role === 'ban' && <BanBadge className="w-3 h-3" />}
                  </div>
                )}
                <div 
                  className={`px-4 py-2 rounded-2xl ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-br-sm' 
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700/50 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.image && (
                    <img src={msg.image} alt="Attachment" className="max-w-full rounded-xl mb-2" />
                  )}
                  {msg.isVoice && msg.audioData ? (
                    <audio controls src={msg.audioData} className="h-8 w-48" />
                  ) : (
                    msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  )}
                  {msg.poll && (
                    <div className="mt-3 space-y-2 min-w-[200px]">
                      {msg.poll.options.map((option: string, idx: number) => {
                        const votes = msg.poll.votes || {};
                        const voteCount = votes[idx]?.length || 0;
                        const totalVotes = Object.values(votes).reduce((acc: number, curr: any) => acc + curr.length, 0) as number;
                        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                        const hasVoted = votes[idx]?.includes(auth.currentUser?.uid);

                        return (
                          <div 
                            key={idx}
                            onClick={() => handleVote(msg.id, idx)}
                            className={`relative overflow-hidden rounded-lg border p-2 cursor-pointer transition-colors ${
                              hasVoted 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div 
                              className="absolute left-0 top-0 bottom-0 bg-blue-100 dark:bg-blue-900/30 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                            <div className="relative flex justify-between items-center text-sm z-10">
                              <span className="font-medium">{option}</span>
                              <span className="text-slate-500 dark:text-slate-400">{percentage}%</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="text-xs text-slate-500 dark:text-slate-400 text-right mt-1">
                        Всього голосів: {Object.values(msg.poll.votes || {}).reduce((acc: number, curr: any) => acc + curr.length, 0) as number}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {Object.entries(msg.reactions || {}).map(([emoji, users]: [string, any]) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                          users.includes(auth.currentUser?.uid)
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{users.length}</span>
                      </button>
                    ))}
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      
                      {showReactionPicker === msg.id && (
                        <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 z-50">
                          {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(msg.id, emoji)}
                              className="text-xl hover:scale-125 transition-transform"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedMessageId(msg.id)}
                      className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {msg.commentsCount || 0}
                    </button>

                    {(isMe || channel.adminId === auth.currentUser?.uid || isAdmin) && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm', { locale: uk }) : '...'}
                </span>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {canWrite ? (
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <img src={selectedImage} alt="Selected" className="h-24 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {showPollCreator && (
            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" />
                  Створити опитування
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowPollCreator(false);
                    setPollOptions(['', '']);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {pollOptions.map((option, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[idx] = e.target.value;
                        setPollOptions(newOptions);
                      }}
                      placeholder={`Варіант ${idx + 1}`}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOptions = pollOptions.filter((_, i) => i !== idx);
                          setPollOptions(newOptions);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 p-2"
                  >
                    <Plus className="w-4 h-4" />
                    Додати варіант
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            
            <div className="flex items-center gap-1 mb-1">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button 
                type="button"
                onClick={() => setShowPollCreator(!showPollCreator)}
                className={`p-2 rounded-full transition-colors ${
                  showPollCreator 
                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                <BarChart2 className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center">
              {isRecording ? (
                <div className="flex-1 flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-600 dark:text-red-400 font-medium font-mono">
                      {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-1.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                </div>
              ) : (
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Повідомлення..."
                  className="w-full bg-transparent text-slate-900 dark:text-white px-4 py-3 outline-none resize-none max-h-32 min-h-[44px]"
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

            {!newMessage.trim() && !selectedImage && !showPollCreator && !isRecording ? (
              <button 
                type="button"
                onClick={startRecording}
                className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-full transition-colors shrink-0"
              >
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button 
                type="submit"
                disabled={(!newMessage.trim() && !selectedImage && !showPollCreator) || isRecording}
                className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </form>
        </div>
      ) : (
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            Тільки адміністратори можуть писати в цей канал
          </p>
        </div>
      )}

      {showInfoModal && (
        <ChannelInfoModal
          channel={channel}
          usersCache={usersCache}
          messages={messages}
          onClose={() => setShowInfoModal(false)}
        />
      )}

      {selectedMessageId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-500" />
                Коментарі
              </h3>
              <button
                onClick={() => setSelectedMessageId(null)}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                  Немає коментарів. Будьте першим!
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shrink-0">
                      {comment.authorName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-slate-900 dark:text-white text-sm">
                          {comment.authorName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {comment.createdAt ? format(comment.createdAt.toDate(), 'HH:mm', { locale: uk }) : '...'}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-sm mt-0.5">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <form onSubmit={handleSendComment} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Написати коментар..."
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 rounded-full outline-none"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
