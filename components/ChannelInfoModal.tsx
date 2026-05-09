import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Users, Image as ImageIcon, FileText, Link as LinkIcon, Music, Shield, Ban, Settings as SettingsIcon } from 'lucide-react';
import { ChannelSettingsModal } from './ChannelSettingsModal';
import { VerifiedBadge } from './VerifiedBadge';
import { AdminBadge } from './AdminBadge';
import { ModerBadge } from './ModerBadge';
import { HelperBadge } from './HelperBadge';
import { FakeBadge } from './FakeBadge';
import { ScamBadge } from './ScamBadge';
import { BanBadge } from './BanBadge';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

interface ChannelInfoModalProps {
  channel: any;
  usersCache: Record<string, any>;
  messages: any[];
  onClose: () => void;
}

export const ChannelInfoModal: React.FC<ChannelInfoModalProps> = ({ channel, usersCache, messages, onClose }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'media' | 'files' | 'links' | 'music' | 'blacklist'>('members');
  const [showSettings, setShowSettings] = useState(false);
  const isAdmin = channel.adminId === auth.currentUser?.uid;

  const mediaMessages = messages.filter(m => m.image);
  const fileMessages = messages.filter(m => m.file); // Assuming file handling is added later
  const linkMessages = messages.filter(m => m.text && m.text.match(/https?:\/\//));
  const musicMessages = messages.filter(m => m.isVoice);

  const handleBanUser = async (userId: string) => {
    console.log('Ban user called:', userId, 'Admin:', isAdmin, 'Channel ID:', channel.id);
    if (!isAdmin || userId === channel.adminId) return;
    try {
      await updateDoc(doc(db, 'channels', channel.id), {
        members: arrayRemove(userId),
        bannedUsers: arrayUnion(userId)
      });
      console.log('Ban user successful');
    } catch (error) {
      console.error('Ban user error:', error);
      handleFirestoreError(error, OperationType.UPDATE, `channels/${channel.id}`);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'channels', channel.id), {
        bannedUsers: arrayRemove(userId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `channels/${channel.id}`);
    }
  };

  const tabs = [
    { id: 'members', label: 'Учасники', icon: Users },
    { id: 'media', label: 'Медіа', icon: ImageIcon },
    { id: 'files', label: 'Файли', icon: FileText },
    { id: 'links', label: 'Посилання', icon: LinkIcon },
    { id: 'music', label: 'Музика', icon: Music },
  ];

  if (isAdmin) {
    tabs.push({ id: 'blacklist', label: 'Чорний список', icon: Ban });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Інформація про канал</h2>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => setShowSettings(true)} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <SettingsIcon className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {showSettings && <ChannelSettingsModal channel={channel} onClose={() => setShowSettings(false)} />}

        <div className="flex overflow-x-auto p-2 gap-2 border-b border-slate-100 dark:border-slate-800 hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'members' && (
            <div className="space-y-3">
              {channel.members?.map((memberId: string) => {
                const user = usersCache[memberId];
                if (!user) return null;
                return (
                  <div key={memberId} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-slate-500">
                            {user.displayName?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900 dark:text-white">{user.displayName || 'Невідомий'}</span>
                          {user.isVerified && <VerifiedBadge className="w-3 h-3" />}
                          {user.role === 'admin' && <AdminBadge className="text-[8px] px-1 py-0.5" />}
                          {user.role === 'moder' && <ModerBadge className="text-[8px] px-1 py-0.5" />}
                          {user.role === 'helper' && <HelperBadge className="text-[8px] px-1 py-0.5" />}
                          {user.role === 'fake' && <FakeBadge className="w-3 h-3" />}
                          {user.role === 'scam' && <ScamBadge className="w-3 h-3" />}
                          {user.role === 'ban' && <BanBadge className="w-3 h-3" />}
                        </div>
                        <span className="text-xs text-slate-500">@{user.handle || user.email?.split('@')[0]}</span>
                      </div>
                    </div>
                    {isAdmin && memberId !== channel.adminId && (
                      <button
                        onClick={() => handleBanUser(memberId)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                        title="Заблокувати"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    {memberId === channel.adminId && (
                      <Shield className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'blacklist' && isAdmin && (
            <div className="space-y-3">
              {(!channel.bannedUsers || channel.bannedUsers.length === 0) ? (
                <div className="text-center text-slate-500 py-8">Чорний список порожній</div>
              ) : (
                channel.bannedUsers.map((userId: string) => {
                  const user = usersCache[userId];
                  if (!user) return null;
                  return (
                    <div key={userId} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-slate-500">
                              {user.displayName?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">{user.displayName || 'Невідомий'}</span>
                          <span className="block text-xs text-slate-500">@{user.handle || user.email?.split('@')[0]}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnbanUser(userId)}
                        className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                      >
                        Розблокувати
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {(activeTab === 'media' || activeTab === 'files' || activeTab === 'links' || activeTab === 'music') && (
            <div className="space-y-2">
              {(activeTab === 'media' ? mediaMessages : 
                activeTab === 'files' ? fileMessages : 
                activeTab === 'links' ? linkMessages : 
                musicMessages).length === 0 ? (
                <div className="text-center text-slate-500 py-12 flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    {activeTab === 'media' && <ImageIcon className="w-8 h-8 text-slate-400" />}
                    {activeTab === 'files' && <FileText className="w-8 h-8 text-slate-400" />}
                    {activeTab === 'links' && <LinkIcon className="w-8 h-8 text-slate-400" />}
                    {activeTab === 'music' && <Music className="w-8 h-8 text-slate-400" />}
                  </div>
                  <p className="font-medium">Тут поки нічого немає</p>
                </div>
              ) : (
                (activeTab === 'media' ? mediaMessages : 
                 activeTab === 'files' ? fileMessages : 
                 activeTab === 'links' ? linkMessages : 
                 musicMessages).map((msg: any) => (
                  <div key={msg.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    {activeTab === 'media' && <img src={msg.image} alt="Media" className="w-full rounded-lg" />}
                    {activeTab === 'links' && <a href={msg.text} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{msg.text}</a>}
                    {activeTab === 'music' && <audio controls src={msg.audioData} className="w-full" />}
                    {activeTab === 'files' && <p>Файл</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
