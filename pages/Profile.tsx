import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Mail, Calendar, ShieldCheck, CheckCircle, Camera, Trash2, Gift, X, LogOut, Download, Settings, MessageCircle, Send } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType, logOut } from '../firebase';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, getDocs, addDoc, serverTimestamp, where, setDoc, getDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { uk, enUS, pl, de } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';

import { VerifiedBadge } from '../components/VerifiedBadge';
import { AdminBadge } from '../components/AdminBadge';
import { ModerBadge } from '../components/ModerBadge';
import { HelperBadge } from '../components/HelperBadge';
import { FakeBadge } from '../components/FakeBadge';
import { ScamBadge } from '../components/ScamBadge';
import { BanBadge } from '../components/BanBadge';
import { SponsorBadge } from '../components/SponsorBadge';
import { EditProfileModal } from '../components/EditProfileModal';
import { AppUpdateModal } from '../components/AppUpdateModal';
import { updateProfile } from 'firebase/auth';

import { SummerItemDisplay } from '../components/SummerItemDisplay';

export const Profile: React.FC<{ isAdmin: boolean, user: any }> = ({ isAdmin, user }) => {
  const { userId } = useParams<{ userId: string }>();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isAppUpdateModalOpen, setIsAppUpdateModalOpen] = useState(false);
  const [gmail, setGmail] = useState('');
  const [tgChannel, setTgChannel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [selectedRoleInfo, setSelectedRoleInfo] = useState<string | null>(null);
  const [selectedChevronUserId, setSelectedChevronUserId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const chevronInputRef = useRef<HTMLInputElement>(null);

  const [usersModal, setUsersModal] = useState<{ type: 'followers' | 'following', title: string, userIds: string[] } | null>(null);
  const [modalUsers, setModalUsers] = useState<any[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<any[]>([]);
  const [selectedGift, setSelectedGift] = useState<any | null>(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    if (!usersModal || usersModal.userIds.length === 0) {
      setModalUsers([]);
      return;
    }
    
    const fetchModalUsers = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtered = users.filter(u => usersModal.userIds.includes(u.id));
        setModalUsers(filtered);
      } catch (error) {
        console.error("Error fetching modal users", error);
      }
    };
    fetchModalUsers();
  }, [usersModal]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("Щоб встановити додаток на головний екран:\n\nНа iOS (Safari): Натисніть кнопку 'Поділитися' (квадрат зі стрілочкою) внизу екрану, потім виберіть 'На початковий екран'.\n\nНа Android (Chrome): Натисніть меню (три крапки) у правому верхньому куті та виберіть 'Додати на головний екран'.");
    }
  };

  const isOwnProfile = !userId || (user && userId === user.uid);
  const targetUserId = userId || user?.uid;

  useEffect(() => {
    if (!targetUserId) return;
    const qGifts = query(collection(db, 'users', targetUserId, 'received_gifts'), orderBy('receivedAt', 'desc'));
    const unsubGifts = onSnapshot(qGifts, (snap) => {
      setReceivedGifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${targetUserId}/received_gifts`);
    });
    return () => unsubGifts();
  }, [targetUserId]);

  useEffect(() => {
    if (!targetUserId) {
      setUserProfile(null);
      return;
    }
    
    const userRef = doc(db, 'users', targetUserId);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile({ id: docSnap.id, ...docSnap.data() });
      } else {
        if (isOwnProfile && user) {
          // Create user profile if it doesn't exist
          try {
            const newUserData = {
              email: user.email,
              displayName: user.displayName || 'Користувач',
              photoURL: user.photoURL || null,
              createdAt: serverTimestamp(),
              isVerified: false,
              role: 'user'
            };
            await setDoc(userRef, newUserData);
            setUserProfile({ id: user.uid, ...newUserData });
          } catch (error) {
            console.error("Error creating user profile:", error);
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
        }
      }
    }, (error) => {
      console.error("Error fetching user profile:", error);
      setUserProfile(null);
    });

    return () => unsubscribe();
  }, [targetUserId, isOwnProfile, user]);

  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [myVerificationRequest, setMyVerificationRequest] = useState<any>(null);
  const [userPresence, setUserPresence] = useState<any>(null);
  const [userChannels, setUserChannels] = useState<any[]>([]);

  useEffect(() => {
    if (!targetUserId) return;

    const presenceRef = doc(db, 'presence', targetUserId);
    const unsubPresence = onSnapshot(presenceRef, (snap) => {
      if (snap.exists()) {
        setUserPresence(snap.data());
      } else {
        setUserPresence(null);
      }
    });

    const qChannels = query(collection(db, 'channels'), where('adminId', '==', targetUserId));
    const unsubChannels = onSnapshot(qChannels, (snap) => {
      setUserChannels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qTopics = query(collection(db, 'topics'), where('authorId', '==', targetUserId));
    const unsubTopics = onSnapshot(qTopics, (snap) => {
      const topics = snap.docs.map(d => ({ id: d.id, type: 'topic', ...d.data() }));
      const qMessages = query(collection(db, 'messages'), where('authorId', '==', targetUserId));
      getDocs(qMessages).then(msgSnap => {
        const messages = msgSnap.docs.map(d => ({ id: d.id, type: 'message', ...d.data() }));
        const combined = [...topics, ...messages].sort((a, b) => {
          const timeA = a.createdAt?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || 0;
          return timeB - timeA;
        });
        setUserActivity(combined);
      }).catch(err => console.error("Error fetching messages", err));
    }, (error) => console.error("Error fetching topics", error));

    let unsubVerif = () => {};
    if (isAdmin || auth.currentUser?.uid === targetUserId) {
      const qVerif = query(collection(db, 'verificationRequests'), where('userId', '==', targetUserId));
      unsubVerif = onSnapshot(qVerif, (snap) => {
        if (!snap.empty) {
          const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
          });
          setMyVerificationRequest(reqs[0]);
        } else {
          setMyVerificationRequest(null);
        }
      }, (error) => console.error("Error fetching verification requests", error));
    }

    return () => {
      unsubPresence();
      unsubChannels();
      unsubTopics();
      unsubVerif();
    };
  }, [targetUserId]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllUsers(usersData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    };

    fetchUsers();

    const q = query(collection(db, 'verificationRequests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setVerificationRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error("Error fetching requests", error));
    return () => unsubscribe();
  }, [isAdmin]);

  const toggleVerification = async (userId: string, currentStatus: boolean, requestId?: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        isVerified: !currentStatus
      });
      if (requestId) {
        await updateDoc(doc(db, 'verificationRequests', requestId), { status: 'approved' });
      }
      // Update local state for immediate feedback
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: !currentStatus } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    if (!isAdmin) return;
    
    const roles = ['user', 'helper', 'moder', 'admin', 'fake', 'scam', 'ban'];
    const currentIndex = roles.indexOf(currentRole);
    const newRole = roles[(currentIndex + 1) % roles.length];

    try {
      const updateData: any = { role: newRole };
      if (currentRole === 'ban' && newRole !== 'ban') {
        updateData.blockedSections = [];
      }
      await updateDoc(doc(db, 'users', userId), updateData);
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updateData } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const toggleSponsor = async (userId: string, isSponsor: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        isSponsor: !isSponsor
      });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isSponsor: !isSponsor } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const rejectVerification = async (requestId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'verificationRequests', requestId), { status: 'rejected' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `verificationRequests/${requestId}`);
    }
  };

  const [videoLink, setVideoLink] = useState('');

  const handleVerificationRequest = async () => {
    if (!user || !gmail || !tgChannel || !videoLink) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'verificationRequests'), {
        userId: user.uid,
        gmail,
        tgChannel,
        videoLink,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      setIsVerificationModalOpen(false);
      setGmail('');
      setTgChannel('');
      setVideoLink('');
      alert('Заявку надіслано!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'verificationRequests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDescriptionUpdate = async () => {
    if (!user || !isOwnProfile) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        description: descriptionInput
      });
      setIsEditingDescription(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
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
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        try {
          await updateDoc(doc(db, 'users', user.uid), {
            photoURL: dataUrl
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBannerUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width *= ratio;
        height *= ratio;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

        try {
          await updateDoc(doc(db, 'users', user.uid), {
            bannerUrl: dataUrl,
            bannerColor: null // Clear color if image is set
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBannerColorUpdate = async (color: string) => {
    if (!user || !isOwnProfile) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        bannerColor: color,
        bannerUrl: null // Clear image if color is set
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleChevronUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChevronUserId) return;

    if (file.size > 1 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 64;
        const MAX_HEIGHT = 64;
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
        
        const dataUrl = canvas.toDataURL('image/png');

        try {
          await updateDoc(doc(db, 'users', selectedChevronUserId), {
            chevronUrl: dataUrl
          });
          setAllUsers(prev => prev.map(u => u.id === selectedChevronUserId ? { ...u, chevronUrl: dataUrl } : u));
          setSelectedChevronUserId(null);
          if (chevronInputRef.current) chevronInputRef.current.value = '';
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${selectedChevronUserId}`);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveChevron = async (userId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        chevronUrl: null
      });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, chevronUrl: null } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleFollow = async () => {
    if (!user || !userProfile || isOwnProfile) return;
    
    const isFollowing = userProfile.followers?.includes(user.uid);
    
    try {
      // Update target user's followers
      const targetRef = doc(db, 'users', targetUserId);
      const newFollowers = isFollowing 
        ? (userProfile.followers || []).filter((id: string) => id !== user.uid)
        : [...(userProfile.followers || []), user.uid];
        
      // Update current user's following
      const currentUserRef = doc(db, 'users', user.uid);
      const currentUserDoc = await getDoc(currentUserRef);
      const currentUserData = currentUserDoc.data();
      const newFollowing = isFollowing
        ? (currentUserData?.following || []).filter((id: string) => id !== targetUserId)
        : [...(currentUserData?.following || []), targetUserId];

      await updateDoc(targetRef, { followers: newFollowers });
      await updateDoc(currentUserRef, { following: newFollowing });
      
      if (!isFollowing) {
        // Create notification for new follower
        const notificationRef = doc(collection(db, 'users', targetUserId, 'notifications'));
        await setDoc(notificationRef, {
          type: 'follow',
          fromUserId: user.uid,
          fromUserName: currentUserData?.displayName || 'Користувач',
          createdAt: new Date(),
          read: false
        });
      }

      setUserProfile({ ...userProfile, followers: newFollowers });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users`);
    }
  };

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

  const handleSaveProfile = async (newDisplayName: string, newPhotoURL: string) => {
    if (!user) return;
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: newDisplayName,
          photoURL: newPhotoURL
        });
      }
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName,
        photoURL: newPhotoURL
      });
      setIsEditProfileModalOpen(false);
    } catch (e) {
      console.error("Error saving profile", e);
      alert('Помилка збереження');
    }
  };

  if (!user) return <div className="p-8 text-center">Будь ласка, увійдіть у систему.</div>;
  if (!userProfile) return <div className="p-8 text-center animate-pulse">Завантаження профілю...</div>;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-4xl mx-auto"
      >
        <div className="relative bg-[#ffffff] dark:bg-[#0a0a0a] rounded-[3rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-100/50 dark:border-white/5 transition-all">
          {/* Header Background Area */}
          <div 
            className="relative h-72 sm:h-96 w-full group"
            style={{ 
              backgroundColor: userProfile.bannerColor || 'transparent',
              backgroundImage: userProfile.bannerUrl ? `url(${userProfile.bannerUrl})` : (userProfile.bannerColor ? 'none' : 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)'),
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Gradient overlay to make text pop */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 dark:from-black/90 dark:via-black/20 to-transparent transition-opacity" />
            
            {isOwnProfile && (
              <div className="absolute top-6 w-full px-6 flex justify-between z-20 box-border left-0">
                {(!userProfile?.isFrozen || !userProfile?.frozenFeatures?.includes('avatar_upload')) ? (
                  <>
                    <input 
                      type="file" 
                      ref={bannerInputRef} 
                      onChange={handleBannerUpdate} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button 
                      onClick={() => bannerInputRef.current?.click()}
                      className="w-12 h-12 bg-black/30 hover:bg-black/50 text-white rounded-[1rem] flex items-center justify-center backdrop-blur-md transition-all border border-white/20 hover:scale-105"
                      title="Змінити банер"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  </>
                ) : <div />}
                
                {(!userProfile?.isFrozen || !userProfile?.frozenFeatures?.includes('profile_edit')) && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditProfileModalOpen(true)}
                      className="px-6 py-3 bg-black/30 hover:bg-black/50 text-white font-bold rounded-[1rem] backdrop-blur-md transition-all border border-white/20 hover:scale-105 shadow-xl text-sm"
                    >
                      Редагувати профіль
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Floating Gifts (Over Avatar) */}
            <div className="absolute inset-0 z-[30] pointer-events-none overflow-hidden">
              {receivedGifts.map((gift, index) => {
                const top = 10 + (index * 23) % 40; // 10% to 50% from top (around banner/avatar)
                const right = 10 + (index * 37) % 60; // 10% to 70% wide
                return (
                  <button 
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    className="absolute w-12 h-12 rounded-full flex items-center justify-center group transition-transform hover:scale-110 animate-float pointer-events-auto"
                    style={{ 
                      backgroundColor: gift.giftDetails?.backgroundColor + '40',
                      top: `${top}%`,
                      right: `${right}%`,
                      animationDelay: `${index * 0.5}s`
                    }}
                  >
                    <img src={gift.giftDetails?.imageUrl} alt={gift.giftDetails?.name} className="w-8 h-8 object-contain drop-shadow-lg" />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-10 font-bold tracking-wider">
                      {gift.giftDetails?.name}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* User Info Overlayed on Banner Bottom */}
            <div className="absolute bottom-6 left-6 right-6 z-20 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-8">
              <div className="relative group shrink-0">
                <div className="w-28 h-28 sm:w-36 sm:h-36 bg-slate-200 dark:bg-slate-700 rounded-[2rem] flex items-center justify-center text-5xl font-black text-slate-500 overflow-hidden ring-4 ring-white/20 dark:ring-white/10 shadow-2xl transition-transform hover:scale-105 backdrop-blur-sm -rotate-3 hover:rotate-0">
                  {userProfile.photoURL ? (
                    <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-12 h-12" />
                  )}
                </div>
                
                {isOwnProfile && (!userProfile?.isFrozen || !userProfile?.frozenFeatures?.includes('avatar_upload')) && (
                  <>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleAvatarUpdate} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 flex flex-col gap-2 items-center justify-center rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all text-white backdrop-blur-sm"
                      title="Змінити фото"
                    >
                      <Camera className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Змінити</span>
                    </button>
                  </>
                )}

                {userProfile.isVerified && (
                  <div className="absolute -bottom-2 -right-2 bg-blue-500 rounded-full p-1.5 z-10 shadow-xl border-4 border-white/20">
                    <VerifiedBadge className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 w-full pb-2">
                <h1 className="text-3xl sm:text-5xl font-black text-white flex items-center flex-wrap gap-2.5 drop-shadow-2xl">
                  {userProfile.displayName}
                  {userProfile.isVerified && <VerifiedBadge className="w-7 h-7 sm:w-8 sm:h-8" />}
                  {userProfile.isSponsor && <SponsorBadge className="w-7 h-7 sm:w-8 sm:h-8" />}
                  {userProfile.role === 'admin' && (
                    <button onClick={() => setSelectedRoleInfo('admin')} className="hover:scale-110 transition-transform">
                      <AdminBadge className="text-sm px-2.5 py-1" />
                    </button>
                  )}
                  {userProfile.role === 'moder' && (
                    <button onClick={() => setSelectedRoleInfo('moder')} className="hover:scale-110 transition-transform">
                      <ModerBadge className="text-sm px-2.5 py-1" />
                    </button>
                  )}
                  {userProfile.role === 'helper' && (
                    <button onClick={() => setSelectedRoleInfo('helper')} className="hover:scale-110 transition-transform">
                      <HelperBadge className="text-sm px-2.5 py-1" />
                    </button>
                  )}
                  {userProfile.role === 'fake' && (
                    <button onClick={() => setSelectedRoleInfo('fake')} className="hover:scale-110 transition-transform">
                      <FakeBadge className="w-7 h-7 sm:w-8 sm:h-8" />
                    </button>
                  )}
                  {userProfile.role === 'scam' && (
                    <button onClick={() => setSelectedRoleInfo('scam')} className="hover:scale-110 transition-transform">
                      <ScamBadge className="w-7 h-7 sm:w-8 sm:h-8" />
                    </button>
                  )}
                  {userProfile.role === 'ban' && (
                    <button onClick={() => setSelectedRoleInfo('ban')} className="hover:scale-110 transition-transform">
                      <BanBadge className="w-7 h-7 sm:w-8 sm:h-8" />
                    </button>
                  )}
                  {userProfile.chevronUrl && (
                    <img src={userProfile.chevronUrl} alt="Chevron" className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-lg" />
                  )}
                </h1>
                <p className="text-sm sm:text-md font-bold text-white/80 drop-shadow-md mt-2 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${userPresence?.state === 'online' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-slate-400'}`} />
                  {formatPresence(userPresence)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Stats & Actions Bento Box */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[2rem] border border-slate-200/50 dark:border-white/10 shadow-xl"
          >
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
              <button 
                onClick={() => setUsersModal({ type: 'followers', title: 'Підписники', userIds: userProfile.followers || [] })}
                className="group flex flex-col items-center"
              >
                <span className="text-4xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                  {userProfile.fakeFollowersCount !== undefined && userProfile.fakeFollowersCount !== null ? userProfile.fakeFollowersCount : (userProfile.followers?.length || 0)}
                </span>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                  {t('profile.followers')}
                </span>
              </button>
              <div className="w-px h-12 bg-slate-200 dark:bg-slate-800" />
              <button 
                onClick={() => setUsersModal({ type: 'following', title: 'Підписки', userIds: userProfile.following || [] })}
                className="group flex flex-col items-center"
              >
                <span className="text-4xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                  {userProfile.fakeFollowingCount !== undefined && userProfile.fakeFollowingCount !== null ? userProfile.fakeFollowingCount : (userProfile.following?.length || 0)}
                </span>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                  {t('profile.following')}
                </span>
              </button>
            </div>

            {!isOwnProfile && (
              <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                <button
                  onClick={handleFollow}
                  className={`flex-1 md:flex-none px-10 py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.1em] transition-all ${
                    userProfile.followers?.includes(user.uid)
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_8px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.5)] -translate-y-1 hover:-translate-y-2'
                  }`}
                >
                  {userProfile.followers?.includes(user.uid) ? t('profile.unfollow') : t('profile.follow')}
                </button>
              </div>
            )}
          </motion.div>

          {/* Channel Section */}
          {userChannels.length > 0 && (
            <div className="pt-6 px-2">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-wider">Канали</h2>
                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold shadow-sm">
                  {userChannels[0].subscribers?.length || 0} підписників
                </span>
              </div>
              <button 
                onClick={() => window.location.href = `/channel/${userChannels[0].id}`}
                className="w-full flex items-center gap-4 p-4 rounded-[1.25rem] bg-white dark:bg-[#111] border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#111]/80 transition-colors shadow-2xl text-left group"
              >
                <div className="w-14 h-14 rounded-[1rem] overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 shadow-sm">
                  {userChannels[0].imageUrl ? (
                    <img src={userChannels[0].imageUrl} alt={userChannels[0].name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-black text-slate-400">
                      {userChannels[0].name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[15px] text-slate-900 dark:text-white truncate flex items-center gap-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {userChannels[0].name}
                    {userChannels[0].isVerified && <VerifiedBadge className="w-4 h-4" />}
                  </h3>
                  <p className="text-[13px] text-slate-500 truncate mt-0.5">{userChannels[0].description || 'Немає опису'}</p>
                </div>
              </button>
            </div>
          )}

          {/* Info Section */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start px-2">
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#151515] border border-slate-100 dark:border-slate-800/80 px-4 py-2.5 rounded-[1rem] shadow-sm">
              <Mail className="w-4 h-4 text-indigo-500" />
              <span className="text-[13px] font-medium">{userProfile.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#151515] border border-slate-100 dark:border-slate-800/80 px-4 py-2.5 rounded-[1rem] shadow-sm">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-[13px] font-medium">
                {userProfile.createdAt ? format(userProfile.createdAt.toDate(), 'dd MMMM yyyy', { locale: uk }) : 'Невідомо'}
              </span>
            </div>
          </div>

          <div className="mt-6 px-2">
            {isEditingDescription ? (
              <div className="space-y-3">
                <textarea
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full p-4 rounded-[1.25rem] bg-white dark:bg-[#111] border border-slate-200 dark:border-white/5 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-[14px] resize-none outline-none transition-all shadow-inner"
                  placeholder="Розкажіть про себе..."
                  rows={3}
                  maxLength={500}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleDescriptionUpdate}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
                  >
                    Зберегти
                  </button>
                  <button
                    onClick={() => setIsEditingDescription(false)}
                    className="px-6 py-2.5 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            ) : (
              <div className="group relative">
                <p className="text-[14px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {userProfile.description || (isOwnProfile ? 'Додати опис профілю...' : 'Опис відсутній')}
                </p>
                {isOwnProfile && (!userProfile?.isFrozen || !userProfile?.frozenFeatures?.includes('profile_edit')) && (
                  <button
                    onClick={() => {
                      setDescriptionInput(userProfile.description || '');
                      setIsEditingDescription(true);
                    }}
                    className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 text-indigo-500 hover:text-indigo-600 text-xs font-bold bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur transition-all"
                  >
                    Редагувати
                  </button>
                )}
              </div>
            )}
          </div>
            
            {!userProfile.isVerified && isOwnProfile && (!userProfile?.isFrozen || !userProfile?.frozenFeatures?.includes('verification')) && (
              <div className="mt-4">
                {myVerificationRequest ? (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                    myVerificationRequest.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    myVerificationRequest.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    <ShieldCheck className="w-4 h-4" />
                    Статус верифікації: {
                      myVerificationRequest.status === 'pending' ? 'В обробці' :
                      myVerificationRequest.status === 'rejected' ? 'Відхилено' : 'Невідомо'
                    }
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsVerificationModalOpen(true)}
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Подати заявку на верифікацію
                  </button>
                )}
              </div>
            )}

            {isOwnProfile && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 px-2">
                <button 
                  onClick={() => window.location.href = '/settings'}
                  className="group flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111] hover:bg-slate-50 dark:hover:bg-[#0a0a0a] rounded-[1.5rem] p-6 transition-all border border-slate-100 dark:border-white/5 shadow-2xl hover:-translate-y-1"
                >
                  <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <Settings className="w-5 h-5 text-indigo-500" />
                  </div>
                  <span className="font-bold text-[13px] text-slate-700 dark:text-slate-300 text-center">Налаштування</span>
                </button>
                <button 
                  onClick={handleInstallClick}
                  className="group flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111] hover:bg-slate-50 dark:hover:bg-[#0a0a0a] rounded-[1.5rem] p-6 transition-all border border-slate-100 dark:border-white/5 shadow-2xl hover:-translate-y-1"
                >
                  <div className="w-12 h-12 rounded-[1rem] bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <Download className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="font-bold text-[13px] text-slate-700 dark:text-slate-300 text-center">Встановити додаток</span>
                </button>
                <button 
                  onClick={() => setIsAppUpdateModalOpen(true)}
                  className="group flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111] hover:bg-slate-50 dark:hover:bg-[#0a0a0a] rounded-[1.5rem] p-6 transition-all border border-slate-100 dark:border-white/5 shadow-2xl hover:-translate-y-1"
                >
                  <div className="w-12 h-12 rounded-[1rem] bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="font-bold text-[13px] text-slate-700 dark:text-slate-300 text-center">Оновлення застосунку</span>
                </button>
                <button 
                  onClick={() => logOut()}
                  className="group flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111] hover:bg-red-50 dark:hover:bg-red-500/5 rounded-[1.5rem] p-6 transition-all border border-slate-100 dark:border-white/5 shadow-2xl hover:-translate-y-1 hover:border-red-100 dark:hover:border-red-900/30"
                >
                  <div className="w-12 h-12 rounded-[1rem] bg-red-50 dark:bg-red-500/10 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <LogOut className="w-5 h-5 text-red-500" />
                  </div>
                  <span className="font-bold text-[13px] text-red-600 dark:text-red-400 text-center">Вийти з акаунта</span>
                </button>
              </div>
            )}

            <SummerItemDisplay section="profile" isAdmin={isAdmin} />

          </div>

      {/* Activity History Section */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-[2.5rem] p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
        <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-900 dark:text-white uppercase tracking-wider">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
            <Calendar className="w-5 h-5 text-indigo-500" />
          </div>
          Історія дій
        </h2>
        
        {userActivity.length > 0 ? (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
            {userActivity.slice(0, 10).map((activity) => (
              <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-[#1A1A1A] bg-slate-200 dark:bg-slate-700 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors group-hover:bg-indigo-500 group-hover:text-white dark:group-hover:bg-indigo-500">
                  {activity.type === 'topic' ? <MessageCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </div>
                
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-slate-50 dark:bg-[#151515] border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_rgb(0,0,0,0.02)] dark:shadow-none hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {activity.type === 'topic' ? 'Створено тему' : 'Написано повідомлення'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {activity.createdAt ? formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true, locale: uk }) : 'Невідомо'}
                      </span>
                      {isOwnProfile && (
                        <button 
                          onClick={() => handleDeleteActivity(activity.id, activity.type)}
                          className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Видалити"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[14px] leading-relaxed text-slate-700 dark:text-slate-300 line-clamp-2">
                    {activity.type === 'topic' ? activity.title : activity.text}
                  </p>
                </div>
              </div>
            ))}
            {userActivity.length > 10 && (
              <p className="text-center text-[13px] font-bold text-slate-400 uppercase tracking-wider pt-6">
                Показано останні 10 дій
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-medium">Немає активності</p>
          </div>
        )}
      </div>

      {selectedGift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedGift(null)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div 
              className="h-48 relative flex items-center justify-center"
              style={{ backgroundColor: selectedGift.giftDetails?.backgroundColor }}
            >
              <button 
                onClick={() => setSelectedGift(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img src={selectedGift.giftDetails?.imageUrl} alt={selectedGift.giftDetails?.name} className="w-32 h-32 object-contain drop-shadow-2xl" />
              <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-bold text-white bg-black/30 backdrop-blur-md">
                {selectedGift.giftDetails?.rarity}
              </div>
            </div>
            
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{selectedGift.giftDetails?.name}</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedGift.giftDetails?.model && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-300 rounded-lg text-xs">
                    Модель: {selectedGift.giftDetails?.model}
                  </span>
                )}
                {selectedGift.giftDetails?.symbol && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-300 rounded-lg text-xs">
                    Символ: {selectedGift.giftDetails?.symbol}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Отримано: {selectedGift.receivedAt ? format(selectedGift.receivedAt.toDate(), 'dd MMMM yyyy, HH:mm', { locale: uk }) : 'Невідомо'}
                </div>
                {(isOwnProfile || isAdmin) && (
                  <button
                    onClick={async () => {
                      if (window.confirm('Видалити цей подарунок з профілю?')) {
                        try {
                          await deleteDoc(doc(db, 'users', targetUserId, 'received_gifts', selectedGift.id));
                          setSelectedGift(null);
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `users/${targetUserId}/received_gifts/${selectedGift.id}`);
                        }
                      }
                    }}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-xl transition-colors"
                    title="Видалити подарунок"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isVerificationModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full space-y-4">
            <h2 className="text-xl font-black">Подати заявку на верифікацію</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Галочку можуть отримати лише автори українських телеграм каналів. При подачі заявки ви повинні записати відео, де показуєте, що ви є власником каналу, та пояснити, чому саме вам потрібна галочка.
            </p>
            <input type="email" placeholder="Gmail" value={gmail} onChange={e => setGmail(e.target.value)} className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <input type="text" placeholder="Посилання на ТГК" value={tgChannel} onChange={e => setTgChannel(e.target.value)} className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <input type="text" placeholder="Посилання на відео-підтвердження" value={videoLink} onChange={e => setVideoLink(e.target.value)} className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="flex gap-4">
              <button onClick={() => setIsVerificationModalOpen(false)} className="flex-1 p-3 rounded-xl bg-slate-200 dark:bg-slate-800">Скасувати</button>
              <button onClick={handleVerificationRequest} disabled={isSubmitting || !gmail || !tgChannel || !videoLink} className="flex-1 p-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50">
                {isSubmitting ? 'Надсилання...' : 'Надіслати'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRoleInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRoleInfo(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black flex items-center gap-2">
              {selectedRoleInfo === 'admin' && <AdminBadge />}
              {selectedRoleInfo === 'moder' && <ModerBadge />}
              {selectedRoleInfo === 'helper' && <HelperBadge />}
              {selectedRoleInfo === 'fake' && <FakeBadge className="w-6 h-6" />}
              {selectedRoleInfo === 'scam' && <ScamBadge className="w-6 h-6" />}
              {selectedRoleInfo === 'ban' && <BanBadge className="w-6 h-6" />}
              Інформація про роль
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {selectedRoleInfo === 'admin' && 'Адміністратор має повний доступ до всіх функцій системи, включаючи управління користувачами, верифікацію та налаштування дашборду.'}
              {selectedRoleInfo === 'moder' && 'Модератор слідкує за порядком у спільноті, може видаляти неприйнятний контент та керувати обговореннями.'}
              {selectedRoleInfo === 'helper' && 'Помічник допомагає новим користувачам освоїтися, відповідає на питання та надає підтримку у спільноті.'}
              {selectedRoleInfo === 'fake' && 'FAKE - Позначає користувачів як не справжніх. Сторінка користувача не є тим, за кого себе він видає.'}
              {selectedRoleInfo === 'scam' && 'SCAM - Користувач був помічений за обманом людей.'}
              {selectedRoleInfo === 'ban' && 'BAN - Акаунт користувача заблоковано за порушення правил.'}
            </p>
            <button onClick={() => setSelectedRoleInfo(null)} className="w-full p-3 rounded-xl bg-slate-200 dark:bg-slate-800 font-bold mt-4">
              Зрозуміло
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center gap-3 text-emerald-500">
            <ShieldCheck className="w-6 h-6" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Заявки на верифікацію</h2>
          </div>
          
          <div className="space-y-4">
            {verificationRequests.map(req => (
              <div key={req.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl gap-4">
                <div>
                  <p className="font-bold">{req.gmail}</p>
                  <p className="text-sm text-slate-500">{req.tgChannel}</p>
                  {req.videoLink && (
                    <a href={req.videoLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
                      Відео-підтвердження
                    </a>
                  )}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => toggleVerification(req.userId, false, req.id)} className="flex-1 md:flex-none p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">Так</button>
                  <button onClick={() => rejectVerification(req.id)} className="flex-1 md:flex-none p-2 bg-red-500/10 text-red-500 rounded-lg">Ні</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 text-emerald-500">
            <ShieldCheck className="w-6 h-6" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Управління користувачами</h2>
          </div>
          
          <input 
            type="file" 
            ref={chevronInputRef} 
            onChange={handleChevronUpdate} 
            accept="image/*" 
            className="hidden" 
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs uppercase tracking-widest">
                  <th className="py-4 px-4 font-bold">Користувач</th>
                  <th className="py-4 px-4 font-bold">Email</th>
                  <th className="py-4 px-4 font-bold">Дата реєстрації</th>
                  <th className="py-4 px-4 font-bold">Роль</th>
                  <th className="py-4 px-4 font-bold">Спонсор</th>
                  <th className="py-4 px-4 font-bold">Шеврон</th>
                  <th className="py-4 px-4 font-bold text-right">Верифікація</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.slice(0, showAllUsers ? allUsers.length : 3).map(user => (
                  <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-4 font-medium flex items-center gap-2">
                      {user.displayName}
                      {user.isVerified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                      {user.chevronUrl && <img src={user.chevronUrl} alt="Chevron" className="w-4 h-4 object-contain" />}
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-sm">{user.email}</td>
                    <td className="py-4 px-4 text-slate-500 text-sm">
                      {user.createdAt ? format(user.createdAt.toDate(), 'dd.MM.yyyy', { locale: uk }) : 'Невідомо'}
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => toggleRole(user.id, user.role)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
                          user.role === 'admin' 
                            ? 'bg-[#FF00FF]/10 text-[#FF00FF] hover:bg-[#FF00FF]/20' 
                            : user.role === 'moder'
                            ? 'bg-[#00FFFF]/10 text-[#00FFFF] hover:bg-[#00FFFF]/20'
                            : user.role === 'helper'
                            ? 'bg-[#FFFF00]/10 text-[#FFFF00] hover:bg-[#FFFF00]/20'
                            : user.role === 'fake'
                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                            : user.role === 'scam'
                            ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
                            : user.role === 'ban'
                            ? 'bg-slate-800 text-red-600 hover:bg-slate-700'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {user.role}
                      </button>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => toggleSponsor(user.id, user.isSponsor || false)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
                          user.isSponsor 
                            ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' 
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {user.isSponsor ? 'Спонсор' : 'Ні'}
                      </button>
                    </td>
                    <td className="py-4 px-4">
                      {user.chevronUrl ? (
                        <div className="flex items-center gap-2">
                          <img src={user.chevronUrl} alt="Chevron" className="w-6 h-6 object-contain" />
                          <button 
                            onClick={() => handleRemoveChevron(user.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Видалити
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedChevronUserId(user.id);
                            chevronInputRef.current?.click();
                          }}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700"
                        >
                          Додати
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => toggleVerification(user.id, user.isVerified)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                          user.isVerified 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-red-500/10 hover:text-red-500' 
                            : 'bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white'
                        }`}
                      >
                        {user.isVerified ? 'Зняти галочку' : 'Видати галочку'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allUsers.length > 3 && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setShowAllUsers(!showAllUsers)}
                  className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {showAllUsers ? 'Показати менше' : `Показати всіх (${allUsers.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {usersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setUsersModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black">{usersModal.title}</h2>
              <button onClick={() => setUsersModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {modalUsers.length > 0 ? (
                modalUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-bold text-sm truncate dark:text-white">{u.displayName}</p>
                        {u.isVerified && <VerifiedBadge className="w-4 h-4 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                    <a 
                      href={`/profile/${u.id}`}
                      onClick={() => setUsersModal(null)}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      Профіль
                    </a>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  {usersModal.userIds.length > 0 ? 'Завантаження...' : 'Список порожній'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
    <AnimatePresence>
      {isEditProfileModalOpen && (
        <EditProfileModal
          onClose={() => setIsEditProfileModalOpen(false)}
          currentDisplayName={userProfile.displayName || ''}
          currentPhotoURL={userProfile.photoURL || ''}
          onSave={handleSaveProfile}
        />
      )}
      {isAppUpdateModalOpen && (
        <AppUpdateModal
          onClose={() => setIsAppUpdateModalOpen(false)}
          isAdmin={isAdmin}
        />
      )}
    </AnimatePresence>
    </>
  );
};
