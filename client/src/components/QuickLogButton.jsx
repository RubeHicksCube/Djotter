import React, { useState } from 'react';
import { api } from '../services/api';

function QuickLogButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [logText, setLogText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      alert('Image size must be under 20MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setSelectedImage(base64String);
      setImagePreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // Reset file input
    const fileInput = document.getElementById('quick-log-image-input');
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!logText.trim()) {
      alert('Please enter some text');
      return;
    }

    setIsSaving(true);
    try {
      // Add entry to today's log (same as Home page)
      await api.addEntry(logText, selectedImage, null);
      alert('Quick log saved successfully!');
      setLogText('');
      setSelectedImage(null);
      setImagePreview(null);
      // Reset file input
      const fileInput = document.getElementById('quick-log-image-input');
      if (fileInput) fileInput.value = '';
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

              {/* Image attachment */}
              <div className="image-attachment-section" style={{ marginTop: '0.75rem' }}>
                <label htmlFor="quick-log-image-input" className="btn btn-sm btn-secondary">
                  📷 Attach Image
                </label>
                <input
                  id="quick-log-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </div>
              {imagePreview && (
                <div className="image-preview" style={{ marginTop: '0.75rem' }}>
                  <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="btn-icon btn-icon-sm btn-danger"
                    title="Remove image"
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'var(--accent-danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

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
