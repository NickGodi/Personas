import React, { useState } from 'react';
import { User, ChatMessage } from '../types';
import { sound } from '../utils/audio';
import mascotAvatar from '../assets/images/personas_duck_mascot_1793729518059.jpg';
import { MessageSquare, X, Send, Crown, Sparkles } from 'lucide-react';

interface FloatingChatProps {
  currentUser: User | null;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  unreadCount?: number;
}

export const FloatingChat: React.FC<FloatingChatProps> = ({
  currentUser,
  messages,
  onSendMessage,
  unreadCount = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim());
    setInputText('');
    sound.playNotification();
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {/* Expanded Chat Box */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 h-[460px] rounded-2xl bg-slate-950/95 border border-red-700/60 shadow-2xl backdrop-blur-lg flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-red-950 via-slate-900 to-slate-950 border-b border-red-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <img
                  src={mascotAvatar}
                  alt="Patinho Real Mascot"
                  className="w-8 h-8 rounded-full object-cover border border-amber-400 shadow-sm"
                />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full" />
              </div>
              <div>
                <h4 className="font-display font-black text-sm text-white flex items-center gap-1">
                  Chat Personas
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                </h4>
                <p className="text-[10px] text-slate-400">
                  Resenha geral & suporte direto com o Criador
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
            {/* Mascot Greeting */}
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-900/40 flex items-start gap-2">
              <img
                src={mascotAvatar}
                alt="Patinho"
                className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
              />
              <div>
                <span className="font-bold text-amber-300 text-[11px] block">
                  Patinho Real (Mascote)
                </span>
                <p className="text-slate-200 text-[11px] leading-relaxed">
                  Quack! Seja bem-vindo ao Personas. Qualquer mensagem digitada aqui gera uma notificação direta no painel do Criador!
                </p>
              </div>
            </div>

            {messages.map((m) => {
              const isMe = currentUser && m.senderId === currentUser.id;
              const isCreator = m.senderRole === 'criador';

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 px-1">
                    <span className="font-semibold text-slate-300">{m.senderName}</span>
                    {isCreator && <Crown className="w-2.5 h-2.5 text-amber-400" />}
                    <span>·</span>
                    <span className="font-mono text-slate-500">{m.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[85%] p-2.5 rounded-2xl ${
                      isMe
                        ? 'bg-red-600 text-white rounded-br-none'
                        : isCreator
                        ? 'bg-amber-950/70 border border-amber-600/50 text-amber-100 rounded-bl-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p className="text-xs leading-relaxed">{m.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Input */}
          <form
            onSubmit={handleSend}
            className="p-2.5 bg-slate-900/80 border-t border-slate-800 flex gap-2"
          >
            <input
              type="text"
              placeholder={
                currentUser ? 'Envie sua mensagem...' : 'Entre na conta para falar no chat'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!currentUser}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!currentUser || !inputText.trim()}
              className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          sound.playCardFlip();
        }}
        className="relative group p-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-2xl shadow-red-950 border-2 border-amber-400 transform hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
        title="Abrir Chat Flutuante Personas"
      >
        {/* Cute Mascot Avatar in circular button */}
        <div className="w-12 h-12 rounded-full overflow-hidden bg-black flex items-center justify-center">
          <img
            src={mascotAvatar}
            alt="Patinho da Coroa"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Small crown on top */}
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm filter drop-shadow">
          👑
        </span>

        {/* Unread indicator badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-black font-black text-[10px] font-mono shadow-md animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
