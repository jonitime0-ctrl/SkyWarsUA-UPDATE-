import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, onSnapshot, getDoc, updateDoc, addDoc, query, where, deleteDoc } from 'firebase/firestore';

interface CallContextType {
  incomingCall: any;
  activeCall: any;
  startCall: (calleeId: string, type: 'video' | 'audio', calleeName: string, calleePhoto?: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const user = auth.currentUser;

  const servers = {
    iceServers: [
      { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    ],
  };

  useEffect(() => {
    if (!user) return;
    // Listen for incoming calls
    const q = query(collection(db, 'calls'), where('calleeId', '==', user.uid), where('status', '==', 'ringing'));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[snapshot.docs.length - 1]; // get latest
        setIncomingCall({ id: callDoc.id, ...callDoc.data() });
      } else {
        setIncomingCall(null);
      }
    });

    return () => unsub();
  }, [user]);

  // Clean up streams when call ends
  const cleanupCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const setupWebRTC = async (type: 'video' | 'audio') => {
    const pc = new RTCPeerConnection(servers);
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video',
      audio: true,
    });
    setLocalStream(stream);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    return { pc, stream };
  };

  const startCall = async (calleeId: string, type: 'video' | 'audio', calleeName: string, calleePhoto?: string) => {
    if (!user) return;
    try {
      const { pc } = await setupWebRTC(type);
      
      const callDocRef = doc(collection(db, 'calls'));
      
      const offerCandidates = collection(callDocRef, 'offerCandidates');
      const answerCandidates = collection(callDocRef, 'answerCandidates');

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(offerCandidates, event.candidate.toJSON());
        }
      };

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const callData = {
        callerId: user.uid,
        callerName: user.displayName || 'Unknown',
        callerPhoto: user.photoURL || null,
        calleeId,
        calleeName,
        calleePhoto,
        type,
        status: 'ringing',
        offer: {
          type: offerDescription.type,
          sdp: offerDescription.sdp,
        },
        timestamp: new Date(),
      };

      await setDoc(callDocRef, callData);
      setActiveCall({ id: callDocRef.id, ...callData, isCaller: true });

      onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answerDescription);
        }
        if (data?.status === 'ended' || data?.status === 'rejected') {
          cleanupCall();
        }
        if (data?.status === 'connected') {
            setActiveCall((prev: any) => ({ ...prev, status: 'connected' }));
        }
      });

      onSnapshot(answerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });
    } catch (e) {
      console.error(e);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !user) return;
    setIncomingCall(null);
    try {
      const callDocRef = doc(db, 'calls', incomingCall.id);
      const callData = (await getDoc(callDocRef)).data();
      if (!callData || callData.status !== 'ringing') {
          return; // Call might have been cancelled
      }

      const { pc } = await setupWebRTC(incomingCall.type);
      setActiveCall({ ...incomingCall, isCaller: false, status: 'connected' });

      const offerCandidates = collection(callDocRef, 'offerCandidates');
      const answerCandidates = collection(callDocRef, 'answerCandidates');

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(answerCandidates, event.candidate.toJSON());
        }
      };

      const offerDescription = new RTCSessionDescription(callData.offer);
      await pc.setRemoteDescription(offerDescription);

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      await updateDoc(callDocRef, {
        answer: {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        },
        status: 'connected'
      });

      onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });

      onSnapshot(callDocRef, (snapshot) => {
          if (snapshot.data()?.status === 'ended') {
              cleanupCall();
          }
      });
    } catch (e) {
      console.error(e);
      cleanupCall();
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(db, 'calls', incomingCall.id), {
        status: 'rejected'
      });
    } catch (e) {
      console.error(e);
    }
    setIncomingCall(null);
  };

  const endCall = async () => {
    if (!activeCall) return;
    try {
      await updateDoc(doc(db, 'calls', activeCall.id), {
        status: 'ended'
      });
    } catch (e) {
      console.error(e);
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsVideoOff(!track.enabled);
      });
    }
  };

  return (
    <CallContext.Provider value={{
      incomingCall,
      activeCall,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      localStream,
      remoteStream,
      isMuted,
      isVideoOff,
      toggleMute,
      toggleVideo
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
