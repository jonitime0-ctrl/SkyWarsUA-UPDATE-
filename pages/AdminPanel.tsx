import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Search, Save, User, Shield, CheckCircle, Star, Image, Gift, Ban, AlertTriangle } from 'lucide-react';
import { SummerItemDisplay } from '../components/SummerItemDisplay';
import { SummerEventSettings } from '../components/SummerEventSettings';
import { SummerEventAdmin } from '../components/SummerEventAdmin';
import { RouletteAdmin } from '../components/RouletteAdmin';
import { RouletteSettings } from '../components/RouletteSettings';
import { BanBadge } from '../components/BanBadge';
import { MaintenanceSettings } from '../components/MaintenanceSettings';
import { SecuritySettings } from '../components/SecuritySettings';
import { SiteAppearanceSettings } from '../components/SiteAppearanceSettings';
import { UsersListAdmin } from '../components/UsersListAdmin';
import { MassGiftingAdmin } from '../components/MassGiftingAdmin';
import { SkyOperationAdmin } from '../components/SkyOperationAdmin';

const SECTIONS = [
  { id: 'dashboard', name: 'Дашборд' },
  { id: 'community', name: 'Стрічка' },
  { id: 'channel', name: 'Канали' },
  { id: 'ai', name: 'ШІ' },
  { id: 'search', name: 'Пошук' },
  { id: 'event', name: 'Івент' },
  { id: 'aviation', name: 'Авіація' },
  { id: 'notifications', name: 'Сповіщення' },
  { id: 'settings', name: 'Налаштування' },
  { id: 'profile', name: 'Профіль' }
];

const FREEZE_FEATURES = [
  { id: 'gifts', name: 'Подарунки' },
  { id: 'titles', name: 'Титули та звання' },
  { id: 'verification', name: 'Заявка на галочку' },
  { id: 'chat', name: 'Спілкування в чаті' },
  { id: 'profile_edit', name: 'Редагування профілю' },
  { id: 'avatar_upload', name: 'Зміна аватарки' }
];

