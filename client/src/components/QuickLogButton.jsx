import React, { useState } from 'react';
import { api } from '../services/api';

function QuickLogButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [logText, setLogText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!logText.trim()) {
      alert('Please enter some text');
      return;
    }

    setIsSaving(true);
    try {
      // Save as a quick note to today's entry
      await api.updateEntry({ entry: logText });
      alert('Quick log saved successfully!');
      setLogText('');
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving quick log:', error);
      alert('Failed to save quick log');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        className="quick-log-fab"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Quick log entry"
        title="Quick log entry"
      >
        {isOpen ? '✕' : '✏️'}
      </button>

      {/* Quick Log Modal */}
      {isOpen && (
        <div className="quick-log-modal">
          <div className="quick-log-backdrop" onClick={() => setIsOpen(false)} />
          <div className="quick-log-content">
            <h3 style={{ marginTop: 0 }}>Quick Log Entry</h3>
            <form onSubmit={handleSubmit}>
              <textarea
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                placeholder="What's on your mind?"
                className="quick-log-textarea"
                autoFocus
                rows={6}
                style={{ fontSize: '16px' }} // Prevent iOS zoom
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || !logText.trim()}
                  style={{ flex: 1 }}
                >
                  {isSaving ? 'Saving...' : '💾 Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default QuickLogButton;
