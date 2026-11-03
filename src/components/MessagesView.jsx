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

  const threadRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingRequestRef = useRef(0);

  const partner = contacts.find(c => c.id === partnerId) || contacts[0];
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
        <h1 className="card-title">
          <Icon name="message" size={16} /> Messages
        </h1>
        <div id="contacts-list" className="stack">
          {contacts.map(person => {
            const online = socket?.connected && socket?.activeUsers?.some(
              u => u.userId === person.id && u.isOnline
            );
            const hasUnread = messages.some(
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
                <Avatar user={person} />
                <span>
                  <strong>{person.name}</strong>
                  <small className={online ? 'accent' : ''}>
                    {online ? 'Active on gateway' : 'Offline'}
                    {hasUnread ? ' • New message' : ''}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="chat-panel">
        <header className="author-row chat-header">
          <Avatar user={partner} />
          <div>
            <strong>{partner.name}</strong>
            <small>@{partner.handle} • {partner.role}</small>
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
            className="row chat-composer"
            onSubmit={handleFormSubmit}
          >
            <label className="sr-only" htmlFor="chat-input">
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
          <div id="voice-recorder" className="row">
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
