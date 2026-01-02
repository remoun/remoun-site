import React, { useCallback, useState } from 'react';

export function ImageSelector({ onFilesSelected, disabled }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    );

    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected, disabled]);

  const handleFileInput = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [onFilesSelected]);

  return (
    <div
      className={`selector ${isDragging ? 'selector--dragging' : ''} ${disabled ? 'selector--disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="selector__content">
        <span className="selector__icon">+</span>
        <p className="selector__text">
          Drag & drop photos here, or{' '}
          <label className="selector__link">
            browse
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              disabled={disabled}
              hidden
            />
          </label>
        </p>
        <p className="selector__hint">Supports JPG, PNG, WebP</p>
      </div>
    </div>
  );
}
