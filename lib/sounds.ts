let audioCtx: AudioContext | null = null;
const initAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
};

export const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
    try {
        initAudio();
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn('Audio play error:', e);
    }
};

export const playTyping = () => playTone(600, 'sine', 0.05, 0.05);
export const playError = () => { playTone(150, 'sawtooth', 0.3, 0.1); playTone(100, 'square', 0.3, 0.1); };
export const playRadarTick = () => playTone(800, 'sine', 0.1, 0.05);
export const playLock = () => playTone(1200, 'square', 0.1, 0.05);
export const playSuccess = () => {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.2, 0.1), 200);
};
