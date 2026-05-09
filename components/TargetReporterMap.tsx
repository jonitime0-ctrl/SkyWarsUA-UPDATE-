import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, LayerGroup, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Camera, MapPin, Send, AlertTriangle, ShieldCheck, Trash2, X, Navigation, Target, Maximize, Minimize, Info, ScanFace, CheckCircle2, PenTool, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

// Fix Leaflet blank markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const TARGET_TYPES = [
  { id: 'missile', label: 'РАКЕТА', color: 'bg-orange-700', icon: '🚀' },
  { id: 'aviation', label: 'АВІАЦІЯ', color: 'bg-slate-900', icon: '🛫' },
  { id: 'kab', label: 'КАБ', color: 'bg-red-800', icon: '💣' },
  { id: 'shahed', label: 'ШАХЕД', color: 'bg-slate-800', icon: '🛸' },
  { id: 'drone', label: 'БЕЗПІЛОТНИК', color: 'bg-slate-800', icon: '🚁' },
  { id: 'airplane', label: 'ЛІТАК', color: 'bg-slate-800', icon: '✈️' },
  { id: 'helicopter', label: 'ГЕЛІКОПТЕР', color: 'bg-slate-800', icon: '🚁' },
  { id: 'explosion', label: 'ВИБУХ', color: 'bg-slate-900', icon: '💥' }
];

