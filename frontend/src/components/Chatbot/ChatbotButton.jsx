import React from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChatbot } from './useChatbot';
import ChatbotWidget from './ChatbotWidget';
import './chatbot.css';

export default function ChatbotButton() {
  const location = useLocation();
  const { user } = useAuth();
  const chatState = useChatbot();

  // Don't render on login/register or when not authenticated
  if (!user) return null;

  // Exclude rendering on assessment pages (removed from DOM entirely)
  if (location.pathname.startsWith('/assessment')) {
    return null;
  }

  return (
    <div className="chatbot-wrapper">
      <ChatbotWidget chatState={chatState} />
      
      <button 
        className="chatbot-toggle-btn" 
        onClick={chatState.toggleChat}
        aria-label="Toggle Chatbot"
        id="chatbot-toggle"
      >
        {chatState.isOpen && !chatState.isMinimized ? (
          <X size={24} />
        ) : (
          <MessageCircle size={24} />
        )}
      </button>
    </div>
  );
}
