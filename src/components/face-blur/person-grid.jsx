import React from 'react';

export function PersonGrid({
  persons,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onSelectChildren,
}) {
  if (persons.length === 0) {
    return (
      <div className="face-grid__empty">
        No faces detected
      </div>
    );
  }

  const selectedCount = persons.filter(p => p.selected).length;
  const childCount = persons.filter(p => p.isChild).length;
  const totalFaces = persons.reduce((sum, p) => sum + p.faces.length, 0);
  const selectedFaces = persons.filter(p => p.selected).reduce((sum, p) => sum + p.faces.length, 0);

  return (
    <div className="face-grid">
      {/* Quick Actions */}
      <div className="face-grid__actions">
        <button
          type="button"
          onClick={onSelectAll}
          className="face-grid__action"
        >
          Select All ({persons.length})
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
          {selectedCount} of {persons.length} people ({selectedFaces} of {totalFaces} faces)
        </span>
      </div>

      {/* Person Cards */}
      <div className="face-grid__grid">
        {persons.map(person => (
          <label
            key={person.id}
            className={`face-grid__item ${person.selected ? 'face-grid__item--selected' : ''} ${person.isChild ? 'face-grid__item--child' : ''}`}
          >
            <input
              type="checkbox"
              checked={person.selected}
              onChange={() => onToggle(person.id)}
              className="face-grid__checkbox"
            />
            <img
              src={person.thumbnail}
              alt={`Person, estimated age ~${person.avgAge}`}
              className="face-grid__thumb"
            />
            {/* Photo count badge */}
            {person.faces.length > 1 && (
              <span className="face-grid__photo-count">
                {person.faces.length} photos
              </span>
            )}
            <div className="face-grid__meta">
              <span className="face-grid__age">
                ~{person.avgAge}y
                {person.isChild && <span className="face-grid__child-badge">child</span>}
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
