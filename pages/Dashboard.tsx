import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon, Target, Zap, AlertTriangle, Trash2, Info, Activity, Users, Radar, MessageSquare, Filter, Search, CreditCard, Bell, ScanLine, Settings2, Save, X, RefreshCw, GripVertical, Layers, Component } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Rnd } from 'react-rnd';
import { AIRFIELDS, STRATEGIC_AIRFIELDS } from '../constants';
import { BallisticDirection } from '../types';
import { AirfieldCard } from '../components/AirfieldCard';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, setDoc, collection, addDoc, serverTimestamp, deleteDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';

import { SummerItemDisplay } from '../components/SummerItemDisplay';
import { DailyRoulette } from '../components/DailyRoulette';
import { SupportWidget } from '../components/SupportPhone';
import { TargetReporterMap } from '../components/TargetReporterMap';

export const Dashboard: React.FC<{ isAdmin: boolean, user?: any }> = ({ isAdmin, user }) => {
  const navigate = useNavigate();
  const DEFAULT_WIDGET_ORDER = ['ballistic', 'shahed', 'strategic', 'airfields', 'situation', 'map_reporter', 'map_iframes', 'admin_stats', 'admin_log'];
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [glassOpacity, setGlassOpacity] = useState(80);
  const [glassBlur, setGlassBlur] = useState(16);
  const [widgetPositions, setWidgetPositions] = useState<any[]>(() => {
    const saved = localStorage.getItem('canvasPositions');
    if (saved) {
      try { return JSON.parse(saved); } catch(e){ console.error(e); }
    }
    return [
      { id: 'ballistic', x: 20, y: 80, width: 350, height: 'auto' },
      { id: 'shahed', x: 390, y: 80, width: 350, height: 'auto' },
      { id: 'strategic', x: 760, y: 80, width: 350, height: 'auto' },
      { id: 'airfields', x: 20, y: 400, width: 350, height: 'auto' },
      { id: 'situation', x: 390, y: 400, width: 350, height: 'auto' },
      { id: 'map_reporter', x: 760, y: 400, width: 350, height: 'auto' },
      { id: 'map_iframes', x: 20, y: 650, width: 720, height: 'auto' },
      { id: 'admin_stats', x: 760, y: 650, width: 350, height: 'auto' },
      { id: 'admin_log', x: 20, y: 900, width: 720, height: 'auto' }
    ];
  });
  
  const renderCanvasWidget = (id: string, content: React.ReactNode) => {
    if (!isCanvasMode) return <React.Fragment key={id}>{content}</React.Fragment>;
    
    const posIndex = widgetPositions.findIndex(w => w.id === id);
    if (posIndex === -1) return null;
    const pos = widgetPositions[posIndex];
    
    return (
      <Rnd
        key={id}
        bounds="parent"
        position={{ x: pos.x, y: pos.y }}
        size={{ width: pos.width, height: pos.height }}
        onDragStop={(e, d) => {
            const newPos = [...widgetPositions];
            newPos[posIndex] = { ...newPos[posIndex], x: d.x, y: d.y };
            setWidgetPositions(newPos);
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
            const newPos = [...widgetPositions];
            newPos[posIndex] = {
              ...newPos[posIndex],
              width: ref.style.width,
              height: ref.style.height,
              ...position,
            };
            setWidgetPositions(newPos);
        }}
        dragHandleClassName="widget-drag-handle"
        className="absolute z-10"
      >
        <div className="w-full h-full relative group">
           <div className="widget-drag-handle absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-8 bg-indigo-500/80 rounded-t-xl cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center justify-center backdrop-blur-md shadow-md text-white">
             <GripVertical className="w-5 h-5" />
           </div>
           {content}
        </div>
      </Rnd>
    );
  };
  

  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
      try { setWidgetOrder(JSON.parse(savedLayout)); } catch(e){ console.error(e); }
    }
    const savedDesign = localStorage.getItem('dashboardDesign');
    if (savedDesign) {
      try { 
        const d = JSON.parse(savedDesign); 
        setGlassOpacity(d.opacity || 80);
        setGlassBlur(d.blur || 16);
      } catch(e){ console.error(e); }
    }
  }, []);

  const saveLayout = () => {
    localStorage.setItem('dashboardLayout', JSON.stringify(widgetOrder));
    localStorage.setItem('dashboardDesign', JSON.stringify({ opacity: glassOpacity, blur: glassBlur }));
    localStorage.setItem('canvasPositions', JSON.stringify(widgetPositions));
    setIsEditMode(false);
  };

  const resetLayout = () => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    setGlassOpacity(80);
    setGlassBlur(16);
    localStorage.removeItem('dashboardLayout');
    localStorage.removeItem('dashboardDesign');
    setIsEditMode(false);
  };

  const [markedAirfields, setMarkedAirfields] = useState<Set<string>>(new Set());
  const [activeStrategicAirfields, setActiveStrategicAirfields] = useState<string[]>([]);
  const [ballisticDirs, setBallisticDirs] = useState<string[]>([]);
  const [shahedThreats, setShahedThreats] = useState<string[]>([]);
  const [radioStatus, setRadioStatus] = useState<string>('НЕ АКТИВНІ');
  const [fleetStatus, setFleetStatus] = useState<string>('В МОРІ НЕ ПЕРЕБУВАЄ');
  const [strategicStatus, setStrategicStatus] = useState<string>('МІНІМАЛЬНА');
  const [tacticalStatus, setTacticalStatus] = useState<string>('АКТИВНА');
  const [threatHistory, setThreatHistory] = useState<any[]>([]);
  const [situationUpdates, setSituationUpdates] = useState<any[]>([]);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [stats, setStats] = useState({ users: 0, topics: 0, messages: 0 });
  const [userProfile, setUserProfile] = useState<any>(null);
  const { t, language } = useLanguage();

  // Listen to user profile
  useEffect(() => {
    if (user?.uid && !user.isGuest) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      });
      return () => unsub();
    }
  }, [user]);

  const [activeTab, setActiveTab] = useState<'current' | 'possible'>(isAdmin ? 'possible' : 'current');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    ballistic: true,
    shahed: true,
    strategic: true,
    airfields: true,
    status: true,
    situation: true
  });

  useEffect(() => {
    if (isAdmin) {
      setActiveTab('possible');
    }
  }, [isAdmin]);

  const sessionId = useMemo(() => {
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    const existing = localStorage.getItem('chat_session_id');
    if (existing) return existing;
    const newId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('chat_session_id', newId);
    return newId;
  }, []);

  // Presence Tracker
  useEffect(() => {
    const presenceRef = doc(db, 'presence', sessionId);
    const updatePresence = async () => {
      try {
        await setDoc(presenceRef, {
          lastActive: serverTimestamp(),
          role: isAdmin ? 'admin' : 'viewer',
          userAgent: navigator.userAgent.substring(0, 250)
        }, { merge: true });
      } catch (e) {
        // ignore
      }
    };
    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    
    const handleUnload = () => {
      deleteDoc(presenceRef).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [isAdmin, sessionId]);

  // Listen to Active Users and Stats (Admin only)
  useEffect(() => {
    if (!isAdmin) return;
    const twoMinsAgo = new Date(Date.now() - 2 * 60000);
    const q = query(collection(db, 'presence'), where('lastActive', '>', twoMinsAgo));
    const unsubscribePresence = onSnapshot(q, (snap) => {
      setActiveUsers(snap.size);
    }, (error) => console.error("Error fetching presence", error));

    const fetchStats = async () => {
      try {
        const { getDocs } = await import('firebase/firestore');
        const usersSnap = await getDocs(collection(db, 'users'));
        const topicsSnap = await getDocs(collection(db, 'topics'));
        const messagesSnap = await getDocs(collection(db, 'messages'));
        setStats({
          users: usersSnap.size,
          topics: topicsSnap.size,
          messages: messagesSnap.size
        });
      } catch (error) {
        console.error("Error fetching stats", error);
      }
    };
    fetchStats();

    return () => unsubscribePresence();
  }, [isAdmin]);

  // Listen to Threats
  useEffect(() => {
    const q = query(collection(db, 'threats'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const threats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setThreatHistory(threats);
    }, (error) => console.error("Error fetching threats", error));
    return () => unsubscribe();
  }, []);

  // Listen to Situation Updates
  useEffect(() => {
    const q = query(collection(db, 'situationUpdates'), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snap) => {
      const updates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSituationUpdates(updates);
    }, (error) => console.error("Error fetching situation updates", error));
    return () => unsubscribe();
  }, []);

  // Scheduled updates check logic
  useEffect(() => {
    const checkScheduledUpdate = () => {
      const scheduledTime = localStorage.getItem('scheduledAppUpdate');
      const targetVersion = localStorage.getItem('scheduledAppUpdateVersion');
      
      if (scheduledTime && targetVersion) {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        
        const [scheduledHoursStr, scheduledMinutesStr] = scheduledTime.split(':');
        const scheduledHours = parseInt(scheduledHoursStr, 10);
        const scheduledMinutes = parseInt(scheduledMinutesStr, 10);

        // If current time is equal to or past scheduled time today
        // (This is rudimentary, but it works for "overnight" if they keep it open)
        if (currentHours > scheduledHours || (currentHours === scheduledHours && currentMinutes >= scheduledMinutes)) {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              for(const registration of registrations) {
                registration.unregister();
              }
            });
          }
          localStorage.setItem('lastInstalledAppVersion', targetVersion);
          localStorage.removeItem('scheduledAppUpdate');
          localStorage.removeItem('scheduledAppUpdateVersion');
          window.location.reload(true);
        }
      }
    };

    // Check periodically
    const interval = setInterval(checkScheduledUpdate, 60000); // Check every minute
    checkScheduledUpdate(); // Initial check

    return () => clearInterval(interval);
  }, []);

  const logThreat = async (type: string, message: string) => {
    if (!isAdmin) return;
    try {
      await addDoc(collection(db, 'threats'), {
        type,
        message,
        authorEmail: user?.email || 'Невідомо',
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to log threat", e);
    }
  };

  const deleteThreat = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'threats', id));
    } catch (e) {
      console.error("Failed to delete threat", e);
    }
  };

  useEffect(() => {
    const statusRef = doc(db, 'dashboard', 'status');
    const unsubscribe = onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.markedAirfields) {
          setMarkedAirfields(new Set(data.markedAirfields));
        }
        if (data.ballisticDirs) {
          setBallisticDirs(data.ballisticDirs);
        } else if (data.ballisticDir && data.ballisticDir !== 'None') {
          setBallisticDirs([data.ballisticDir]);
        } else {
          setBallisticDirs([]);
        }
        if (data.shahedThreats) {
          setShahedThreats(data.shahedThreats);
        } else {
          setShahedThreats([]);
        }
        if (data.activeStrategicAirfields) {
          setActiveStrategicAirfields(data.activeStrategicAirfields);
        } else {
          setActiveStrategicAirfields([]);
        }
        if (data.radioStatus) setRadioStatus(data.radioStatus);
        if (data.fleetStatus) setFleetStatus(data.fleetStatus);
        if (data.strategicStatus) setStrategicStatus(data.strategicStatus);
        if (data.tacticalStatus) setTacticalStatus(data.tacticalStatus);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'dashboard/status');
    });
    return () => unsubscribe();
  }, []);

  const updateStatusInDb = useCallback(async (updates: Partial<any>) => {
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, 'dashboard', 'status'), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'dashboard/status');
    }
  }, [isAdmin]);

  const handleToggleAirfield = useCallback((id: string) => {
    if (!isAdmin) return;
    const next = new Set(markedAirfields);
    const airfieldName = AIRFIELDS.find(a => a.id === id)?.name || id;
    let action = '';
    if (next.has(id)) {
      next.delete(id);
      action = 'Відбій активності';
    } else {
      next.add(id);
      action = 'Активність';
    }
    setMarkedAirfields(next);
    updateStatusInDb({ markedAirfields: Array.from(next) });
    logThreat('airfield', `${action}: ${airfieldName}`);
  }, [isAdmin, markedAirfields, updateStatusInDb]);

  const handleToggleBallisticDir = useCallback((dir: string) => {
    if (!isAdmin) return;
    
    let newDirs = [...ballisticDirs];
    
    if (dir === 'None') {
      newDirs = [];
      logThreat('info', `Відбій загрози балістики`);
    } else {
      if (newDirs.includes(dir)) {
        newDirs = newDirs.filter(d => d !== dir);
        logThreat('info', `Відбій загрози балістики: ${dir}`);
      } else {
        newDirs.push(dir);
        logThreat('ballistic', `Загроза балістики: ${dir}`);
      }
    }
    
    setBallisticDirs(newDirs);
    updateStatusInDb({ ballisticDirs: newDirs });
  }, [isAdmin, ballisticDirs, updateStatusInDb]);

  const handleResetAirfields = useCallback(() => {
    if (!isAdmin) return;
    setMarkedAirfields(new Set());
    updateStatusInDb({ markedAirfields: [] });
    logThreat('info', `Скинуто всі активності аеродромів`);
  }, [isAdmin, updateStatusInDb]);

  const handleStatusClick = useCallback((type: 'radio' | 'fleet' | 'strategic' | 'tactical') => {
    if (!isAdmin) return;
    
    const radioStatuses = ['НЕ АКТИВНІ', 'МІНІМАЛЬНА', 'АКТИВНІ'];
    const aviationStatuses = ['НЕ АКТИВНА', 'МІНІМАЛЬНА', 'АКТИВНА'];
    const fleetStatuses = ['В МОРІ НЕ ПЕРЕБУВАЄ', 'В МОРІ ПЕРЕБУВАЄ'];
    
    if (type === 'radio') {
      const next = radioStatuses[(radioStatuses.indexOf(radioStatus) + 1) % radioStatuses.length];
      setRadioStatus(next);
      updateStatusInDb({ radioStatus: next });
      logThreat('info', `Статус радіочастот: ${next}`);
    } else if (type === 'fleet') {
      const next = fleetStatuses[(fleetStatuses.indexOf(fleetStatus) + 1) % fleetStatuses.length];
      setFleetStatus(next);
      updateStatusInDb({ fleetStatus: next });
      logThreat('info', `Статус флоту: ${next}`);
    } else if (type === 'strategic') {
      const next = aviationStatuses[(aviationStatuses.indexOf(strategicStatus) + 1) % aviationStatuses.length];
      setStrategicStatus(next);
      updateStatusInDb({ strategicStatus: next });
      logThreat('info', `Статус стратегічної авіації: ${next}`);
    } else if (type === 'tactical') {
      const next = aviationStatuses[(aviationStatuses.indexOf(tacticalStatus) + 1) % aviationStatuses.length];
      setTacticalStatus(next);
      updateStatusInDb({ tacticalStatus: next });
      logThreat('info', `Статус тактичної авіації: ${next}`);
    }
  }, [isAdmin, radioStatus, fleetStatus, strategicStatus, tacticalStatus, updateStatusInDb]);

  const handleToggleShahedThreat = useCallback((region: string) => {
    if (!isAdmin) return;
    
    let newShaheds = [...shahedThreats];
    
    if (region === 'None') {
      newShaheds = [];
      logThreat('info', `Відбій загрози БПЛА`);
    } else {
      if (newShaheds.includes(region)) {
        newShaheds = newShaheds.filter(r => r !== region);
        logThreat('info', `Відбій загрози БПЛА: ${region}`);
      } else {
        newShaheds.push(region);
        logThreat('shahed', `Загроза БПЛА (Шахеди): ${region}`);
      }
    }
    
    setShahedThreats(newShaheds);
    updateStatusInDb({ shahedThreats: newShaheds });
  }, [isAdmin, shahedThreats, updateStatusInDb]);

  const handleToggleStrategicAirfield = useCallback((id: string) => {
    if (!isAdmin) return;
    let next: string[];
    if (id === 'None') {
      next = [];
      logThreat('info', 'Відбій активності стратегічної авіації');
    } else if (id === 'All') {
      next = STRATEGIC_AIRFIELDS.map(a => a.id);
      logThreat('airfield', 'Активність стратегічної авіації: Всі аеродроми');
    } else {
      if (activeStrategicAirfields.includes(id)) {
        next = activeStrategicAirfields.filter(a => a !== id);
        logThreat('info', `Відбій активності: ${STRATEGIC_AIRFIELDS.find(a => a.id === id)?.name}`);
      } else {
        next = [...activeStrategicAirfields, id];
        logThreat('airfield', `Активність: ${STRATEGIC_AIRFIELDS.find(a => a.id === id)?.name}`);
      }
    }
    setActiveStrategicAirfields(next);
    updateStatusInDb({ activeStrategicAirfields: next });
  }, [isAdmin, activeStrategicAirfields, updateStatusInDb]);

  const getStatusColor = useCallback((status: string) => {
    if (status === 'НЕ АКТИВНІ' || status === 'В МОРІ НЕ ПЕРЕБУВАЄ' || status === 'НЕ АКТИВНА') return 'text-emerald-500';
    if (status === 'МІНІМАЛЬНА') return 'text-yellow-500';
    if (status === 'АКТИВНІ' || status === 'АКТИВНА' || status === 'В МОРІ ПЕРЕБУВАЄ') return 'text-red-500';
    return 'text-slate-500';
  }, []);

  const directions: { label: string, value: BallisticDirection }[] = useMemo(() => [
    { label: 'Курська, Брянська, Бєлгородська області', value: 'Курська, Брянська, Бєлгородська області' },
    { label: 'Луганська, Донецька, Запорізька область', value: 'Луганська, Донецька, Запорізька область' },
    { label: 'Крим, Херсонська області', value: 'Крим, Херсонська області' },
    { label: 'Чауда (Крим), полігон Капустин Яр', value: 'Чауда (Крим), полігон Капустин Яр' },
    { label: 'Відбій', value: 'None' }
  ], []);

  const shahedAirfields = useMemo(() => [
    { label: 'Приморсько-Ахтарськ (Краснодарський край)', value: 'Приморсько-Ахтарськ' },
    { label: 'Брянська область (напр., Навля)', value: 'Брянська область' },
    { label: 'Курська область (напр., Халіно)', value: 'Курська область' },
    { label: 'Смоленська область (аеродром Шаталово)', value: 'Смоленська область' },
    { label: 'Миллерово (Ростовська область)', value: 'Миллерово' },
    { label: 'Тимчасово окупований Донецьк', value: 'Тимчасово окупований Донецьк' },
  ], []);

  const mapsList = useMemo(() => [
    { id: 'alarm', icon: MapIcon, title: 'Карта Тривог', src: 'https://map.ukrainealarm.com/' },
    { id: 'dimap', icon: Target, title: 'Рух цілей | DIMAP', src: 'https://dimap.live/' }
  ], []);

  const ballisticRef = React.useRef<HTMLElement>(null);
  const shahedRef = React.useRef<HTMLElement>(null);
  const strategicRef = React.useRef<HTMLElement>(null);
  const airfieldsRef = React.useRef<HTMLElement>(null);
  const situationRef = React.useRef<HTMLElement>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const q = query.toLowerCase();
    if (!q) return;
    
    // Switch to possible tab to ensure all sections are visible for search
    if (activeTab !== 'possible') {
      setActiveTab('possible');
    }

    // Use setTimeout to allow React to render the sections before scrolling
    setTimeout(() => {
      if ('балістика'.includes(q) || 'напрямок'.includes(q)) {
        ballisticRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if ('шахед'.includes(q) || 'бпла'.includes(q)) {
        shahedRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if ('стратегічна'.includes(q) || 'авіація'.includes(q) || 'ту-'.includes(q)) {
        strategicRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if ('аеродром'.includes(q) || 'майданчик'.includes(q)) {
        airfieldsRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if ('ситуація'.includes(q) || 'статус'.includes(q)) {
        situationRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const renderedAirfields = useMemo(() => {
    return AIRFIELDS.map(airfield => (
      <AirfieldCard 
        key={airfield.id}
        airfield={airfield}
        isMarked={markedAirfields.has(airfield.id)}
        onToggle={handleToggleAirfield}
        isAdmin={isAdmin}
      />
    ));
  }, [markedAirfields, handleToggleAirfield, isAdmin]);

  const renderedMaps = useMemo(() => {
    return mapsList.map((map, i) => (
      <motion.div 
        key={i}
        whileHover={{ y: -5 }}
        className="bg-white dark:bg-[#0A0A0A] p-8 rounded-[3rem] border border-[#E5E5E5] dark:border-[#1A1A1A] shadow-xl space-y-6"
      >
        <div className="flex items-center gap-4 text-[#050505] dark:text-white">
          <map.icon className="w-8 h-8" />
          <h2 className="text-2xl font-black uppercase tracking-tighter">{map.title}</h2>
        </div>
        <div className="w-full h-[500px] rounded-3xl overflow-hidden border border-[#E5E5E5] dark:border-[#1A1A1A] bg-[#F4F4F4] dark:bg-[#050505] relative">
          <iframe 
            src={map.src} 
            title={map.title}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
          />
        </div>
      </motion.div>
    ));
  }, [mapsList]);

  const isBallisticActive = ballisticDirs.length > 0;
  const isShahedActive = shahedThreats.length > 0;
  const isStrategicActive = activeStrategicAirfields.length > 0;
  const isAirfieldsActive = markedAirfields.size > 0;
  const isStatusActive = radioStatus !== 'НЕ АКТИВНІ' || fleetStatus !== 'В МОРІ НЕ ПЕРЕБУВАЄ' || strategicStatus !== 'НЕ АКТИВНА' || tacticalStatus !== 'НЕ АКТИВНА';

  const showBallistic = filters.ballistic && (activeTab === 'possible' || isBallisticActive);
  const showShahed = filters.shahed && (activeTab === 'possible' || isShahedActive);
  const showStrategic = filters.strategic && (activeTab === 'possible' || isStrategicActive);
  const showAirfields = filters.airfields && (activeTab === 'possible' || isAirfieldsActive);
  const showSituation = filters.situation && (activeTab === 'possible' || isStatusActive || situationUpdates.length > 0);

  const hasActiveThreats = isBallisticActive || isShahedActive || isStrategicActive || isAirfieldsActive || isStatusActive;

  const hour = new Date().getHours();
  let greetingKey = 'dashboard.evening';
  if (hour >= 5 && hour < 12) greetingKey = 'dashboard.morning';
  else if (hour >= 12 && hour < 18) greetingKey = 'dashboard.afternoon';
  else if (hour >= 18) greetingKey = 'dashboard.evening';

  const showNameEnabled = localStorage.getItem('showNameEnabled') !== 'false';
  const rawName = userProfile?.displayName || user?.displayName || auth.currentUser?.displayName || 'Олеже';
  const userNameComponent = showNameEnabled ? rawName : '';
  const headerInitials = ((name) => {
    if (!name) return 'A';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  })(rawName);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-20"
    >
      <div className="mb-6">
      {/* Super Modern Header Area */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative overflow-hidden bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[3rem] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-100/50 dark:border-white/5"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-fuchsia-500/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-slate-500 dark:text-slate-400 font-bold tracking-[0.2em] uppercase text-[10px] sm:text-[11px] mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                Live Status
              </span>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-3xl sm:text-4xl font-medium text-slate-700 dark:text-white/80">{t(greetingKey)},</span>
                {showNameEnabled && (
                  <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{userNameComponent}</h1>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/notifications')} 
                className="w-12 h-12 flex items-center justify-center rounded-[1.25rem] bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 backdrop-blur-md border border-slate-200/50 dark:border-white/10 transition-all relative text-slate-700 dark:text-white shadow-sm"
              >
                <Bell className="w-5 h-5 opacity-90" />
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] rounded-full border-2 border-transparent box-content" />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/profile')} 
                className="w-12 h-12 rounded-[1.25rem] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-500 font-black text-lg overflow-hidden shadow-sm"
              >
                {userProfile?.photoURL || user?.photoURL || auth.currentUser?.photoURL ? (
                   <img src={userProfile?.photoURL || user?.photoURL || auth.currentUser?.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                   headerInitials
                )}
              </motion.button>
            </div>
          </div>

          <div className="flex items-center gap-3 relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Швидкий пошук загроз..."
              className="w-full bg-slate-100/80 dark:bg-black/20 hover:bg-slate-200/50 dark:hover:bg-black/30 focus:bg-white dark:focus:bg-black/40 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-[1.5rem] pl-14 pr-5 py-4 sm:py-5 text-[15px] sm:text-[17px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-900 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-white/40 shadow-inner"
            />
          </div>
        </div>
      </motion.div>

      <style>{`
        .glass-widget {
          backdrop-filter: blur(${glassBlur}px) !important;
          -webkit-backdrop-filter: blur(${glassBlur}px) !important;
        }
        .dark .glass-widget {
          background-color: rgba(10, 10, 10, ${glassOpacity / 100}) !important;
        }
        html:not(.dark) .glass-widget {
          background-color: rgba(255, 255, 255, ${glassOpacity / 100}) !important;
        }
      `}</style>

      {isEditMode && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] p-6 rounded-3xl w-full max-w-md shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
             <div className="flex justify-between items-center shrink-0">
               <h3 className="text-xl font-black uppercase tracking-widest text-[#050505] dark:text-white flex items-center gap-2">
                 <Settings2 className="w-5 h-5 text-indigo-500" /> Налаштування
               </h3>
             </div>
             
             <div className="overflow-y-auto space-y-6 flex-1 pr-2">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                   <span>Прозорість віджетів</span>
                   <span className="text-indigo-500">{glassOpacity}%</span>
                 </label>
                 <input type="range" min="0" max="100" value={glassOpacity} onChange={(e) => setGlassOpacity(Number(e.target.value))} className="w-full mt-2 accent-indigo-500" />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                   <span>Ефект скла (Blur)</span>
                   <span className="text-indigo-500">{glassBlur}px</span>
                 </label>
                 <input type="range" min="0" max="40" value={glassBlur} onChange={(e) => setGlassBlur(Number(e.target.value))} className="w-full mt-2 accent-indigo-500" />
               </div>

               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Порядок віджетів (Перетягніть для зміни)</label>
                 <Reorder.Group axis="y" values={widgetOrder} onReorder={setWidgetOrder} className="space-y-2">
                    {widgetOrder.map(item => (
                       <Reorder.Item key={item} value={item} className="p-3 bg-slate-100 dark:bg-[#1A1A1A] rounded-xl cursor-grab active:cursor-grabbing flex items-center justify-between border border-slate-200 dark:border-white/5 shadow-sm">
                          <span className="text-sm font-bold uppercase text-slate-700 dark:text-white flex items-center gap-2">
                            <Layers className="w-4 h-4 text-slate-400" />
                            {item === 'ballistic' ? 'Балістика' :
                             item === 'shahed' ? 'БПЛА (Шахеди)' :
                             item === 'strategic' ? 'Авіація рф' :
                             item === 'airfields' ? 'Аеродроми пуску' :
                             item === 'situation' ? 'Ситуація' :
                             item === 'map_reporter' ? 'Карта Радар' :
                             item === 'map_iframes' ? 'Карти (Iframe)' :
                             item === 'admin_stats' ? 'Статистика (Адмін)' : 'Журнал (Адмін)'}
                          </span>
                          <GripVertical className="w-5 h-5 text-slate-400" />
                       </Reorder.Item>
                    ))}
                 </Reorder.Group>
               </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200 dark:border-white/10 shrink-0">
               <button onClick={saveLayout} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-colors">
                 <Save className="w-4 h-4" /> Зберегти
               </button>
               <div className="flex gap-3 flex-1">
                 <button onClick={resetLayout} title="Скинути як було" className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-xl py-3 font-bold flex items-center justify-center transition-colors">
                   <RefreshCw className="w-4 h-4" />
                 </button>
                 <button onClick={() => setIsEditMode(false)} title="Відхилити" className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#1A1A1A] dark:hover:bg-white/10 rounded-xl py-3 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                   <X className="w-4 h-4" />
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-4">
         <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
           <Activity className="w-8 h-8 text-indigo-500" />
           {t('dashboard.threatPanel')}
         </h2>
         <div className="flex items-center gap-2">
           <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCanvasMode(!isCanvasMode)} 
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md backdrop-blur-sm flex items-center gap-2 ${isCanvasMode ? 'bg-indigo-600 text-white shadow-indigo-500/25 border-transparent' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'}`}
            >
              <Component className="w-4 h-4" />
              {isCanvasMode ? 'Стандартний вид' : 'Робочий стіл'}
            </motion.button>
            
            {isCanvasMode && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditMode(true)} 
                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md backdrop-blur-sm flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20`}
              >
                <Settings2 className="w-4 h-4" />
                Налаштування Скла
              </motion.button>
            )}

           <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilter(!showFilter)} 
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md backdrop-blur-sm flex items-center gap-2 ${showFilter ? 'bg-indigo-600 border border-indigo-500 text-white shadow-indigo-500/25' : 'bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'}`}
            >
              <Filter className="w-4 h-4" />
              {t('dashboard.filters')}
            </motion.button>
         </div>
      </div>

      {showFilter && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, value]) => (
            <button 
              key={key}
              onClick={() => setFilters(prev => ({ ...prev, [key]: !prev[key as keyof typeof filters] }))}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors ${value ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
            >
              {key === 'ballistic' ? 'Балістика' : 
               key === 'shahed' ? 'БПЛА' : 
               key === 'strategic' ? 'Авіація' : 
               key === 'airfields' ? 'Аеродроми' : 
               key === 'status' ? 'Статуси' : 'Ситуація'}
            </button>
          ))}
        </motion.div>
      )}

      <div className="flex bg-slate-100/50 dark:bg-white/5 rounded-[1.25rem] p-1.5 shadow-inner border border-slate-200/80 dark:border-white/10 mb-6 relative">
        <motion.button 
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('current')}
          className={`flex-1 py-3.5 sm:py-4 rounded-xl text-[11px] sm:text-[13px] font-black uppercase tracking-[0.1em] transition-all relative z-10 ${
            activeTab === 'current' 
              ? 'text-indigo-600 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {activeTab === 'current' && (
            <motion.div layoutId="activeTabBadge" className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl -z-10 shadow-sm border border-slate-200 dark:border-white/10 backdrop-blur-md" />
          )}
          АКТУАЛЬНІ ЗАГРОЗИ
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('possible')}
          className={`flex-1 py-3.5 sm:py-4 rounded-xl text-[11px] sm:text-[13px] font-black uppercase tracking-[0.1em] transition-all relative z-10 ${
            activeTab === 'possible' 
              ? 'text-indigo-600 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {activeTab === 'possible' && (
            <motion.div layoutId="activeTabBadge" className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl -z-10 shadow-sm border border-slate-200 dark:border-white/10 backdrop-blur-md" />
          )}
          МОЖЛИВІ ЗАГРОЗИ
        </motion.button>
      </div>

      {!isAdmin && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-600/10 border border-blue-600/20 p-6 rounded-3xl flex items-center gap-4 text-blue-600 dark:text-blue-400 backdrop-blur-sm"
        >
          <Info className="w-6 h-6 shrink-0" />
          <p className="text-sm font-bold uppercase tracking-widest">Ви у режимі перегляду. Тільки адмін може змінювати статус загрози.</p>
        </motion.div>
      )}
      </div>

      <div className={isCanvasMode ? "relative w-full h-[1500px] border border-dashed border-indigo-500/30 rounded-3xl" : "flex flex-col gap-6"}>

      {activeTab === 'current' && !hasActiveThreats && (
        <div className="text-center py-12 bg-white dark:bg-[#111] rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Немає актуальних загроз</h2>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">Наразі ситуація спокійна.</p>
        </div>
      )}

      {/* BALLISTIC THREAT */}
      {showBallistic && renderCanvasWidget('ballistic',
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          ref={ballisticRef} 
          style={!isCanvasMode ? { order: widgetOrder.indexOf('ballistic') } : {}}
          className={`bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden group ${isCanvasMode ? 'w-full h-full' : ''}`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[60px] -z-10 group-hover:bg-red-500/20 transition-colors duration-700" />
          
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-[1.25rem] flex items-center justify-center shrink-0 border border-red-100 dark:border-red-500/20 text-red-500">
              <Zap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-[28px] sm:text-[32px] font-black text-slate-900 dark:text-white uppercase leading-none mb-1.5 tracking-tight">Балістика</h2>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-[0.15em] leading-relaxed">Моніторинг загрози з півночі та сходу</p>
            </div>
          </div>
          
          <div className={`rounded-2xl p-4 mb-6 flex items-center justify-center border transition-all ${ballisticDirs.length > 0 ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'}`}>
            <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${ballisticDirs.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {ballisticDirs.length > 0 ? `⚠️ ЗАГРОЗА: ${ballisticDirs.join(', ')}` : 'СТАТУС: СПОКІЙНО'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {directions.filter(d => d.value !== 'None').map(dir => {
              const isActive = ballisticDirs.includes(dir.value);
              return (
                <motion.button
                  whileHover={isAdmin ? { scale: 1.02 } : {}}
                  whileTap={isAdmin ? { scale: 0.98 } : {}}
                  key={dir.value}
                  disabled={!isAdmin}
                  onClick={() => handleToggleBallisticDir(dir.value)}
                  className={`rounded-[1.25rem] py-5 flex flex-col items-center justify-center text-center px-4 transition-all border backdrop-blur-sm ${isActive ? 'bg-red-600/90 border-red-500 text-white shadow-xl shadow-red-500/30' : 'bg-slate-50/50 dark:bg-white/5 border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-slate-300'} ${isAdmin ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/10' : 'cursor-not-allowed opacity-50'}`}
                >
                  <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-widest">{dir.label}</span>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            whileHover={isAdmin ? { scale: 1.02 } : {}}
            whileTap={isAdmin ? { scale: 0.98 } : {}}
            disabled={!isAdmin}
            onClick={() => handleToggleBallisticDir('None')}
            className={`w-full bg-red-600/90 hover:bg-red-500 text-white rounded-[1.25rem] py-4 sm:py-5 text-xs sm:text-[14px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/30 transition-all outline-none border border-red-400/50 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
          >
            ВІДБІЙ ЗАГРОЗИ
          </motion.button>
        </motion.section>
      )}

      {/* SHAHED THREAT */}
      {showShahed && renderCanvasWidget('shahed',
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          ref={shahedRef} 
          style={!isCanvasMode ? { order: widgetOrder.indexOf('shahed') } : {}}
          className={`bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden group ${isCanvasMode ? 'w-full h-full' : ''}`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[60px] -z-10 group-hover:bg-orange-500/20 transition-colors duration-700" />

          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-[1.25rem] flex items-center justify-center shrink-0 border border-orange-100 dark:border-orange-500/20 text-orange-500">
              <Target className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-[28px] sm:text-[32px] font-black text-slate-900 dark:text-white uppercase leading-none mb-1.5 tracking-tight">Шахеди</h2>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-[0.15em] leading-relaxed">Моніторинг загрози ударних БПЛА</p>
            </div>
          </div>
          
          <div className={`rounded-2xl p-4 mb-6 flex items-center justify-center border transition-all ${shahedThreats.length > 0 ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30' : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'}`}>
            <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${shahedThreats.length > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
              {shahedThreats.length > 0 ? `⚠️ ЗАГРОЗА пусків: ${shahedThreats.join(', ')}` : 'СТАТУС: СПОКІЙНО'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {shahedAirfields.map(dir => {
              const isActive = shahedThreats.includes(dir.value);
              return (
                <motion.button
                  whileHover={isAdmin ? { scale: 1.02 } : {}}
                  whileTap={isAdmin ? { scale: 0.98 } : {}}
                  key={dir.value}
                  disabled={!isAdmin}
                  onClick={() => handleToggleShahedThreat(dir.value)}
                  className={`rounded-[1.25rem] py-5 flex flex-col items-center justify-center text-center px-4 transition-all border backdrop-blur-sm ${isActive ? 'bg-orange-500/90 border-orange-500 text-white shadow-xl shadow-orange-500/30' : 'bg-slate-50/50 dark:bg-white/5 border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-slate-300'} ${isAdmin ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/10' : 'cursor-not-allowed opacity-50'}`}
                >
                  <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-widest">{dir.label}</span>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            whileHover={isAdmin ? { scale: 1.02 } : {}}
            whileTap={isAdmin ? { scale: 0.98 } : {}}
            disabled={!isAdmin}
            onClick={() => handleToggleShahedThreat('None')}
            className={`w-full bg-orange-500/90 hover:bg-orange-500 text-white rounded-[1.25rem] py-4 sm:py-5 text-xs sm:text-[14px] font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-500/30 transition-all outline-none border border-orange-400/50 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
          >
            ВІДБІЙ ЗАГРОЗИ
          </motion.button>
        </motion.section>
      )}

      {/* STRATEGIC AVIATION THREAT */}
      {showStrategic && renderCanvasWidget('strategic',
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          ref={strategicRef} 
          style={!isCanvasMode ? { order: widgetOrder.indexOf('strategic') } : {}}
          className={`bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden group ${isCanvasMode ? 'w-full h-full overflow-y-auto' : ''}`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[60px] -z-10 group-hover:bg-purple-500/20 transition-colors duration-700" />

          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-500/10 rounded-[1.25rem] flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Radar className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-[28px] sm:text-[32px] font-black text-slate-900 dark:text-white uppercase leading-none mb-1.5 tracking-tight">Авіація рф</h2>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-[0.15em] leading-relaxed">Моніторинг стратегічної авіації (Ту-95МС, Ту-22М3)</p>
            </div>
          </div>
          
          <div className={`rounded-2xl p-4 mb-6 flex items-center justify-center border transition-all ${activeStrategicAirfields.length > 0 ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30' : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'}`}>
            <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${activeStrategicAirfields.length > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'}`}>
              {activeStrategicAirfields.length > 0 ? `⚠️ АКТИВНІСТЬ: ${activeStrategicAirfields.length} аеродромів` : 'СТАТУС: СПОКІЙНО'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <motion.button
              whileHover={isAdmin ? { scale: 1.02 } : {}}
              whileTap={isAdmin ? { scale: 0.98 } : {}}
              disabled={!isAdmin}
              onClick={() => handleToggleStrategicAirfield('All')}
              className={`col-span-full rounded-[1.25rem] py-5 text-[11px] sm:text-[13px] font-black uppercase tracking-[0.2em] transition-all border backdrop-blur-sm ${activeStrategicAirfields.length === STRATEGIC_AIRFIELDS.length ? 'bg-purple-600/90 border-purple-500 text-white shadow-xl shadow-purple-500/30' : 'bg-slate-50/50 dark:bg-white/5 border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-slate-300'} ${isAdmin ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/10' : 'cursor-not-allowed opacity-50'}`}
            >
              Активність всіх
            </motion.button>
            {STRATEGIC_AIRFIELDS.map(airfield => {
              const isActive = activeStrategicAirfields.includes(airfield.id);
              return (
                <motion.button
                  whileHover={isAdmin ? { scale: 1.02 } : {}}
                  whileTap={isAdmin ? { scale: 0.98 } : {}}
                  key={airfield.id}
                  disabled={!isAdmin}
                  onClick={() => handleToggleStrategicAirfield(airfield.id)}
                  className={`rounded-[1.25rem] py-4 px-2 text-[11px] sm:text-[12px] font-bold uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1.5 border backdrop-blur-sm ${isActive ? 'bg-purple-600/90 border-purple-500 text-white shadow-xl shadow-purple-500/30' : 'bg-slate-50/50 dark:bg-white/5 border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-slate-300'} ${isAdmin ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/10' : 'cursor-not-allowed opacity-50'}`}
                >
                  <span className="text-center leading-tight">{airfield.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md ${isActive ? 'bg-purple-700/50 text-purple-100' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>{airfield.planes}</span>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            whileHover={isAdmin ? { scale: 1.02 } : {}}
            whileTap={isAdmin ? { scale: 0.98 } : {}}
            disabled={!isAdmin}
            onClick={() => handleToggleStrategicAirfield('None')}
            className={`w-full bg-purple-600/90 hover:bg-purple-500 text-white rounded-[1.25rem] py-4 sm:py-5 text-xs sm:text-[14px] font-black uppercase tracking-[0.2em] shadow-xl shadow-purple-500/30 transition-all outline-none border border-purple-400/50 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
          >
            ВІДБІЙ ЗАГРОЗИ
          </motion.button>
        </motion.section>
      )}



      {/* AIRFIELDS SECTION */}
      {showAirfields && renderCanvasWidget('airfields',
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          ref={airfieldsRef} 
          style={!isCanvasMode ? { order: widgetOrder.indexOf('airfields') } : {}}
          className={`bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-200/50 dark:border-white/10 space-y-8 relative overflow-hidden group ${isCanvasMode ? 'w-full h-full overflow-y-auto' : ''}`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[60px] -z-10 group-hover:bg-indigo-500/20 transition-colors duration-700" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-[1.25rem] flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20 text-indigo-500">
                <MapIcon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-[28px] sm:text-[32px] font-black text-slate-900 dark:text-white uppercase leading-none mb-1.5 tracking-tight">Аеродроми пуску</h2>
                <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-[0.15em] leading-relaxed">Моніторинг активності тактичної авіації (Су-34, Су-35)</p>
              </div>
            </div>
            {isAdmin && markedAirfields.size > 0 && (
              <button 
                onClick={handleResetAirfields} 
                className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-[#FF3B30] hover:text-red-700 bg-red-50 dark:bg-red-500/10 px-4 py-2 sm:py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> Скинути
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {renderedAirfields}
          </div>
        </motion.section>
      )}

      {/* SITUATION UPDATES SECTION */}
      {showSituation && renderCanvasWidget('situation',
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          ref={situationRef} 
          style={!isCanvasMode ? { order: widgetOrder.indexOf('situation') } : {}}
          className={`bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-200/50 dark:border-white/10 space-y-8 relative overflow-hidden group ${isCanvasMode ? 'w-full h-full overflow-y-auto' : ''}`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[60px] -z-10 group-hover:bg-emerald-500/20 transition-colors duration-700" />

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-[1.25rem] flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Info className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-[28px] sm:text-[32px] font-black text-slate-900 dark:text-white uppercase leading-none mb-1.5 tracking-tight">Ситуація</h2>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-[0.15em] leading-relaxed">Загальне резюме та статуси</p>
            </div>
          </div>

          <SummerItemDisplay section="dashboard_situation" isAdmin={isAdmin} />
          <DailyRoulette />

          {/* STATUSES GRID */}
          <div className="bg-slate-50/50 dark:bg-white/5 backdrop-blur-sm rounded-[2rem] border border-slate-200/50 dark:border-white/10 overflow-hidden shadow-inner">
            <motion.div 
              whileHover={isAdmin ? { backgroundColor: 'var(--tw-colors-white-10)' } : {}}
              onClick={() => handleStatusClick('radio')}
              className={`flex justify-between items-center p-5 sm:p-6 border-b border-slate-200/50 dark:border-white/10 ${isAdmin ? 'cursor-pointer' : ''}`}
            >
              <span className="text-[11px] sm:text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">РАДІОЧАСТОТИ</span>
              <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 ${getStatusColor(radioStatus)}`}>{radioStatus}</span>
            </motion.div>
            <motion.div 
              whileHover={isAdmin ? { backgroundColor: 'var(--tw-colors-white-10)' } : {}}
              onClick={() => handleStatusClick('fleet')}
              className={`flex justify-between items-center p-5 sm:p-6 border-b border-slate-200/50 dark:border-white/10 ${isAdmin ? 'cursor-pointer' : ''}`}
            >
              <span className="text-[11px] sm:text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">ФЛОТ</span>
              <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 ${getStatusColor(fleetStatus)}`}>{fleetStatus}</span>
            </motion.div>
            <motion.div 
              whileHover={isAdmin ? { backgroundColor: 'var(--tw-colors-white-10)' } : {}}
              onClick={() => handleStatusClick('strategic')}
              className={`flex justify-between items-center p-5 sm:p-6 border-b border-slate-200/50 dark:border-white/10 ${isAdmin ? 'cursor-pointer' : ''}`}
            >
              <span className="text-[11px] sm:text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">СТРАТЕГІЧНА АВІАЦІЯ</span>
              <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 ${getStatusColor(strategicStatus)}`}>{strategicStatus}</span>
            </motion.div>
            <motion.div 
              whileHover={isAdmin ? { backgroundColor: 'var(--tw-colors-white-10)' } : {}}
              onClick={() => handleStatusClick('tactical')}
              className={`flex justify-between items-center p-5 sm:p-6 ${isAdmin ? 'cursor-pointer' : ''}`}
            >
              <span className="text-[11px] sm:text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">ТАКТИЧНА АВІАЦІЯ</span>
              <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 ${getStatusColor(tacticalStatus)}`}>{tacticalStatus}</span>
            </motion.div>
          </div>

          {isAdmin && (
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Додати оновлення ситуації..."
                className="flex-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const text = (e.target as HTMLInputElement).value;
                    if (text.trim()) {
                      addDoc(collection(db, 'situationUpdates'), {
                        text: text.trim(),
                        authorEmail: user?.email || 'Невідомо',
                        timestamp: serverTimestamp()
                      });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
            </div>
          )}

          <div className="space-y-3">
            {situationUpdates.length === 0 ? (
              <div className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest py-6">
                Немає оновлень
              </div>
            ) : (
              situationUpdates.map(update => (
                <div key={update.id} className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{update.text}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                      {update.timestamp ? format(update.timestamp.toDate(), 'HH:mm dd.MM.yyyy', { locale: uk }) : '...'}
                      {update.authorEmail && ` • ${update.authorEmail}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteDoc(doc(db, 'situationUpdates', update.id))} className="text-slate-400 hover:text-[#FF3B30] transition-colors p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.section>
      )}

      {/* MAPS SECTION */}
      {renderCanvasWidget('map_reporter',
      <section style={!isCanvasMode ? { order: widgetOrder.indexOf('map_reporter') } : {}} className={`bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl ${isCanvasMode ? 'w-full h-full' : ''}`}>
        <TargetReporterMap isAdmin={isAdmin} />
      </section>
      )}

      {renderCanvasWidget('map_iframes',
      <section style={!isCanvasMode ? { order: widgetOrder.indexOf('map_iframes') } : {}} className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${isCanvasMode ? 'w-full h-full overflow-y-auto' : ''}`}>
        {mapsList.map((map, i) => (
          <div 
            key={i}
            className="bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col space-y-4"
          >
            <div className="flex items-center gap-3 text-slate-900 dark:text-white shrink-0">
              <map.icon className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-black uppercase tracking-tighter">{map.title}</h2>
            </div>
            {map.id === 'dimap' ? (
              <div className="flex-1 w-full flex flex-col gap-4">
                <div className="w-full flex-col flex items-center justify-center p-6 text-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0A0A] rounded-[1.5rem] relative">
                   <img src="https://storage.googleapis.com/macaulay-arena-dev-pub/agent-attachments/your_attached_image.jpeg" alt="Dimap Message" className="w-full max-w-sm rounded-[1rem] mb-6 shadow-md object-cover border border-slate-200 dark:border-slate-800" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=DIMAP'; }} />
                   <h3 className="text-xl font-black text-red-500 mb-3 flex items-center gap-2 justify-center">
                      <AlertTriangle className="w-6 h-6" />
                      Увага! Важлива інформація
                   </h3>
                   <p className="text-slate-600 dark:text-slate-400 font-medium mb-1 leading-relaxed max-w-lg text-sm">
                      На даний момент ресурс <strong>dimap.live</strong> обмежив можливість використання своєї карти на сторонніх сайтах.
                   </p>
                   <p className="text-slate-600 dark:text-slate-400 font-medium mb-6 leading-relaxed max-w-lg text-sm">
                      Для перегляду актуальної карти повітряних тривог необхідно перейти на офіційний сайт:
                   </p>

                   <a 
                     href="https://dimap.live" 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="inline-flex flex-row items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-[0_8px_16px_-6px_rgba(37,99,235,0.4)] transition-all hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest text-xs sm:text-sm"
                   >
                     Перейти на сайт DIMAP
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                     </svg>
                   </a>

                   <p className="text-slate-400 dark:text-slate-500 text-xs mt-6 max-w-lg italic font-medium">
                      У разі відновлення доступу до вбудованої карти — вона знову з’явиться тут.
                   </p>
                </div>
                <div className="w-full flex-col flex items-center gap-3">
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-widest text-center">
                    Дана карта (alerts.in.ua) є тимчасовою
                  </p>
                  <div className="w-full h-[400px] min-h-[400px] rounded-[1.5rem] overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 relative">
                    <iframe 
                      src="https://alerts.in.ua" 
                      title="Тимчасова карта alerts.in.ua"
                      className="absolute inset-0 w-full h-full border-0"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 w-full h-[400px] min-h-[400px] rounded-[1.5rem] overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 relative">
                <iframe 
                  src={map.src} 
                  title={map.title}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        ))}
      </section>
      )}

      {/* ADMIN LOG SECTION */}
      {isAdmin && (
        <div className="space-y-8 contents">
          {/* System Health & Analytics */}

          {renderCanvasWidget('admin_stats',
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            style={!isCanvasMode ? { order: widgetOrder.indexOf('admin_stats') } : {}}
            className={`grid grid-cols-2 md:grid-cols-4 gap-6 ${isCanvasMode ? 'w-full h-full' : ''}`}
          >
            <div className="bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col items-center justify-center text-center">
              <Users className="w-8 h-8 text-blue-500 mb-2" />
              <p className="text-3xl font-black text-[#050505] dark:text-white">{stats.users}</p>
              <p className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest mt-1">Всього користувачів</p>
            </div>
            <div className="bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col items-center justify-center text-center">
              <Activity className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-3xl font-black text-[#050505] dark:text-white">{activeUsers}</p>
              <p className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest mt-1">Онлайн зараз</p>
            </div>
            <div className="bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col items-center justify-center text-center">
              <MessageSquare className="w-8 h-8 text-purple-500 mb-2" />
              <p className="text-3xl font-black text-[#050505] dark:text-white">{stats.topics}</p>
              <p className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest mt-1">Тем створено</p>
            </div>
            <div className="bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col items-center justify-center text-center">
              <Target className="w-8 h-8 text-[#FF3B30] mb-2" />
              <p className="text-3xl font-black text-[#050505] dark:text-white">{stats.messages}</p>
              <p className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest mt-1">Повідомлень</p>
            </div>
          </motion.section>
          )}

          {renderCanvasWidget('admin_log',
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            style={!isCanvasMode ? { order: widgetOrder.indexOf('admin_log') } : {}}
            className={`bg-white/80 dark:bg-[#0a0a0a]/80 glass-widget p-10 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-2xl space-y-8 ${isCanvasMode ? 'w-full h-full' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-[#A3A3A3]">
                <Activity className="w-8 h-8" />
                <h2 className="text-3xl font-black uppercase tracking-tighter text-[#050505] dark:text-white">Журнал Подій</h2>
              </div>
            </div>
            
            <div className="bg-[#F4F4F4] dark:bg-[#0a0a0a] rounded-3xl p-6 h-80 overflow-y-auto border border-slate-200 dark:border-white/5 shadow-inner">
              {threatHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#A3A3A3] font-bold text-sm uppercase tracking-widest">
                  Журнал порожній
                </div>
              ) : (
                <div className="space-y-4">
                  {threatHistory.map(threat => (
                    <motion.div 
                      key={threat.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start justify-between gap-6 p-5 bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-white/5 shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 ${
                          threat.type === 'ballistic' ? 'text-[#FF3B30]' : 
                          threat.type === 'airfield' ? 'text-[#FF9500]' : 'text-[#007AFF]'
                        }`}>
                          {threat.type === 'ballistic' ? <AlertTriangle className="w-5 h-5" /> : 
                           threat.type === 'airfield' ? <Radar className="w-5 h-5" /> : 
                           <Info className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#050505] dark:text-white">{threat.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <p className="text-[10px] text-[#A3A3A3] font-black uppercase tracking-widest">
                              {threat.timestamp ? format(threat.timestamp.toDate(), 'HH:mm:ss dd.MM.yyyy', { locale: uk }) : '...'}
                            </p>
                            {threat.authorEmail && (
                              <span className="text-[10px] text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full">
                                {threat.authorEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteThreat(threat.id)}
                        className="text-[#A3A3A3] hover:text-[#FF3B30] transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
          )}
        </div>
      )}
      
      </div>

      <SupportWidget isAdmin={isAdmin} sessionId={sessionId} />
    </motion.div>
  );
};
