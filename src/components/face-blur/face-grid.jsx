import React from 'react';

export function FaceGrid({
  faces,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onSelectChildren,
  showImageName = false,
}) {
  if (faces.length === 0) {
    return (
      <div className="face-grid__empty">
        No faces detected
      </div>
    );
  }

  const selectedCount = faces.filter(f => f.selected).length;
  const childCount = faces.filter(f => f.isChild).length;

  return (
    <div className="face-grid">
      {/* Quick Actions */}
      <div className="face-grid__actions">
        <button
          type="button"
          onClick={onSelectAll}
          className="face-grid__action"
        >
          Select All ({faces.length})
        </button>
        <button
          type="button"
          onClick={onDeselectAll}
          className="face-grid__action"
        >
          Deselect All
        </button>
        {childCount > 0 && (
          <button
            type="button"
            onClick={onSelectChildren}
            className="face-grid__action face-grid__action--highlight"
          >
            Children Only ({childCount})
          </button>
        )}
        <span className="face-grid__count">
          {selectedCount} of {faces.length} selected
        </span>
      </div>

      {/* Face Thumbnails */}
      <div className="face-grid__grid">
        {faces.map(face => (
          <label
            key={face.id}
            className={`face-grid__item ${face.selected ? 'face-grid__item--selected' : ''} ${face.isChild ? 'face-grid__item--child' : ''}`}
          >
            <input
              type="checkbox"
              checked={face.selected}
              onChange={() => onToggle(face.imageId, face.id)}
              className="face-grid__checkbox"
            />
            <img
              src={face.thumbnail}
              alt={`Face, estimated age ~${face.age}`}
              className="face-grid__thumb"
            />
            <div className="face-grid__meta">
              <span className="face-grid__age">
                ~{face.age}y
                {face.isChild && <span className="face-grid__child-badge">child</span>}
              </span>
              {showImageName && face.imageName && (
                <span className="face-grid__image-name" title={face.imageName}>
                  {face.imageName.length > 12 ? face.imageName.slice(0, 10) + '...' : face.imageName}
                </span>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
