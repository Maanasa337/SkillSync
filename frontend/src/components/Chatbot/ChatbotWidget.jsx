import React from 'react';
import { Bot, Minus, Send } from 'lucide-react';
import ChatbotMessage from './ChatbotMessage';
import './chatbot.css';

export default function ChatbotWidget({ chatState }) {
  const {
    isOpen,
    isMinimized,
    messages,
    isLoading,
    inputText,
    setInputText,
    chipsVisible,
    minimizeChat,
    sendMessage,
    handleKeyDown,
    messagesEndRef,
    placeholder,
    chipsLabel,
    chips
  } = chatState;

  if (!isOpen) return null;

  return (
    <div className={`chatbot-widget ${isMinimized ? 'minimized' : ''}`}>
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <Bot size={20} color="var(--bg-white)" />
          <span className="chatbot-header-title">SkillSync Assistant</span>
        </div>
        <button className="chatbot-header-btn" onClick={minimizeChat}>
          <Minus size={16} />
        </button>
      </div>

      {!isMinimized && (
        <>
          <div className="chatbot-body">
            {messages.map((msg, index) => (
              <ChatbotMessage
                key={msg.id || index}
                message={msg}
                onSendMessage={sendMessage}
              />
            ))}

            {isLoading && (
              <div className="chatbot-message bot">
                <div className="chatbot-avatar">
                  <Bot size={16} />
                </div>
                <div className="chatbot-bubble">
                  <div className="chatbot-loading-dots">
                    <div className="chatbot-dot"></div>
                    <div className="chatbot-dot"></div>
                    <div className="chatbot-dot"></div>
                  </div>
                </div>
              </div>
            )}

            {chipsVisible && chips.length > 0 && (
              <div className="chatbot-chips">
                <div className="chatbot-chips-label">{chipsLabel}</div>
                <div className="chatbot-chips-container">
                  {chips.map((chip, idx) => (
                    <button
                      key={idx}
                      className="chatbot-chip"
                      onClick={() => sendMessage(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input-area">
            <input
              type="text"
              className="chatbot-input"
              placeholder={placeholder}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button 
              className="chatbot-send-btn" 
              onClick={() => sendMessage()}
              disabled={isLoading || !inputText.trim()}
            >
              <Send size={16} color="var(--bg-white)" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