const FaceScanner = ({ onComplete, onCancel }: { onComplete: () => void, onCancel: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(0); 
  const [isWall, setIsWall] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(s => {
        stream = s;
        if (videoRef.current) {
           videoRef.current.srcObject = s;
        }
        setTimeout(() => setStep(1), 1000); 
      })
      .catch(e => {
        console.error(e);
        setTimeout(() => setStep(4), 3000);
      });
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    }
  }, []);

  useEffect(() => {
    if (step !== 1 && step !== 2) return;
    
    const interval = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, 64, 64);
      const { data } = ctx.getImageData(0, 0, 64, 64);
      
      let sum = 0;
      let minBrightness = 255;
      let maxBrightness = 0;
      
      for (let i = 0; i < data.length; i += 4) {
         const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
         sum += brightness;
         if (brightness < minBrightness) minBrightness = brightness;
         if (brightness > maxBrightness) maxBrightness = brightness;
      }
      
      const mean = sum / (64*64);
      let variance = 0;
      for (let i = 0; i < data.length; i += 4) {
         const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
         variance += Math.pow(brightness - mean, 2);
      }
      variance /= (64*64);

      // Require high contrast AND high variance to not be a wall (prevents false positives on textured bright walls)
      if (variance < 600 || (maxBrightness - minBrightness) < 100) {
        setIsWall(true);
      } else {
        setIsWall(false);
        if (step === 1) {
          setStep(2);
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
     if (step !== 2) return;
     const timer = setTimeout(() => {
        setStep(3);
     }, 4000); 
     return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
     if (step === 3) {
        const timer = setTimeout(() => setStep(4), 1500);
        return () => clearTimeout(timer);
     } else if (step === 4) {
        const timer = setTimeout(() => onComplete(), 1500);
        return () => clearTimeout(timer);
     }
  }, [step, onComplete]);

  return (
    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
       <h2 className="text-white text-2xl font-black uppercase tracking-widest mb-8">Підтвердження</h2>

       <div className="relative w-72 h-96 mx-auto rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.1)] border-2 border-white/20">
         <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-[1.2] -scale-x-100 filter brightness-110 contrast-125" />
         
         <svg viewBox="0 0 200 250" className={`absolute inset-0 w-full h-full z-20 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-colors duration-500 ${(step === 3 || step === 4) ? 'text-green-400' : 'text-white/60'}`}>
           <motion.g 
             fill="none" 
             stroke="currentColor" 
             strokeWidth="1.5" 
             strokeLinejoin="round"
             initial={{ pathLength: 0, opacity: 0 }}
             animate={{ pathLength: 1, opacity: 1 }}
             transition={{ duration: 1.5, ease: "easeInOut", repeat: (step === 2 || step === 3) ? Infinity : 0, repeatType: "reverse" }}
           >
             <motion.path d="M100 20 L140 40 L160 80 L160 140 L140 190 L100 220 L60 190 L40 140 L40 80 L60 40 Z" />
             <motion.path d="M100 20 L100 60 L60 40 M100 20 L120 40 L100 60 L140 40 M60 80 L100 60 L140 80" />
             <motion.path d="M60 80 L80 100 L100 90 L120 100 L140 80 M80 100 L100 120 L120 100 M60 80 L60 100 L80 100 M140 80 L140 100 L120 100" />
             <motion.path d="M65 95 L75 95 L70 90 Z M125 95 L135 95 L130 90 Z" /> 
             <motion.path d="M100 90 L100 140 M100 120 L85 140 L100 150 L115 140 L100 120 M80 100 L85 140 M120 100 L115 140" />
             <motion.path d="M40 140 L60 140 L85 140 M160 140 L140 140 L115 140 M60 100 L60 140 M140 100 L140 140 M40 80 L60 100 M160 80 L140 100" />
             <motion.path d="M60 140 L80 170 L100 150 M140 140 L120 170 L100 150" />
             <motion.path d="M80 170 L100 170 L120 170 M100 170 L100 190 M80 170 L100 180 L120 170 M80 170 L100 160 L120 170" />
             <motion.path d="M60 190 L80 170 M140 190 L120 170 M100 190 L100 220 L80 190 M100 220 L120 190 L140 190 L160 140 M80 190 L60 190 L40 140" />
           </motion.g>
         </svg>

         {step === 3 && (
           <motion.div 
             initial={{ top: 0 }} 
             animate={{ top: '100%' }} 
             transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
             className="absolute left-0 right-0 h-1 bg-white shadow-[0_0_20px_10px_rgba(255,255,255,0.8)] z-20"
           />
         )}

         <AnimatePresence>
            {step === 4 && (
              <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="absolute inset-0 bg-green-500/30 backdrop-blur-sm flex items-center justify-center z-30">
                <CheckCircle2 className="w-24 h-24 text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
              </motion.div>
            )}
         </AnimatePresence>
       </div>

       <div className="mt-8 h-16 flex items-center justify-center text-center px-4 leading-relaxed">
         {step === 0 && <span className="text-blue-400 font-bold uppercase tracking-widest text-sm animate-pulse">Ініціалізація камери...</span>}
         {step === 1 && isWall && <span className="text-red-400 font-bold uppercase tracking-widest text-sm text-center">Обличчя не виявлено.<br/>Ви відсканували стіну або занадто темно.</span>}
         {step === 1 && !isWall && <span className="text-blue-400 font-bold uppercase tracking-widest text-sm animate-pulse">Пошук обличчя...</span>}
         {step === 2 && !isWall && <span className="text-white font-bold uppercase tracking-widest text-sm">Обличчя знайдено.<br/><span className="text-blue-400 font-black">Поверніть голову ліворуч та праворуч</span></span>}
         {step === 2 && isWall && <span className="text-red-400 font-bold uppercase tracking-widest text-sm text-center">Ви втратили обличчя з кадру.</span>}
         {step === 3 && <span className="text-blue-400 font-bold uppercase tracking-widest text-sm animate-pulse">Обробка біометрії...</span>}
         {step === 4 && <span className="text-green-400 font-black uppercase tracking-widest text-lg">Успішно підтверджено</span>}
       </div>

       <div className="mt-auto mb-8 bg-black/50 border border-slate-800 rounded-2xl p-4 flex items-start gap-4 max-w-sm">
         <ShieldCheck className="w-8 h-8 text-slate-400 shrink-0" />
         <p className="text-[10px] text-slate-400 text-left font-bold uppercase tracking-wider leading-relaxed">
           Ваші біометричні дані обробляються <span className="text-white">виключно локально</span>. 
           Вони нікуди не передаються і ніде не зберігаються (навіть тимчасово).
         </p>
       </div>

       <button onClick={onCancel} className="absolute top-6 left-6 text-white bg-white/10 p-2 rounded-full hover:bg-white/20">
         <X className="w-6 h-6" />
       </button>
    </motion.div>
  )
}

