import React, { useState, useEffect, useRef } from 'react';
import { Icon, Avatar } from './Icons';
import { mediaURL, readFile } from '../utils/ui';
import { toast } from '../utils/toast';

export function MessagesView({
  partnerId,
  setPartnerId,
  messages,
  user,
  socket,
  chatDrafts,
  setChatDrafts,
  onSendMessage,
  onStartTyping,
  onStopTyping,
  partnerIsTyping,
  contacts
}) {
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [contactQuery, setContactQuery] = useState('');

  const threadRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingRequestRef = useRef(0);

  const partner = contacts.find(c => c.id === partnerId) || contacts[0];
  const partnerOnline = Boolean(
    socket?.connected && socket?.activeUsers?.some(u => u.userId === partner.id && u.isOnline)
  );

  const filteredContacts = contacts.filter(person =>
    `${person.name} ${person.handle} ${person.role}`
      .toLowerCase()
      .includes(contactQuery.trim().toLowerCase())
  );

  const activeConversation = messages.filter(
    m => (m.fromUserId === partner.id && m.toUserId === user.id) ||
         (m.fromUserId === user.id && m.toUserId === partner.id)
  );

  const currentDraft = chatDrafts[partner.id] || '';

  // Auto-scroll on new message
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [activeConversation.length, partnerIsTyping]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setChatDrafts(prev => ({ ...prev, [partner.id]: val }));
    onStartTyping(partner.id);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!currentDraft.trim()) return;
    onSendMessage(currentDraft, '', partner.id);
    setChatDrafts(prev => ({ ...prev, [partner.id]: '' }));
    onStopTyping(partner.id);
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast('Voice recording is unavailable in this browser.', 'error');
      return;
    }
    const reqId = ++recordingRequestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (reqId !== recordingRequestRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      const chunks = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;
      mediaRecorder.startedAt = Date.now();
      mediaRecorder.shouldSend = false;

      mediaRecorder.addEventListener('dataavailable', (e) => {
        if (e.data.size) chunks.push(e.data);
      });

      mediaRecorder.addEventListener('stop', async () => {
        stream.getTracks().forEach(t => t.stop());
        if (!mediaRecorder.shouldSend) return;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType.split(';')[0] });
        try {
          const audio = await readFile(blob);
          onSendMessage('Voice note', audio, partner.id);
        } catch {
          toast('Could not save the voice note.', 'error');
        }
      });

      mediaRecorder.start();
      setRecording(true);
      setRecordingSeconds(0);

      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - mediaRecorder.startedAt) / 1000);
        setRecordingSeconds(secs);
        if (secs >= 60) {
          stopVoiceRecording(true);
        }
      }, 250);
    } catch {
      toast('Microphone access was unavailable. You can still send a text message.', 'error');
    }
  };

  const stopVoiceRecording = (send) => {
    recordingRequestRef.current++;
    clearInterval(recordingTimerRef.current);
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.shouldSend = send;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    setRecording(false);
  };

  return (
    <section className="panel messages-layout">
      <aside className="contacts-panel">
        <div className="contacts-head">
          <h1 className="card-title">
            <Icon name="message" size={16} /> Direct Messages
          </h1>
          <label className="visually-hidden" htmlFor="contacts-search-input">Search conversations</label>
          <div className="contacts-search">
            <Icon name="search" size={14} />
            <input
              id="contacts-search-input"
              type="search"
              placeholder="Search chats…"
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
            />
          </div>
        </div>

        <div id="contacts-list" className="d-flex flex-column gap-2">
          {filteredContacts.map(person => {
            const online = socket?.connected && socket?.activeUsers?.some(
              u => u.userId === person.id && u.isOnline
            );
            const thread = messages.filter(
              m => (m.fromUserId === person.id && m.toUserId === user.id) ||
                   (m.fromUserId === user.id && m.toUserId === person.id)
            );
            const latestMsg = thread[thread.length - 1];
            const hasUnread = thread.some(
              m => m.fromUserId === person.id && m.toUserId === user.id && m.status !== 'READ'
            );
            const isSelected = partnerId === person.id;

            return (
              <button
                key={person.id}
                type="button"
                className={`contact-button ${isSelected ? 'selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => {
                  stopVoiceRecording(false);
                  onStopTyping(partnerId);
                  setPartnerId(person.id);
                }}
              >
                <span className="avatar-wrap">
                  <Avatar user={person} />
                  <span className={`presence-dot ${online ? 'online' : ''}`} aria-hidden="true" />
                </span>
                <span className="contact-meta">
                  <span className="contact-top">
                    <strong>{person.name}</strong>
                    {latestMsg?.time && <small className="contact-time">{latestMsg.time}</small>}
                  </span>
                  <small className="contact-preview">
                    {latestMsg
                      ? (latestMsg.audio ? '🎤 Voice note' : `${latestMsg.fromUserId === user.id ? 'You: ' : ''}${latestMsg.text}`)
                      : `@${person.handle}`}
                  </small>
                </span>
                {hasUnread && <span className="contact-unread-dot" aria-label="Unread message" />}
              </button>
            );
          })}
          {filteredContacts.length === 0 && (
            <p className="small muted text-center">No matching conversations</p>
          )}
        </div>
      </aside>

      <div className="chat-panel">
        <header className="author-row chat-header">
          <span className="avatar-wrap">
            <Avatar user={partner} />
            <span className={`presence-dot ${partnerOnline ? 'online' : ''}`} aria-hidden="true" />
          </span>
          <div>
            <strong>{partner.name}</strong>
            <small className={partnerOnline ? 'accent' : ''}>
              {partnerOnline ? 'Active now' : `@${partner.handle} · ${partner.role}`}
            </small>
          </div>
        </header>

        <div
          id="message-thread"
          className="message-thread"
          role="log"
          aria-label="Conversation"
          ref={threadRef}
        >
          {activeConversation.length === 0 && (
            <p className="empty-state">
              No messages yet. Send a greeting to start a conversation!
            </p>
          )}

          {activeConversation.map(msg => {
            const incoming = msg.fromUserId !== user.id;
            return (
              <div
                key={msg.id}
                className={`message-bubble ${incoming ? 'incoming' : 'outgoing'}`}
                data-message={msg.id}
              >
                {msg.audio ? (
                  <audio controls preload="metadata" src={mediaURL(msg.audio, '')} />
                ) : (
                  <p>{msg.text}</p>
                )}
                <small>
                  {msg.time}{' '}
                  {!incoming && (
                    <span data-message-status={msg.id}>
                      {msg.status}
                    </span>
                  )}
                </small>
              </div>
            );
          })}
        </div>

        {partnerIsTyping && (
          <p id="typing-indicator" className="small accent" aria-live="polite">
            {partner.name} is typing…
          </p>
        )}

        {!recording ? (
          <form
            id="message-form"
            className="d-flex align-items-center gap-2 chat-composer"
            onSubmit={handleFormSubmit}
          >
            <label className="visually-hidden" htmlFor="chat-input">
              Message {partner.name}
            </label>
            <input
              id="chat-input"
              className="auth-input"
              name="message"
              placeholder={`Message ${partner.name}…`}
              maxLength={5000}
              value={currentDraft}
              onChange={handleInputChange}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Record Voice Note"
              title="Record Voice Note"
              onClick={startVoiceRecording}
            >
              <Icon name="mic" />
            </button>
            <button
              type="submit"
              className="primary-button"
              aria-label="Send message"
            >
              <Icon name="send" />
            </button>
          </form>
        ) : (
          <div id="voice-recorder" className="d-flex align-items-center gap-2">
            <span className="recording-dot"></span>
            <span id="recording-time">
              Recording {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
            </span>
            <button
              type="button"
              className="primary-button"
              onClick={() => stopVoiceRecording(true)}
            >
              Send
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => stopVoiceRecording(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
