import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Users, Circle, Search, Eye, EyeOff, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  registrationMethod?: string;
}

interface PresenceData {
  state: 'online' | 'offline';
  lastChanged: any;
}

export const UsersListAdmin: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceData>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyOnline, setShowOnlyOnline] = useState(false);

  useEffect(() => {
    // Fetch all users
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData));
      setUsers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Fetch presence data
    const qPresence = query(collection(db, 'presence'));
    const unsubPresence = onSnapshot(qPresence, (snap) => {
      const pData: Record<string, PresenceData> = {};
      snap.docs.forEach(d => {
        pData[d.id] = d.data() as PresenceData;
      });
      setPresence(pData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'presence');
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubPresence();
    };
  }, []);

  const isOnline = (userId: string) => {
    const p = presence[userId];
    if (!p) return false;
    // Consider online if state is online AND lastChanged is within last 5 minutes
    if (p.state === 'online') {
      if (p.lastChanged) {
        const lastChangedDate = p.lastChanged.toDate();
        const now = new Date();
        const diffMinutes = (now.getTime() - lastChangedDate.getTime()) / (1000 * 60);
        return diffMinutes < 5;
      }
      return true;
    }
    return false;
  };

  const getLastSeen = (userId: string) => {
    const p = presence[userId];
    if (!p || !p.lastChanged) return 'Ніколи';
    if (isOnline(userId)) return 'Онлайн';
    
    try {
      return formatDistanceToNow(p.lastChanged.toDate(), { addSuffix: true, locale: uk });
    } catch (e) {
      return 'Невідомо';
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOnline = showOnlyOnline ? isOnline(u.id) : true;
    return matchesSearch && matchesOnline;
  });

  // Sort: online first, then by email
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aOnline = isOnline(a.id);
    const bOnline = isOnline(b.id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return (a.email || '').localeCompare(b.email || '');
  });

  const onlineCount = users.filter(u => isOnline(u.id)).length;

  const exportToCSV = () => {
    const headers = ['ID', 'Email', 'Ім\'я(система)', 'Ім\'я', 'Прізвище', 'Телефон', 'Метод реєстр.', 'Роль', 'Статус', 'Останній візит'];
    const rows = sortedUsers.map(u => [
      u.id, 
      u.email || '', 
      u.displayName || '', 
      u.firstName || '', 
      u.lastName || '', 
      u.phone || '', 
      u.registrationMethod || 'google', 
      u.role || 'user', 
      isOnline(u.id) ? 'Онлайн' : 'Офлайн', 
      getLastSeen(u.id)
    ]);
    
    // Add BOM for Excel utf-8 recognition
    const BOM = "\uFEFF";
    const csvContent = BOM + headers.join(",") + "\n" 
      + rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
        
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-4 text-center">Завантаження користувачів...</div>;

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E5E5E5] dark:border-[#333] shadow-lg space-y-4 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-blue-500">
          <Users className="w-6 h-6" />
          Користувачі ({users.length})
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl border border-green-200 dark:border-green-800/50">
            <Circle className="w-3 h-3 fill-green-500 text-green-500" />
            <span className="text-sm font-bold text-green-600 dark:text-green-400">Онлайн: {onlineCount}</span>
          </div>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl transition-colors border border-blue-200 dark:border-blue-800/50 font-bold text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Вивантажити CSV</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Пошук за email, ім'ям або телефоном..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-100 dark:bg-[#111] border border-[#E5E5E5] dark:border-[#333] rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowOnlyOnline(!showOnlyOnline)}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors shrink-0 ${
            showOnlyOnline 
              ? 'bg-blue-500 hover:bg-blue-600 text-white' 
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-[#111] dark:hover:bg-[#222] text-gray-700 dark:text-gray-300 border border-[#E5E5E5] dark:border-[#333]'
          }`}
        >
          {showOnlyOnline ? (
            <>
              <EyeOff className="w-5 h-5" />
              Показати всіх
            </>
          ) : (
            <>
              <Eye className="w-5 h-5" />
              Тільки онлайн
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-[#E5E5E5] dark:border-[#333] text-sm text-gray-500">
              <th className="pb-3 font-medium">Користувач</th>
              <th className="pb-3 font-medium">Контакти</th>
              <th className="pb-3 font-medium">Роль</th>
              <th className="pb-3 font-medium text-right">Статус</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map(user => {
              const online = isOnline(user.id);
              return (
                <tr key={user.id} className="border-b border-[#E5E5E5] dark:border-[#333] last:border-0 hover:bg-gray-50 dark:hover:bg-[#111] transition-colors">
                  <td className="py-3 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#333] overflow-hidden">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                            {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      {online && (
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#1A1A1A] rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[200px]">
                        {user.displayName || 'Невідомий'}
                        {user.registrationMethod === 'telegram_phone' && (
                          <span title="Авторизовано через телефон" className="text-blue-500 shrink-0">📱</span>
                        )}
                      </span>
                      {user.firstName && <span className="text-xs text-gray-500 truncate block">Реал: {user.firstName} {user.lastName}</span>}
                    </div>
                  </td>
                  <td className="py-3 text-sm">
                    <div className="text-gray-600 dark:text-gray-300 truncate max-w-[150px] sm:max-w-[200px]">{user.email}</div>
                    {user.phone && <div className="text-xs text-gray-500 font-mono mt-0.5">{user.phone}</div>}
                  </td>
                  <td className="py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${
                      user.role === 'admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      user.role === 'moder' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                      user.role === 'helper' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                      user.role === 'ban' ? 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 line-through' :
                      'bg-gray-100 text-gray-600 dark:bg-[#222] dark:text-gray-400'
                    }`}>
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="py-3 text-right text-sm">
                    {online ? (
                      <span className="text-green-500 font-bold">Онлайн</span>
                    ) : (
                      <span className="text-gray-400 text-xs font-medium">Був(ла) {getLastSeen(user.id)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sortedUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  Користувачів не знайдено.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

