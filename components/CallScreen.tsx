import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, User } from 'lucide-react';
import { useCall } from '../contexts/CallContext';

export const CallScreen = () => {
  const { 
    activeCall, 
    incomingCall, 
    acceptCall, 
    rejectCall, 
    endCall, 
    localStream, 
    remoteStream, 
    isMuted, 
    isVideoOff, 
    toggleMute, 
    toggleVideo 
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall]);

  if (!activeCall && !incomingCall) return null;

  if (incomingCall) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center"
        >
          <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 border-2 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            {incomingCall.callerPhoto ? (
              <img src={incomingCall.callerPhoto} alt={incomingCall.callerName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">
                {incomingCall.callerName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{incomingCall.callerName}</h3>
            <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest">{incomingCall.type === 'video' ? 'Вхідний відеодзвінок' : 'Вхідний аудіодзвінок'}</p>
          </div>
          <div className="flex gap-6 mt-2">
            <button onClick={rejectCall} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20 transition-all hover:scale-110 active:scale-95">
              <PhoneOff className="w-6 h-6" />
            </button>
            <button onClick={acceptCall} className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg shadow-green-500/20 transition-all hover:scale-110 active:scale-95 animate-pulse">
              <Phone className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const otherPersonName = activeCall.isCaller ? activeCall.calleeName : activeCall.callerName;
  const isVideoCall = activeCall.type === 'video';
  const showConnecting = activeCall.status === 'ringing';

  return (
    <div className="fixed inset-0 z-[100] bg-black isolate overflow-hidden flex flex-col">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {isVideoCall ? (
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        ) : (
           <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center shadow-lg">
             <User className="w-12 h-12 text-slate-400" />
           </div>
        )}

        {showConnecting && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full border-t-2 border-indigo-500 animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-2">{otherPersonName}</h2>
            <p className="text-slate-300 uppercase tracking-widest text-sm">З'єднання...</p>
          </div>
        )}

        {/* Local Video (PiP) */}
        {isVideoCall && (
            <div className="absolute top-6 right-6 w-32 md:w-48 aspect-[3/4] bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-10 transition-all hover:scale-105">
                <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover scale-x-[-1]"
                />
            </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gradient-to-t from-black via-black/80 to-transparent p-8 pt-20 flex justify-center items-center gap-6 absolute bottom-0 w-full z-20">
        <button 
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-white text-black' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {isVideoCall && (
            <button 
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-white text-black' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
            >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
        )}

        <button 
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20 transition-all ml-4"
        >
          <PhoneOff className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
