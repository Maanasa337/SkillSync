import React from 'react';
import { Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './chatbot.css';

export default function ChatbotMessage({ message, onSendMessage }) {
  const isBot = message.role === 'model';
  const navigate = useNavigate();
  
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const followups = message.followups || [];
  const courseLinks = message.courseLinks || [];

  return (
    <div className={`chatbot-message ${isBot ? 'bot' : 'user'}`}>
      {isBot && (
        <div className="chatbot-avatar">
          <Bot size={16} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%' }}>
        <div className="chatbot-bubble">
          {message.content}
        </div>

        {/* Course deep links */}
        {isBot && courseLinks.length > 0 && (
          <div className="chatbot-course-links">
            {courseLinks.map((cl, idx) => (
              <button
                key={idx}
                className="chatbot-course-link"
                onClick={() => navigate('/employee')}
                title={`View: ${cl.title}`}
              >
                📘 {cl.title}
              </button>
            ))}
          </div>
        )}

        {/* Follow-up suggestion chips */}
        {isBot && followups.length > 0 && (
          <div className="chatbot-followup-chips">
            {followups.map((fu, idx) => (
              <button
                key={idx}
                className="chatbot-followup-chip"
                onClick={() => onSendMessage && onSendMessage(fu)}
              >
                {fu}
              </button>
            ))}
          </div>
        )}

        <div className="chatbot-timestamp">
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
