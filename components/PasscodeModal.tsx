import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Delete } from 'lucide-react';

interface PasscodeModalProps {
  onSuccess: () => void;
  onClose: () => void;
  correctPasscode: string;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({ onSuccess, onClose, correctPasscode }) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (key: string) => {
    if (passcode.length < 4) {
      const newPasscode = passcode + key;
      setPasscode(newPasscode);
      setError(false);
      
      if (newPasscode.length === 4) {
        if (newPasscode === correctPasscode) {
          onSuccess();
        } else {
          setError(true);
          setTimeout(() => setPasscode(''), 500);
        }
      }
    }
  };

  const handleDelete = () => {
    setPasscode(prev => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#1A1A1A] rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-[#333] p-8"
      >
        <div className="flex justify-end mb-4">
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Введіть код-пароль</h2>
          <p className="text-slate-400 text-sm">Цей канал захищений паролем</p>
        </div>

        <div className="flex justify-center gap-4 mb-10">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-all duration-300 ${
                passcode.length > i 
                  ? 'bg-blue-500 scale-110' 
                  : 'bg-[#333]'
              } ${error ? 'bg-red-500 animate-bounce' : ''}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-[240px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="w-16 h-16 rounded-full bg-[#333] hover:bg-[#444] text-white text-2xl font-medium flex items-center justify-center transition-colors active:scale-95 mx-auto"
            >
              {num}
            </button>
          ))}
          <div /> {/* Empty space for bottom left */}
          <button
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 rounded-full bg-[#333] hover:bg-[#444] text-white text-2xl font-medium flex items-center justify-center transition-colors active:scale-95 mx-auto"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 rounded-full bg-[#333] hover:bg-[#444] text-slate-400 hover:text-white flex items-center justify-center transition-colors active:scale-95 mx-auto"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