export const AdminPanel: React.FC = () => {
  const [email, setEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);

  const [editData, setEditData] = useState({
    role: 'user',
    isVerified: false,
    isSponsor: false,
    chevronUrl: '',
    displayName: '',
    description: '',
    blockedSections: [] as string[],
    isFrozen: false,
    freezeReason: '',
    frozenFeatures: [] as string[],
    fakeFollowersCount: null as number | null,
    fakeFollowingCount: null as number | null
  });

  const fetchBannedUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const blocked = users.filter(u => u.role === 'ban' || (u.blockedSections && u.blockedSections.length > 0) || u.isFrozen);
      setBannedUsers(blocked);
    } catch (err) {
      console.error("Error fetching banned users:", err);
    }
  };

  useEffect(() => {
    fetchBannedUsers();
  }, []);

  const handleSearch = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setError('');
    setSuccess('');
    setSearchedUser(null);

    try {
      const q = query(collection(db, 'users'), where('email', '==', email.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const data = userDoc.data();
        setSearchedUser({ id: userDoc.id, ...data });
        setEditData({
          role: data.role || 'user',
          isVerified: data.isVerified || false,
          isSponsor: data.isSponsor || false,
          chevronUrl: data.chevronUrl || '',
          displayName: data.displayName || '',
          description: data.description || '',
          blockedSections: data.blockedSections || [],
          isFrozen: data.isFrozen || false,
          freezeReason: data.freezeReason || '',
          frozenFeatures: data.frozenFeatures || [],
          fakeFollowersCount: data.fakeFollowersCount ?? null,
          fakeFollowingCount: data.fakeFollowingCount ?? null
        });
      } else {
        setError('Користувача з таким email не знайдено.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'users');
      setError('Помилка при пошуку.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!searchedUser) return;
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const userRef = doc(db, 'users', searchedUser.id);
      await updateDoc(userRef, {
        role: editData.role,
        isVerified: editData.isVerified,
        isSponsor: editData.isSponsor,
        chevronUrl: editData.chevronUrl,
        displayName: editData.displayName,
        description: editData.description,
        blockedSections: editData.blockedSections,
        isFrozen: editData.isFrozen,
        freezeReason: editData.freezeReason,
        frozenFeatures: editData.frozenFeatures,
        fakeFollowersCount: editData.fakeFollowersCount,
        fakeFollowingCount: editData.fakeFollowingCount
      });
      setSuccess('Дані користувача успішно оновлено!');
      setSearchedUser({ ...searchedUser, ...editData });
      if (editData.role === 'ban' || (editData.blockedSections && editData.blockedSections.length > 0) || editData.isFrozen) {
        fetchBannedUsers();
      } else {
        setBannedUsers(prev => prev.filter(u => u.id !== searchedUser.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${searchedUser.id}`);
      setError('Помилка при збереженні.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBlockedSection = (sectionId: string) => {
    setEditData(prev => {
      const isBlocked = prev.blockedSections.includes(sectionId);
      if (isBlocked) {
        return { ...prev, blockedSections: prev.blockedSections.filter(id => id !== sectionId) };
      } else {
        return { ...prev, blockedSections: [...prev.blockedSections, sectionId] };
      }
    });
  };

  const toggleFrozenFeature = (featureId: string) => {
    setEditData(prev => {
      const isFrozen = prev.frozenFeatures.includes(featureId);
      if (isFrozen) {
        return { ...prev, frozenFeatures: prev.frozenFeatures.filter(id => id !== featureId) };
      } else {
        return { ...prev, frozenFeatures: [...prev.frozenFeatures, featureId] };
      }
    });
  };

  const handleForceReload = async () => {
    try {
      await setDoc(doc(db, 'systemSettings', 'config'), {
        forceReload: Date.now()
      }, { merge: true });
      setSuccess('Користувачі отримали команду на оновлення.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error("Error in handleForceReload:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'systemSettings/config');
      } catch (e: any) {
        setError(`Помилка при відправці: ${e.message || 'Невідома помилка'}`);
      }
      setTimeout(() => setError(''), 5000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg">
        <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          Системні дії
        </h2>
        <button 
          onClick={handleForceReload}
          className="w-full bg-red-600 hover:bg-red-700 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <AlertTriangle className="w-5 h-5" />
          Примусово оновити всіх користувачів
        </button>
        {success && <div className="mt-4 p-4 bg-green-500/20 text-green-400 rounded-xl">{success}</div>}
        {error && <div className="mt-4 p-4 bg-red-500/20 text-red-400 rounded-xl">{error}</div>}
      </div>

      <SummerItemDisplay section="admin" isAdmin={true} />
      <SummerEventAdmin />
      <RouletteAdmin />
      <SummerEventSettings />
      <RouletteSettings />
      <MaintenanceSettings />
      <SiteAppearanceSettings />
      <SecuritySettings />
      <UsersListAdmin />
      <MassGiftingAdmin />
      <SkyOperationAdmin />
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg">
        <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-500" />
          Панель Адміністратора
        </h2>
        
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Введіть email користувача..."
            className="flex-1 bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading || !email.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            <Search className="w-5 h-5" />
            Знайти
          </button>
        </div>

        {error && <p className="text-red-500 mt-4 text-sm font-medium">{error}</p>}
        {success && <p className="text-green-500 mt-4 text-sm font-medium">{success}</p>}
      </div>

      {searchedUser && (
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg space-y-6">
          <div className="flex items-center gap-4 border-b border-[#E5E5E5] dark:border-[#333] pb-6">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-[#333] overflow-hidden">
              {searchedUser.photoURL ? (
                <img src={searchedUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-4 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                {searchedUser.displayName}
                {editData.role === 'ban' && <BanBadge className="w-5 h-5" />}
              </h3>
              <p className="text-sm text-gray-500">{searchedUser.email}</p>
              <p className="text-xs text-gray-400 mt-1">ID: {searchedUser.id}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Ім'я користувача</label>
              <input
                type="text"
                value={editData.displayName}
                onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl px-4 py-3 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Опис (Біо) - Причина бану</label>
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                placeholder="Якщо користувач заблокований, вкажіть причину тут..."
                className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl px-4 py-3 outline-none resize-none h-24"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Роль</label>
              <select
                value={editData.role}
                onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl px-4 py-3 outline-none"
              >
                <option value="user">User</option>
                <option value="helper">Helper</option>
                <option value="moder">Moderator</option>
                <option value="admin">Admin</option>
                <option value="fake">Fake</option>
                <option value="scam">Scam</option>
                <option value="ban">Banned</option>
              </select>
            </div>

            {editData.role === 'ban' && (
              <div className="space-y-2 bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30">
                <label className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
                  <Ban className="w-4 h-4" />
                  Заблоковані розділи
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SECTIONS.map(section => (
                    <label key={section.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white dark:hover:bg-[#222] rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={editData.blockedSections.includes(section.id)}
                        onChange={() => toggleBlockedSection(section.id)}
                        className="w-4 h-4 rounded text-red-500 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium">{section.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-200 dark:border-blue-900/30">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={editData.isFrozen}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setEditData(prev => ({ 
                      ...prev, 
                      isFrozen: isChecked,
                      frozenFeatures: (isChecked && prev.frozenFeatures.length === 0) ? FREEZE_FEATURES.map(f => f.id) : prev.frozenFeatures
                    }));
                  }}
                  className="w-5 h-5 rounded text-blue-500"
                />
                <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                  <Shield className="w-5 h-5" />
                  Заморозити акаунт (Обмеження функцій)
                </span>
              </label>

              {editData.isFrozen && (
                <div className="space-y-4 pl-7">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Причина заморозки (бачить користувач)</label>
                    <textarea
                      value={editData.freezeReason}
                      onChange={(e) => setEditData({ ...editData, freezeReason: e.target.value })}
                      placeholder="Порушення правил..."
                      className="w-full bg-white dark:bg-[#111] border border-blue-200 dark:border-blue-900/30 rounded-xl px-4 py-3 outline-none min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500 block mb-2">Обмежені функції:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {FREEZE_FEATURES.map(feature => (
                        <label key={feature.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white dark:hover:bg-[#222] rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={editData.frozenFeatures.includes(feature.id)}
                            onChange={() => toggleFrozenFeature(feature.id)}
                            className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium">{feature.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Кількість підписників (від 1 до 5000, залиште пустим для реальної кількості)</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={editData.fakeFollowersCount === null ? '' : editData.fakeFollowersCount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value);
                    setEditData({ ...editData, fakeFollowersCount: val });
                  }}
                  placeholder="Реальна кількість..."
                  className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Кількість підписок (від 1 до 5000, залиште пустим для реальної кількості)</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={editData.fakeFollowingCount === null ? '' : editData.fakeFollowingCount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value);
                    setEditData({ ...editData, fakeFollowingCount: val });
                  }}
                  placeholder="Реальна кількість..."
                  className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Шеврон (URL)</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="url"
                    value={editData.chevronUrl}
                    onChange={(e) => setEditData({ ...editData, chevronUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl pl-10 pr-4 py-3 outline-none"
                  />
                </div>
                {editData.chevronUrl && (
                  <img src={editData.chevronUrl} alt="Chevron" className="w-12 h-12 rounded-lg object-cover bg-gray-100 dark:bg-[#111]" />
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editData.isVerified}
                  onChange={(e) => setEditData({ ...editData, isVerified: e.target.checked })}
                  className="w-5 h-5 rounded text-blue-500"
                />
                <span className="flex items-center gap-1 font-medium">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  Верифікований
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editData.isSponsor}
                  onChange={(e) => setEditData({ ...editData, isSponsor: e.target.checked })}
                  className="w-5 h-5 rounded text-yellow-500"
                />
                <span className="flex items-center gap-1 font-medium">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Спонсор
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isLoading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 mt-6"
          >
            <Save className="w-5 h-5" />
            Зберегти зміни
          </button>

          <button
            onClick={() => {
              if (window.confirm(`Ви впевнені, що хочете увійти як ${searchedUser.email}? Ви зможете повністю керувати цим акаунтом.`)) {
                localStorage.setItem('impersonatedUserId', searchedUser.id);
                window.location.href = '/';
              }
            }}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white px-6 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 mt-4"
          >
            <User className="w-5 h-5" />
            Увійти як користувач
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg">
        <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2 text-red-500">
          <Ban className="w-6 h-6" />
          Заблоковані користувачі
        </h2>
        {bannedUsers.length === 0 ? (
          <p className="text-gray-500 text-sm">Немає заблокованих користувачів.</p>
        ) : (
          <div className="space-y-4">
            {bannedUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#111] rounded-xl border border-[#E5E5E5] dark:border-[#333]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#333] overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-full h-full p-2 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold">{user.displayName}</h4>
                      {user.role === 'ban' ? (
                        <BanBadge className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-500">Часткове блокування</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEmail(user.email);
                    handleSearch();
                  }}
                  className="text-sm font-bold text-blue-500 hover:text-blue-600"
                >
                  Редагувати
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
