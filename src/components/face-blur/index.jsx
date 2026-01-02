import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFaceDetection, clusterFacesByPerson } from './hooks/use-face-detection';
import { loadImage, resizeForDetection, imageToCanvas, extractFaceThumbnail } from './utils/image-utils';
import { applyBlurToFaces } from './utils/blur-utils';
import { ImageSelector } from './image-selector';
import { PersonGrid } from './person-grid';

const BLUR_TYPES = {
  gaussian: { label: 'Gaussian Blur', description: 'Smooth, natural-looking' },
  pixel: { label: 'Pixelation', description: 'Blocky mosaic effect' },
};

export default function FaceBlurTool() {
  // State
  const [images, setImages] = useState([]); // { id, file, img, faces, manualRegions, processed }
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [blurType, setBlurType] = useState('gaussian');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // Manual region drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const canvasRef = useRef(null);

  // Region manipulation state (for moving/resizing detected faces)
  // Use ref for drag state to avoid re-renders during drag - DOM is updated directly
  const draggingRef = useRef(null); // { type, id, action, corner, offset, initialBox, currentBox, element, imgWidth, imgHeight }

  // Face detection hook
  const { modelsLoaded, loadingProgress, error, loadModels, detectFaces } = useFaceDetection();

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Flatten all faces across images (excluding manual regions for person clustering)
  const allFaces = useMemo(() => {
    return images.flatMap(img =>
      img.faces.map(face => ({
        ...face,
        imageId: img.id,
        imageName: img.file.name,
      }))
    );
  }, [images]);

  // Cluster faces into persons
  const persons = useMemo(() => {
    return clusterFacesByPerson(allFaces);
  }, [allFaces]);

  // Get selected image
  const selectedImage = useMemo(() => {
    return images.find(img => img.id === selectedImageId);
  }, [images, selectedImageId]);

  // Count manual regions
  const totalManualRegions = useMemo(() => {
    return images.reduce((sum, img) => sum + (img.manualRegions?.length || 0), 0);
  }, [images]);

  // Handle file selection - process images and detect faces
  const handleFilesSelected = useCallback(async (files) => {
    if (!modelsLoaded) return;

    setIsProcessing(true);
    const newImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingStatus(`Detecting faces in ${file.name} (${i + 1}/${files.length})...`);

      try {
        const img = await loadImage(file);
        const { canvas: detectionCanvas, scale } = resizeForDetection(img);
        const rawFaces = await detectFaces(detectionCanvas);

        // Scale face boxes back to original image coordinates and extract thumbnails
        const originalCanvas = imageToCanvas(img);
        const imageId = `img-${Date.now()}-${i}`;
        const faces = rawFaces.map(face => ({
          ...face,
          imageId,
          box: {
            x: face.box.x / scale,
            y: face.box.y / scale,
            width: face.box.width / scale,
            height: face.box.height / scale,
          },
          thumbnail: extractFaceThumbnail(originalCanvas, {
            x: face.box.x / scale,
            y: face.box.y / scale,
            width: face.box.width / scale,
            height: face.box.height / scale,
          }),
        }));

        newImages.push({
          id: imageId,
          file,
          img,
          faces,
          manualRegions: [], // For manually drawn blur regions
          processed: null,
        });
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err);
      }
    }

    setImages(prev => [...prev, ...newImages]);
    // Auto-select first image if none selected
    if (newImages.length > 0 && !selectedImageId) {
      setSelectedImageId(newImages[0].id);
    }
    setIsProcessing(false);
    setProcessingStatus('');
  }, [modelsLoaded, detectFaces, selectedImageId]);

  // Toggle person selection (selects/deselects all faces for that person)
  const togglePersonSelection = useCallback((personId) => {
    const person = persons.find(p => p.id === personId);
    if (!person) return;

    const newSelected = !person.selected;
    const faceIdsToToggle = new Set(person.faceIds);

    setImages(prev => prev.map(img => ({
      ...img,
      processed: null,
      faces: img.faces.map(face =>
        faceIdsToToggle.has(face.id) ? { ...face, selected: newSelected } : face
      ),
    })));
  }, [persons]);

  // Quick selection actions
  const selectAllPersons = useCallback(() => {
    setImages(prev => prev.map(img => ({
      ...img,
      processed: null,
      faces: img.faces.map(face => ({ ...face, selected: true })),
    })));
  }, []);

  const deselectAllPersons = useCallback(() => {
    setImages(prev => prev.map(img => ({
      ...img,
      processed: null,
      faces: img.faces.map(face => ({ ...face, selected: false })),
    })));
  }, []);

  const selectChildrenOnly = useCallback(() => {
    const childFaceIds = new Set(
      persons.filter(p => p.isChild).flatMap(p => p.faceIds)
    );

    setImages(prev => prev.map(img => ({
      ...img,
      processed: null,
      faces: img.faces.map(face => ({
        ...face,
        selected: childFaceIds.has(face.id),
      })),
    })));
  }, [persons]);

  // Remove an image
  const removeImage = useCallback((imageId) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    if (selectedImageId === imageId) {
      setSelectedImageId(images.length > 1 ? images.find(img => img.id !== imageId)?.id : null);
    }
  }, [selectedImageId, images]);

  // Coordinate helper
  const getCanvasCoordinates = useCallback((e, canvas, img) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = img.width / rect.width;
    const scaleY = img.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Remove a manual region
  const removeManualRegion = useCallback((imageId, regionId) => {
    setImages(prev => prev.map(img => {
      if (img.id !== imageId) return img;
      return {
        ...img,
        processed: null,
        manualRegions: img.manualRegions.filter(r => r.id !== regionId),
      };
    }));
  }, []);

  // Global mouse move handler for dragging (attached to window for smooth tracking)
  const handleGlobalMouseMove = useCallback((e) => {
    if (!draggingRef.current || !canvasRef.current) return;

    const drag = draggingRef.current;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { action, corner, offset, element, imgWidth, imgHeight } = drag;

    // Calculate coordinates relative to canvas
    const scaleX = imgWidth / rect.width;
    const scaleY = imgHeight / rect.height;
    const coords = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };

    let box = { ...drag.currentBox };

    if (action === 'move') {
      box.x = Math.max(0, Math.min(coords.x - offset.x, imgWidth - box.width));
      box.y = Math.max(0, Math.min(coords.y - offset.y, imgHeight - box.height));
    } else if (action === 'resize') {
      const minSize = 30;
      if (corner.includes('e')) {
        box.width = Math.min(imgWidth - box.x, Math.max(minSize, coords.x - box.x));
      }
      if (corner.includes('w')) {
        const newX = Math.max(0, Math.min(coords.x, box.x + box.width - minSize));
        box.width = box.x + box.width - newX;
        box.x = newX;
      }
      if (corner.includes('s')) {
        box.height = Math.min(imgHeight - box.y, Math.max(minSize, coords.y - box.y));
      }
      if (corner.includes('n')) {
        const newY = Math.max(0, Math.min(coords.y, box.y + box.height - minSize));
        box.height = box.y + box.height - newY;
        box.y = newY;
      }
    }

    // Update ref with current box
    drag.currentBox = box;

    // Direct DOM update (smooth, bypasses React)
    element.style.left = `${(box.x / imgWidth) * 100}%`;
    element.style.top = `${(box.y / imgHeight) * 100}%`;
    element.style.width = `${(box.width / imgWidth) * 100}%`;
    element.style.height = `${(box.height / imgHeight) * 100}%`;
  }, []);

  // Global mouse up handler for dragging (commits to React state)
  const handleGlobalMouseUp = useCallback(() => {
    if (!draggingRef.current) return;

    // Clear any drawing state that might have been triggered accidentally
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentRect(null);

    const { type, id, currentBox, initialBox } = draggingRef.current;

    // Only update state if box actually changed
    const changed = currentBox.x !== initialBox.x || currentBox.y !== initialBox.y ||
                    currentBox.width !== initialBox.width || currentBox.height !== initialBox.height;

    if (changed) {
      setImages(prev => prev.map(img => {
        if (img.id !== selectedImage?.id) return img;
        if (type === 'face') {
          return {
            ...img,
            processed: null,
            faces: img.faces.map(f => f.id === id ? { ...f, box: { ...currentBox } } : f),
          };
        } else {
          return {
            ...img,
            processed: null,
            manualRegions: img.manualRegions.map(r => r.id === id ? { ...r, box: { ...currentBox } } : r),
          };
        }
      }));
    }

    draggingRef.current = null;

    // Remove global listeners
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [selectedImage, handleGlobalMouseMove]);

  // Start dragging/resizing a region
  const handleRegionMouseDown = useCallback((e, regionType, regionId, action, corner = null) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectedImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = selectedImage.img.width / rect.width;
    const scaleY = selectedImage.img.height / rect.height;
    const coords = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    // For resize/move handles, we need the parent region element, not the handle itself
    const element = e.currentTarget.parentElement;

    // Find the region
    let region;
    if (regionType === 'face') {
      region = selectedImage.faces.find(f => f.id === regionId);
    } else {
      region = selectedImage.manualRegions.find(r => r.id === regionId);
    }
    if (!region) return;

    // Store drag state in ref (no re-render)
    draggingRef.current = {
      type: regionType,
      id: regionId,
      action,
      corner,
      offset: { x: coords.x - region.box.x, y: coords.y - region.box.y },
      initialBox: { ...region.box },
      currentBox: { ...region.box },
      element,
      imgWidth: selectedImage.img.width,
      imgHeight: selectedImage.img.height,
    };

    // Attach global listeners for smooth tracking
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
  }, [selectedImage, handleGlobalMouseMove, handleGlobalMouseUp]);

  // Canvas mouse handlers (for drawing new regions only)
  const handleCanvasMouseDown = useCallback((e) => {
    // Only start drawing if clicking directly on canvas, not on region overlays
    if (e.target !== canvasRef.current) return;
    if (draggingRef.current) return;
    if (!selectedImage || !canvasRef.current) return;
    const coords = getCanvasCoordinates(e, canvasRef.current, selectedImage.img);
    setIsDrawing(true);
    setDrawStart(coords);
    setCurrentRect(null);
  }, [selectedImage, getCanvasCoordinates]);

  const handleCanvasMouseMove = useCallback((e) => {
    // Skip if dragging a region (handled by global listeners)
    if (draggingRef.current) return;
    // Only handle drawing new regions here - must have started drawing on canvas
    if (!isDrawing || !drawStart || !selectedImage || !canvasRef.current) return;
    // Extra check: only update if mouse is over the canvas element itself
    if (e.target !== canvasRef.current) return;
    const coords = getCanvasCoordinates(e, canvasRef.current, selectedImage.img);
    setCurrentRect({
      x: Math.min(drawStart.x, coords.x),
      y: Math.min(drawStart.y, coords.y),
      width: Math.abs(coords.x - drawStart.x),
      height: Math.abs(coords.y - drawStart.y),
    });
  }, [isDrawing, drawStart, selectedImage, getCanvasCoordinates]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!isDrawing || !currentRect || !selectedImage) {
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentRect(null);
      return;
    }

    // Only add region if it's reasonably sized (at least 20x20 pixels)
    if (currentRect.width > 20 && currentRect.height > 20) {
      const newRegion = {
        id: `manual-${Date.now()}`,
        box: currentRect,
        selected: true,
        isManual: true,
      };

      setImages(prev => prev.map(img => {
        if (img.id !== selectedImage.id) return img;
        return {
          ...img,
          processed: null,
          manualRegions: [...(img.manualRegions || []), newRegion],
        };
      }));
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentRect(null);
  }, [isDrawing, currentRect, selectedImage]);

  // Process images (apply blur)
  const processImages = useCallback(async () => {
    setIsProcessing(true);

    const processedImages = [];
    for (let i = 0; i < images.length; i++) {
      const imgData = images[i];
      setProcessingStatus(`Blurring faces in ${imgData.file.name} (${i + 1}/${images.length})...`);

      // Create canvas from original image
      const canvas = imageToCanvas(imgData.img);

      // Combine faces and manual regions for blurring
      const allRegions = [
        ...imgData.faces,
        ...(imgData.manualRegions || []),
      ];

      // Apply blur to selected regions
      applyBlurToFaces(canvas, allRegions, blurType);

      processedImages.push({
        ...imgData,
        processed: canvas.toDataURL('image/jpeg', 0.92),
      });
    }

    setImages(processedImages);
    setIsProcessing(false);
    setProcessingStatus('');
  }, [images, blurType]);

  // Download handlers
  const downloadImage = useCallback((imageData) => {
    const link = document.createElement('a');
    const extension = imageData.file.name.split('.').pop();
    const baseName = imageData.file.name.replace(/\.[^/.]+$/, '');
    link.download = `${baseName}-blurred.${extension}`;
    link.href = imageData.processed;
    link.click();
  }, []);

  const downloadAll = useCallback(() => {
    images.filter(img => img.processed).forEach((img, i) => {
      setTimeout(() => downloadImage(img), i * 100);
    });
  }, [images, downloadImage]);

  // Computed values
  const hasSelectedRegions = images.some(img =>
    img.faces.some(f => f.selected) || img.manualRegions?.some(r => r.selected)
  );
  const allProcessed = images.length > 0 && images.every(img => img.processed);
  const selectedPersonsCount = persons.filter(p => p.selected).length;

  return (
    <div className="face-blur">
      {/* Model Loading State */}
      {!modelsLoaded && !error && (
        <div className="face-blur__loading">
          <div className="face-blur__loading-text">
            Loading face detection models... {loadingProgress}%
          </div>
          <div className="face-blur__loading-bar">
            <div
              className="face-blur__loading-progress"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="face-blur__loading-hint">
            First load downloads ~12MB of AI models
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="face-blur__error">
          <p>{error}</p>
          <button onClick={loadModels} className="face-blur__retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Main Tool */}
      {modelsLoaded && (
        <>
          {/* Select Photos */}
          <ImageSelector
            onFilesSelected={handleFilesSelected}
            disabled={isProcessing}
          />

          {/* Processing Status */}
          {isProcessing && processingStatus && (
            <div className="face-blur__status">{processingStatus}</div>
          )}

          {/* Content Area */}
          {images.length > 0 && (
            <div className="face-blur__content">
              {/* Image Strip */}
              <div className="face-blur__image-strip">
                <span className="face-blur__image-strip-label">
                  Photos ({images.length}):
                </span>
                {images.map(img => (
                  <button
                    key={img.id}
                    type="button"
                    className={`face-blur__image-chip ${selectedImageId === img.id ? 'face-blur__image-chip--selected' : ''}`}
                    onClick={() => setSelectedImageId(img.id)}
                  >
                    <img
                      src={img.img.src}
                      alt={img.file.name}
                      className="face-blur__image-chip-thumb"
                    />
                    <span className="face-blur__image-chip-name">
                      {img.file.name.length > 15 ? img.file.name.slice(0, 12) + '...' : img.file.name}
                    </span>
                    {img.processed && <span className="face-blur__image-chip-done">✓</span>}
                    <span
                      className="face-blur__image-chip-remove"
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      title="Remove image"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>

              {/* Person Grid */}
              <div className="face-blur__persons">
                <h3 className="face-blur__section-title">
                  People Detected ({persons.length})
                  {totalManualRegions > 0 && (
                    <span className="face-blur__manual-count"> + {totalManualRegions} manual region{totalManualRegions > 1 ? 's' : ''}</span>
                  )}
                </h3>
                <PersonGrid
                  persons={persons}
                  onToggle={togglePersonSelection}
                  onSelectAll={selectAllPersons}
                  onDeselectAll={deselectAllPersons}
                  onSelectChildren={selectChildrenOnly}
                />
              </div>

              {/* Selected Image Preview / Manual Selection */}
              {selectedImage && (
                <div className="face-blur__preview-section">
                  <h3 className="face-blur__section-title">
                    {selectedImage.file.name}
                    <span className="face-blur__preview-hint">
                      Drag boxes to move • Drag corners to resize • Draw new regions
                    </span>
                  </h3>

                  <div className="face-blur__canvas-wrapper">
                    <canvas
                      ref={canvasRef}
                      className="face-blur__canvas"
                      width={selectedImage.img.width}
                      height={selectedImage.img.height}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      style={{
                        backgroundImage: `url(${selectedImage.processed || selectedImage.img.src})`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                    {/* Overlay for drawing rectangle */}
                    {currentRect && (
                      <div
                        className="face-blur__draw-rect"
                        style={{
                          left: `${(currentRect.x / selectedImage.img.width) * 100}%`,
                          top: `${(currentRect.y / selectedImage.img.height) * 100}%`,
                          width: `${(currentRect.width / selectedImage.img.width) * 100}%`,
                          height: `${(currentRect.height / selectedImage.img.height) * 100}%`,
                        }}
                      />
                    )}
                    {/* Show detected face regions */}
                    {selectedImage.faces.map(face => (
                      <div
                        key={face.id}
                        className={`face-blur__region face-blur__region--face ${face.selected ? 'face-blur__region--selected' : ''}`}
                        style={{
                          left: `${(face.box.x / selectedImage.img.width) * 100}%`,
                          top: `${(face.box.y / selectedImage.img.height) * 100}%`,
                          width: `${(face.box.width / selectedImage.img.width) * 100}%`,
                          height: `${(face.box.height / selectedImage.img.height) * 100}%`,
                        }}
                      >
                        <span className="face-blur__region-label">~{face.age}y</span>
                        {/* Move handle (center area) */}
                        <div className="face-blur__move-handle" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'move')} />
                        {/* Corner resize handles */}
                        <div className="face-blur__resize-handle face-blur__resize-handle--nw" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'resize', 'nw')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--ne" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'resize', 'ne')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--sw" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'resize', 'sw')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--se" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'resize', 'se')} />
                        {/* Edge resize handles */}
                        <div className="face-blur__resize-handle face-blur__resize-handle--n" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'resize', 'n')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--s" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'resize', 's')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--e" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'resize', 'e')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--w" onMouseDown={(e) => handleRegionMouseDown(e, 'face', face.id, 'resize', 'w')} />
                      </div>
                    ))}
                    {/* Show manual regions */}
                    {selectedImage.manualRegions?.map(region => (
                      <div
                        key={region.id}
                        className="face-blur__region face-blur__region--manual face-blur__region--selected"
                        style={{
                          left: `${(region.box.x / selectedImage.img.width) * 100}%`,
                          top: `${(region.box.y / selectedImage.img.height) * 100}%`,
                          width: `${(region.box.width / selectedImage.img.width) * 100}%`,
                          height: `${(region.box.height / selectedImage.img.height) * 100}%`,
                        }}
                      >
                        <button
                          type="button"
                          className="face-blur__region-remove"
                          onClick={(e) => { e.stopPropagation(); removeManualRegion(selectedImage.id, region.id); }}
                        >
                          ×
                        </button>
                        {/* Move handle (center area) */}
                        <div className="face-blur__move-handle" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'move')} />
                        {/* Corner resize handles */}
                        <div className="face-blur__resize-handle face-blur__resize-handle--nw" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'resize', 'nw')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--ne" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'resize', 'ne')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--sw" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'resize', 'sw')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--se" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'resize', 'se')} />
                        {/* Edge resize handles */}
                        <div className="face-blur__resize-handle face-blur__resize-handle--n" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'resize', 'n')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--s" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'resize', 's')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--e" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'resize', 'e')} />
                        <div className="face-blur__resize-handle face-blur__resize-handle--w" onMouseDown={(e) => handleRegionMouseDown(e, 'manual', region.id, 'resize', 'w')} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Options & Actions */}
          {images.length > 0 && (
            <div className="face-blur__footer">
              {/* Blur Type Toggle */}
              <div className="face-blur__options">
                <span className="face-blur__options-label">Blur style:</span>
                {Object.entries(BLUR_TYPES).map(([key, { label }]) => (
                  <button
                    key={key}
                    type="button"
                    className={`face-blur__option ${blurType === key ? 'face-blur__option--active' : ''}`}
                    onClick={() => {
                      setBlurType(key);
                      setImages(prev => prev.map(img => ({ ...img, processed: null })));
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="face-blur__actions">
                <button
                  type="button"
                  className="face-blur__btn face-blur__btn--primary"
                  onClick={processImages}
                  disabled={isProcessing || !hasSelectedRegions}
                >
                  {isProcessing ? 'Processing...' : `Blur ${selectedPersonsCount} ${selectedPersonsCount === 1 ? 'Person' : 'People'}${totalManualRegions > 0 ? ` + ${totalManualRegions} region${totalManualRegions > 1 ? 's' : ''}` : ''}`}
                </button>

                {allProcessed && (
                  <button
                    type="button"
                    className="face-blur__btn face-blur__btn--secondary"
                    onClick={downloadAll}
                  >
                    Download All ({images.length})
                  </button>
                )}

                {selectedImage?.processed && (
                  <button
                    type="button"
                    className="face-blur__btn face-blur__btn--secondary"
                    onClick={() => downloadImage(selectedImage)}
                  >
                    Download This
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Caveats - Always visible */}
          <div className="face-blur__caveats">
            <h4>Limitations</h4>
            <ul>
              <li>Age estimation has ~5-10 years variance</li>
              <li>Face matching may group different people who look similar</li>
              <li>May miss faces at extreme angles or with occlusion</li>
              <li>Click and drag on an image to manually add blur regions</li>
            </ul>
          </div>
        </>
      )}

      <style>{`
        .face-blur {
          font-family: var(--font-body);
        }

        /* Loading State */
        .face-blur__loading {
          text-align: center;
          padding: 3rem 1rem;
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border);
        }

        .face-blur__loading-text {
          font-size: var(--size-base);
          margin-bottom: 1rem;
        }

        .face-blur__loading-bar {
          width: 100%;
          max-width: 300px;
          height: 8px;
          background: var(--border);
          border-radius: 4px;
          margin: 0 auto;
          overflow: hidden;
        }

        .face-blur__loading-progress {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease;
        }

        .face-blur__loading-hint {
          font-size: var(--size-sm);
          color: var(--text-secondary);
          margin-top: 1rem;
        }

        /* Error State */
        .face-blur__error {
          text-align: center;
          padding: 2rem;
          background: color-mix(in srgb, #dc3545 10%, var(--bg));
          border: 1px solid color-mix(in srgb, #dc3545 30%, var(--border));
          border-radius: 12px;
          color: #dc3545;
        }

        .face-blur__retry-btn {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        /* Selector */
        .selector {
          border: 2px dashed var(--border);
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          transition: border-color 0.2s, background 0.2s;
          cursor: pointer;
        }

        .selector:hover,
        .selector--dragging {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 5%, var(--bg));
        }

        .selector--disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .selector__icon {
          font-size: 2rem;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 0.5rem;
        }

        .selector__text {
          font-size: var(--size-base);
          margin: 0;
        }

        .selector__link {
          color: var(--accent);
          cursor: pointer;
          text-decoration: underline;
        }

        .selector__hint {
          font-size: var(--size-sm);
          color: var(--text-secondary);
          margin: 0.5rem 0 0;
        }

        /* Processing Status */
        .face-blur__status {
          text-align: center;
          padding: 1rem;
          background: color-mix(in srgb, var(--accent) 10%, var(--bg));
          border-radius: 8px;
          margin-top: 1rem;
          font-size: var(--size-sm);
        }

        /* Content Area */
        .face-blur__content {
          margin-top: 1.5rem;
        }

        /* Image Strip */
        .face-blur__image-strip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .face-blur__image-strip-label {
          font-size: var(--size-sm);
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .face-blur__image-chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.5rem;
          background: var(--bg-secondary);
          border: 2px solid var(--border);
          border-radius: 6px;
          font-size: 0.75rem;
          flex-shrink: 0;
          position: relative;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .face-blur__image-chip:hover {
          border-color: var(--text-secondary);
        }

        .face-blur__image-chip--selected {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 10%, var(--bg));
        }

        .face-blur__image-chip-thumb {
          width: 24px;
          height: 24px;
          object-fit: cover;
          border-radius: 3px;
        }

        .face-blur__image-chip-name {
          color: var(--text-secondary);
        }

        .face-blur__image-chip-done {
          color: #28a745;
          font-weight: bold;
        }

        .face-blur__image-chip-remove {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--text-secondary);
          color: var(--bg);
          border: none;
          cursor: pointer;
          font-size: 11px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
          margin-left: 0.25rem;
        }

        .face-blur__image-chip:hover .face-blur__image-chip-remove {
          opacity: 1;
        }

        /* Section Title */
        .face-blur__section-title {
          font-family: var(--font-display);
          font-size: var(--size-sm);
          font-weight: 600;
          margin: 0 0 1rem;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .face-blur__manual-count {
          font-weight: 400;
          color: var(--text-secondary);
        }

        .face-blur__preview-hint {
          font-weight: 400;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-left: auto;
        }

        /* Face Grid */
        .face-grid__empty {
          padding: 2rem;
          text-align: center;
          background: var(--bg-secondary);
          border-radius: 8px;
          color: var(--text-secondary);
        }

        .face-grid__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 1rem;
        }

        .face-grid__action {
          padding: 0.4rem 0.75rem;
          font-size: var(--size-sm);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .face-grid__action:hover {
          border-color: var(--accent);
        }

        .face-grid__action--highlight {
          background: color-mix(in srgb, var(--accent) 10%, var(--bg));
          border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
        }

        .face-grid__count {
          margin-left: auto;
          font-size: var(--size-sm);
          color: var(--text-secondary);
        }

        .face-grid__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 0.75rem;
        }

        .face-grid__item {
          position: relative;
          border: 2px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .face-grid__item:hover {
          border-color: var(--text-secondary);
        }

        .face-grid__item--selected {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
        }

        .face-grid__item--child {
          background: color-mix(in srgb, #ffc107 15%, var(--bg));
        }

        .face-grid__checkbox {
          position: absolute;
          top: 6px;
          left: 6px;
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--accent);
        }

        .face-grid__thumb {
          width: 100%;
          height: 110px;
          object-fit: cover;
          display: block;
        }

        .face-grid__photo-count {
          position: absolute;
          top: 6px;
          right: 6px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          font-size: 0.65rem;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .face-grid__meta {
          padding: 0.5rem;
          background: var(--bg-secondary);
          text-align: center;
        }

        .face-grid__age {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .face-grid__child-badge {
          display: inline-block;
          margin-left: 0.25rem;
          padding: 1px 4px;
          background: #ffc107;
          color: #000;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        /* Preview Section */
        .face-blur__preview-section {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }

        .face-blur__canvas-wrapper {
          position: relative;
          display: inline-block;
          max-width: 100%;
          cursor: crosshair;
        }

        .face-blur__canvas {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          border: 1px solid var(--border);
          display: block;
        }

        .face-blur__draw-rect {
          position: absolute;
          border: 2px dashed var(--accent);
          background: color-mix(in srgb, var(--accent) 20%, transparent);
          pointer-events: none;
        }

        /* Region boxes (both detected faces and manual) */
        .face-blur__region {
          position: absolute;
          border: 2px solid rgba(100, 100, 255, 0.6);
          background: transparent;
          transition: border-color 0.15s;
        }

        .face-blur__region:hover {
          border-color: rgba(100, 100, 255, 0.9);
        }

        .face-blur__region--selected {
          border-color: var(--accent);
          border-width: 2px;
        }

        .face-blur__region--face {
          border-style: solid;
        }

        .face-blur__region--manual {
          border-style: dashed;
          border-color: #28a745;
        }

        .face-blur__region--manual.face-blur__region--selected {
          border-color: #28a745;
        }

        .face-blur__region-label {
          position: absolute;
          top: -20px;
          left: 0;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          font-size: 0.65rem;
          padding: 2px 6px;
          border-radius: 3px;
          white-space: nowrap;
        }

        .face-blur__region-remove {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #dc3545;
          color: white;
          border: none;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        /* Resize handles */
        .face-blur__resize-handle {
          position: absolute;
          width: 10px;
          height: 10px;
          background: var(--accent);
          border: 1px solid white;
          border-radius: 2px;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .face-blur__region:hover .face-blur__resize-handle {
          opacity: 1;
        }

        .face-blur__resize-handle--nw {
          top: -5px;
          left: -5px;
          cursor: nw-resize;
        }

        .face-blur__resize-handle--ne {
          top: -5px;
          right: -5px;
          cursor: ne-resize;
        }

        .face-blur__resize-handle--sw {
          bottom: -5px;
          left: -5px;
          cursor: sw-resize;
        }

        .face-blur__resize-handle--se {
          bottom: -5px;
          right: -5px;
          cursor: se-resize;
        }

        /* Edge resize handles - thin strips along each edge */
        .face-blur__resize-handle--n {
          top: -2px;
          left: 5px;
          right: 5px;
          width: auto;
          height: 4px;
          border-radius: 2px;
          cursor: n-resize;
        }

        .face-blur__resize-handle--s {
          bottom: -2px;
          left: 5px;
          right: 5px;
          width: auto;
          height: 4px;
          border-radius: 2px;
          cursor: s-resize;
        }

        .face-blur__resize-handle--e {
          right: -2px;
          top: 5px;
          bottom: 5px;
          width: 4px;
          height: auto;
          border-radius: 2px;
          cursor: e-resize;
        }

        .face-blur__resize-handle--w {
          left: -2px;
          top: 5px;
          bottom: 5px;
          width: 4px;
          height: auto;
          border-radius: 2px;
          cursor: w-resize;
        }

        /* Move handle - fills the interior */
        .face-blur__move-handle {
          position: absolute;
          top: 2px;
          left: 2px;
          right: 2px;
          bottom: 2px;
          cursor: move;
        }

        /* Footer */
        .face-blur__footer {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }

        .face-blur__options {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .face-blur__options-label {
          font-size: var(--size-sm);
          color: var(--text-secondary);
        }

        .face-blur__option {
          padding: 0.5rem 1rem;
          font-size: var(--size-sm);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .face-blur__option:hover {
          border-color: var(--accent);
        }

        .face-blur__option--active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .face-blur__actions {
          display: flex;
          gap: 0.5rem;
        }

        .face-blur__btn {
          padding: 0.6rem 1.25rem;
          font-size: var(--size-sm);
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .face-blur__btn--primary {
          background: var(--accent);
          color: white;
          border: none;
        }

        .face-blur__btn--primary:hover:not(:disabled) {
          background: var(--accent-hover);
        }

        .face-blur__btn--primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .face-blur__btn--secondary {
          background: var(--bg);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .face-blur__btn--secondary:hover {
          border-color: var(--accent);
        }

        /* Caveats */
        .face-blur__caveats {
          margin-top: 2rem;
          padding: 1rem 1.25rem;
          background: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        .face-blur__caveats h4 {
          font-family: var(--font-display);
          font-size: var(--size-sm);
          font-weight: 600;
          margin: 0 0 0.5rem;
        }

        .face-blur__caveats ul {
          margin: 0;
          padding-left: 1.25rem;
          font-size: var(--size-sm);
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .face-blur__caveats li {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  );
}
