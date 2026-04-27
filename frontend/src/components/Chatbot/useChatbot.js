import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function useChatbot() {
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [chipsVisible, setChipsVisible] = useState(true);
  const [conversationId, setConversationId] = useState('');

  // Translations
  const [placeholder, setPlaceholder] = useState("Ask me anything...");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [chips, setChips] = useState([
    "What courses are assigned to me?",
    "How do I complete an assessment?",
    "What is my current progress?",
    "How do I claim a training incentive?"
  ]);
  const [chipsLabel, setChipsLabel] = useState("Quick questions:");

  // Debounce ref
  const lastSendTime = useRef(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setConversationId('');
      setMessages([]);
      setChipsVisible(true);
      return;
    }

    setConversationId(generateUUID());
    setMessages([]);
    setInputText('');
    setChipsVisible(true);
    setIsLoading(false);
    lastSendTime.current = 0;
  }, [user?.name, user?.role]);

  useEffect(() => {
    setPlaceholder(t('chatbot.placeholder'));
    setChipsLabel(t('chatbot.quick_questions'));
    setChips([
      t('chatbot.chips.assigned_courses'),
      t('chatbot.chips.complete_assessment'),
      t('chatbot.chips.current_progress'),
      t('chatbot.chips.claim_incentive')
    ]);
    if (user) {
      const name = user.name ? user.name.split(' ')[0] : t('chatbot.default_name');
      const msg = t('chatbot.welcome').replace('{name}', name);
      setWelcomeMsg(msg);
      setMessages(prev => {
        if (prev.length === 0) {
          return [{ id: 'welcome', role: 'model', content: msg, timestamp: new Date().toISOString() }];
        }
        if (prev.length === 1 && prev[0].id === 'welcome') {
          return [{ ...prev[0], content: msg }];
        }
        return prev;
      });
    }
  }, [user, language, t]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) scrollToBottom();
  }, [messages, isOpen, isMinimized, isLoading]);

  const toggleChat = () => {
    if (isOpen && isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(!isOpen);
      setIsMinimized(false);
    }
  };

  const minimizeChat = (e) => {
    e.stopPropagation();
    setIsMinimized(true);
  };

  const sendMessage = useCallback(async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading || !conversationId) return;

    // 500ms debounce
    const now = Date.now();
    if (now - lastSendTime.current < 500) return;
    lastSendTime.current = now;

    setChipsVisible(false);

    const newMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await api.post('/api/chatbot/message', {
        message: text,
        conversation_id: conversationId,
        lang: language
      });

      const data = response.data;

      // Handle rate limit response (returned as 200 with rate_limited flag)
      if (data.rate_limited) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: data.reply,
          timestamp: new Date().toISOString()
        }]);
        setIsLoading(false);
        return;
      }

      const replyMsg = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.reply,
        timestamp: new Date().toISOString(),
        followups: data.suggested_followups || [],
        courseLinks: data.course_links || [],
      };

      setMessages(prev => [...prev, replyMsg]);
    } catch (error) {
      console.error("Chat error", error);

      // Handle 429 from server
      let errorMsg = t('chatbot.errors.connection');
      if (error.response && error.response.status === 429) {
        errorMsg = t('chatbot.errors.rate_limit');
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: errorMsg,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, conversationId, language, t]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return {
    isOpen,
    isMinimized,
    messages,
    isLoading,
    inputText,
    setInputText,
    chipsVisible,
    toggleChat,
    minimizeChat,
    sendMessage,
    handleKeyDown,
    messagesEndRef,
    placeholder,
    chipsLabel,
    chips
  };
}