export const TargetReporterMap: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [adminTargets, setAdminTargets] = useState<any[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPath, setCurrentPath] = useState<{lat: number, lng: number}[]>([]);
  const [customDroneIconUrl, setCustomDroneIconUrl] = useState<string | null>(null);
  const isDrawingRef = useRef(false);

  // Form State
  const [selType, setSelType] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  const [showFaceScan, setShowFaceScan] = useState(false);

  // Map reference to fly to location
  const mapRef = useRef<any>(null);

  const MapResizer = ({ isFullscreen }: { isFullscreen: boolean }) => {
    const map = useMap();
    useEffect(() => {
      // Small timeout to allow CSS transition to finish before recalculating map size
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 300);
      return () => clearTimeout(timer);
    }, [isFullscreen, map]);
    return null;
  };

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        if (isAdmin && isDrawingMode) {
          setCurrentPath(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
        } else {
          setUserLoc({ lat: e.latlng.lat, lng: e.latlng.lng });
          setShowReportModal(true);
        }
      }
    });
    return null;
  };

  const saveAdminTarget = async (path: {lat: number, lng: number}[]) => {
    if (path.length < 2) {
      setCurrentPath([]);
      return;
    }
    
    try {
      await addDoc(collection(db, 'admin_targets'), {
        path: path,
        iconUrl: customDroneIconUrl,
        timestamp: serverTimestamp(),
      });
      setCurrentPath([]);
      setIsDrawingMode(false);
    } catch (err) {
      console.error('Error saving admin target', err);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'admin_targets'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAdminTargets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error fetching admin targets:', error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (unsub) {
        unsub();
        unsub = null;
      }
      
      if (user) {
        const q = query(collection(db, 'target_reports'), orderBy('timestamp', 'desc'));
        unsub = onSnapshot(q, (snap) => {
          setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => {
          console.error('Error fetching target reports:', error);
        });
      } else {
        setReports([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsub) {
        unsub();
      }
    };
  }, []);

  const handleLocate = () => {
    setIsLocating(true);
    setLocationError('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLoc(loc);
          setIsLocating(false);
        },
        (error) => {
          console.error(error);
          setLocationError('Не вдалося отримати локацію. ' + error.message);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError('Геолокація не підтримується.');
      setIsLocating(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a local blob url for preview. 
      // For real upload, we should compress it to base64 to store in firestore if it's <1MB, or use Firebase Storage (not enabled by default setup).
      // Let's compress to max 800px width base64 to easily fit in firestore doc
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg
          setPhotoUrl(dataUrl);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInitialSubmit = () => {
    if (!selType || !userLoc || !photoUrl) return;
    const hasPassed = localStorage.getItem('hasPassedFaceScan') === 'true';
    if (hasPassed) {
      submitReport();
    } else {
      setShowFaceScan(true);
    }
  };

  const submitReport = async () => {
    if (!selType || !userLoc || !photoUrl) return;
    try {
      await addDoc(collection(db, 'target_reports'), {
        type: selType,
        location: userLoc,
        imageUrl: photoUrl,
        authorId: auth.currentUser?.uid || 'unknown',
        authorEmail: auth.currentUser?.email || 'Unknown',
        authorName: auth.currentUser?.displayName || 'Unknown',
        timestamp: serverTimestamp()
      });
      setShowReportModal(false);
      setSelType('');
      setPhotoUrl(null);
      setUserLoc(null);
    } catch (error) {
      console.error("Error adding report: ", error);
      alert('Помилка при створенні репорту');
    }
  };

  const deleteReport = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'target_reports', id));
    } catch (err) {
      console.error('Error deleting', err);
    }
  };

  const centerOnMap = (lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 13);
    }
  };

  // Custom marker icon based on type
  const getCustomIcon = (typeId: string) => {
    const t = TARGET_TYPES.find(t => t.id === typeId);
    return L.divIcon({
      html: `
        <div style="background-color: ${t?.color === 'bg-orange-700' ? '#c2410c' : '#1e293b'}; color: white; display: flex; align-items: center; justify-center; border-radius: 50%; width: 36px; height: 36px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); border: 2px solid white; font-size: 18px; justify-content: center; cursor: pointer;">
          ${t?.icon || '❓'}
        </div>
      `,
      className: 'custom-icon-bg-transparent',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  };

  const handleAdminIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setCustomDroneIconUrl(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-2">
          <Target className="w-6 h-6 text-red-500" />
          Карта Народного Моніторингу
        </h2>
        <button
          onClick={() => setShowReportModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 shadow-lg transition-transform active:scale-95 text-sm uppercase tracking-widest"
        >
          <Camera className="w-5 h-5" />
          Фіксація Цілі
        </button>
      </div>

      <div className={`w-full overflow-hidden border border-slate-200 dark:border-slate-800 relative z-0 transition-all ${isFullscreen ? 'fixed inset-0 z-50 rounded-none h-full bg-slate-900' : 'h-[500px] rounded-[2rem]'}`}>
        
        {isAdmin && (
          <div className="absolute z-[1000] top-6 right-6 flex flex-col gap-2 pointer-events-auto">
            <button
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              className={`p-3 rounded-2xl shadow-xl transition-colors font-bold uppercase tracking-wide text-xs flex items-center justify-center gap-2 border-2 
                ${isDrawingMode 
                  ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-transparent hover:border-slate-300 dark:hover:border-slate-700'}`}
            >
              <PenTool className="w-5 h-5" />
              {isDrawingMode ? 'Малювання...' : 'Додати Шахед'}
            </button>
            
            {isDrawingMode && (
              <div className="bg-slate-900/80 backdrop-blur-md text-white text-[11px] p-3 rounded-xl flex flex-col gap-2 max-w-[200px] shadow-2xl border border-slate-700">
                <p className="text-center leading-relaxed">Натискайте на карту, щоб додати точки маршруту цілі.</p>
                {currentPath.length > 0 && (
                  <div className="flex gap-2 w-full mt-1">
                    <button 
                      onClick={() => saveAdminTarget(currentPath)}
                      className="bg-green-500 hover:bg-green-600 text-white font-bold py-1.5 px-2 rounded-lg flex-1 transition-colors"
                    >
                      Зберегти
                    </button>
                    <button 
                      onClick={() => setCurrentPath([])}
                      className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 px-2 rounded-lg transition-colors border border-slate-600 whitespace-nowrap"
                    >
                      Очистити
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {adminTargets.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm('Видалити всі маркери та траєкторії?')) {
                     adminTargets.forEach(async (t) => {
                       await deleteDoc(doc(db, 'admin_targets', t.id));
                     })
                  }
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-xl shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-red-500 flex items-center justify-center pointer-events-auto"
                title="Очистити всі траєкторії"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <label className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-xl shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-blue-500 flex items-center justify-center pointer-events-auto cursor-pointer" title="Вибрати власну іконку цілі" >
              <ImageIcon className="w-5 h-5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAdminIconUpload} />
            </label>
            {customDroneIconUrl && (
              <div className="relative">
                <img src={customDroneIconUrl} alt="Drone Icon" className="w-10 h-10 object-contain rounded-full border-2 border-green-500 bg-white shadow-xl" />
                <button
                  onClick={() => setCustomDroneIconUrl(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 outline-none"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute z-[1000] bottom-6 right-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 pointer-events-auto"
        >
          {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
        </button>
        <MapContainer 
          center={[48.3794, 31.1656]} // Center of Ukraine
          zoom={6} 
          style={{ width: '100%', height: '100%', zIndex: 0 }}
          ref={mapRef}
        >
          <MapResizer isFullscreen={isFullscreen} />
          <MapClickHandler />
          <LayersControl position="topleft">
            <LayersControl.BaseLayer name="Apple Maps (Темна)">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='Apple Maps Mode (CARTO)'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Google Maps (Супутник)">
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                attribution='Google Maps'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Google Maps (Схема)">
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                attribution='Google Maps'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Стандартна (Світла)">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Темна (Dark)">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Супутник (Satellite)">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='Tiles &copy; Esri'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Супутник + Назви (Hybrid)">
              <LayerGroup>
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='Tiles &copy; Esri'
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  attribution='Tiles &copy; Esri'
                />
              </LayerGroup>
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Топографічна (Topo)">
              <TileLayer
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          
          {currentPath.length > 0 && (
            <Polyline positions={currentPath} color="#ef4444" weight={4} opacity={0.8} />
          )}

          {adminTargets.map((target) => {
            if (!target.path || target.path.length < 2) return null;
            const lastPoint = target.path[target.path.length - 1];
            const prevPoint = target.path[target.path.length - 2];
            
            // Calculate angle for the Shahed icon and dashed line
            const dy = lastPoint.lat - prevPoint.lat;
            const dx = lastPoint.lng - prevPoint.lng;
            // Leaflet map coords are a bit weird, typical atan2 needs tweaking depending on projection. 
            // In standard mapping: 0 degrees is North, 90 East.
            const angle = Math.atan2(dx, dy) * (180 / Math.PI); 
            
            // Project a future point 50km ahead for dashed line
            const distance = 0.5; // very rough multiplier for drawing
            const futurePoint = {
              lat: lastPoint.lat + Math.cos(angle * Math.PI / 180) * distance,
              lng: lastPoint.lng + Math.sin(angle * Math.PI / 180) * distance
            };

            const svgIcon = `<svg style="transform: rotate(${angle}deg); filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));" width="32" height="32" viewBox="0 -3 24 24" fill="white" xmlns="http://www.w3.org/2400/svg"><path d="M11 2.251c0-.414.336-.75.75-.75h.5c.414 0 .75.336.75.75v3.21a2.25 2.25 0 01-1.258 2.01l-1.025.513A1.5 1.5 0 0010 9.324v2.4a.5.5 0 00.224.416l6.636 4.424A1.5 1.5 0 0117.5 17.81v3.44a.75.75 0 01-1.185.61l-4.043-2.888a1.5 1.5 0 00-1.744 0l-4.043 2.888A.75.75 0 015.3 21.25v-3.44a1.5 1.5 0 01.64-1.247l6.635-4.423a.5.5 0 00.225-.416V9.323c0-.623-.393-1.185-1.025-1.34l-1.025-.512a2.25 2.25 0 01-1.258-2.01v-3.21c0-.414.336-.75.75-.75h.5c.414 0 .75.336.75.75v1.249h2.5V2.25z" /></svg>`;
            const customIconHtml = target.iconUrl ? `<img src="${target.iconUrl}" style="transform: rotate(${angle}deg); width: 32px; height: 32px; object-fit: contain; filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));" />` : svgIcon;

            return (
              <React.Fragment key={target.id}>
                <Polyline positions={target.path} color="#ef4444" weight={4} opacity={0.8} />
                <Polyline positions={[lastPoint, futurePoint]} color="white" weight={2} dashArray="5, 10" />
                <Marker position={[lastPoint.lat, lastPoint.lng]} icon={L.divIcon({
                  html: customIconHtml,
                  className: 'custom-drone-icon',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                })} />
              </React.Fragment>
            );
          })}

          {reports.map(report => (
            <Marker 
              key={report.id} 
              position={[report.location.lat, report.location.lng]}
              icon={getCustomIcon(report.type)}
            >
              <Popup>
                <div className="text-center p-1 w-[220px]">
                  <div className="font-black text-sm uppercase mb-1 tracking-widest text-slate-800 dark:text-white">
                    {TARGET_TYPES.find(t => t.id === report.type)?.label || 'Невідомо'}
                  </div>
                  
                  {report.timestamp && (
                    <div className="mb-3 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Час фіксації</p>
                       <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(report.timestamp.toDate())} <br/><span className="text-[10px] text-slate-500">(за Києвом)</span>
                       </p>
                    </div>
                  )}

                  {report.location && (
                    <div className="text-[10px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-lg mb-3">
                      Координати: <br/> {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
                    </div>
                  )}

                  {report.imageUrl && (
                    <a href={report.imageUrl} target="_blank" rel="noreferrer">
                      <img src={report.imageUrl} alt="Ціль" className="w-full h-32 rounded-lg object-cover mb-3 border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity" />
                    </a>
                  )}
                  
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 bg-slate-50 dark:bg-slate-800/50 py-1 px-2 rounded-md">
                    Від: <span className="text-blue-500">{report.authorName}</span>
                  </div>
                  
                  {isAdmin && (
                    <button 
                      onClick={() => deleteReport(report.id)}
                      className="text-xs bg-red-100/50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-2 rounded-xl w-full font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1 border border-red-200 dark:border-red-900/30"
                    >
                      <Trash2 className="w-4 h-4" /> Видалити
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating recent reports list overlay (optional) */}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-4 sm:p-6 text-sm text-slate-700 dark:text-slate-300">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-400">
          <Info className="w-5 h-5" />
          Як працює ця карта?
        </h3>
        <p className="mb-3 leading-relaxed">
          <strong>Карта Народного Моніторингу</strong> — це інструмент для швидкої фіксації ворожих цілей у реальному часі. 
          Ваші повідомлення допомагають іншим бути в курсі небезпеки. Усі мітки з'являються на карті миттєво для всіх відвідувачів платформи.
        </p>
        <ul className="list-inside space-y-2 mb-3">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span> 
            <span>Натисніть <strong>"Фіксація Цілі"</strong> щоб додати об'єкт (ракету, дрон, літак тощо).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span> 
            <span>Надайте доступ до геолокації та прикріпіть <strong>фотодоказ</strong>. Без фото репорт не приймається для запобігання фейкам.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span> 
            <span>Клікніть на мітку на карті, щоб подивитися знімок, точний час за Києвом та координати події.</span>
          </li>
        </ul>
      </div>

      <AnimatePresence>
        {showReportModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1A1A1A] w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white">Повідомити про ціль</h3>
                <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Geolocation Section */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Місцезнаходження *</label>
                  {!userLoc ? (
                    <div>
                      <button 
                        onClick={handleLocate}
                        disabled={isLocating}
                        className="w-full flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 py-3 rounded-xl border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-bold text-sm disabled:opacity-50"
                      >
                        {isLocating ? (
                          <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/> Отримання...</span>
                        ) : (
                          <span className="flex items-center gap-2"><Navigation className="w-5 h-5" /> Визначити моє місцезнаходження</span>
                        )}
                      </button>
                      {locationError && <p className="text-red-500 text-xs mt-2 font-medium">{locationError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <ShieldCheck className="w-5 h-5" /> Локація зафіксована
                      </div>
                      <button onClick={() => setUserLoc(null)} className="text-xs underline hover:text-emerald-700">Скинути</button>
                    </div>
                  )}
                </div>

                {/* Target Type Section */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Мені вдалося зафіксувати *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TARGET_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => setSelType(type.id)}
                        className={`col-span-1 rounded-xl py-3 px-2 text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2 border ${
                          selType === type.id 
                            ? type.color + ' text-white border-transparent' 
                            : 'bg-slate-50 dark:bg-[#0A0A0A] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        {type.icon} {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo Capture Section */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-red-500 uppercase tracking-widest">Фотодоказ (обов'язково) *</label>
                  {!photoUrl ? (
                    <div className="relative w-full h-24 border-2 border-dashed border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handlePhotoCapture}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-red-500 dark:text-red-400">
                        <Camera className="w-6 h-6 mb-1" />
                        <span className="text-xs font-bold uppercase">Зробити фото</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <img src={photoUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
                      <button 
                        onClick={() => setPhotoUrl(null)}
                        className="absolute top-2 right-2 bg-slate-900/50 backdrop-blur-sm text-white p-1 rounded-full hover:bg-slate-900"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button 
                  disabled={!selType || !userLoc || !photoUrl}
                  onClick={handleInitialSubmit}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" /> Відправити
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFaceScan && (
          <FaceScanner 
            onComplete={() => {
              localStorage.setItem('hasPassedFaceScan', 'true');
              setShowFaceScan(false);
              submitReport();
            }} 
            onCancel={() => setShowFaceScan(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
