import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Search as SearchIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { SummerItemDisplay } from '../components/SummerItemDisplay';

export const Search: React.FC<{ isAdmin?: boolean }> = ({ isAdmin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'), orderBy('displayName'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    };
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const lowerQuery = searchQuery.toLowerCase();
    return users.filter(u => 
      u.displayName?.toLowerCase().includes(lowerQuery) || 
      u.email?.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, users]);

  return (
    <div className="max-w-2xl mx-auto pt-6 px-4 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Знайти</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Шукайте авторів, друзів та інших учасників.</p>
      </div>
      
      <div className="mb-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Введіть ім'я або email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white rounded-[1.25rem] py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 border border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_rgb(0,0,0,0.02)] dark:shadow-none transition-all placeholder:text-slate-400 font-medium"
          />
        </div>
      </div>

      <SummerItemDisplay section="search" isAdmin={isAdmin} />

      {searchQuery.trim() && (
        <div className="space-y-4">
          <h2 className="text-[15px] font-black uppercase tracking-wider text-slate-900 dark:text-white mb-4 ml-1">Результати ({filteredUsers.length})</h2>
          {filteredUsers.length > 0 ? (
            <div className="space-y-3">
              {filteredUsers.map(user => (
                <Link 
                  key={user.id} 
                  to={`/profile/${user.id}`}
                  className="flex items-center gap-4 bg-white dark:bg-[#1a1a1a] p-4 rounded-[1.25rem] border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_rgb(0,0,0,0.02)] dark:shadow-none hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 shadow-sm border border-slate-200 dark:border-slate-700/50">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 font-black text-xl">
                        {user.displayName?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[15px] text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{user.displayName}</h3>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.email}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-white dark:bg-[#1a1a1a] rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_rgb(0,0,0,0.02)] dark:shadow-none">
              <div className="w-16 h-16 bg-slate-50 dark:bg-[#151515] rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                <SearchIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Нічого не знайдено</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Спробуйте змінити запит</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
