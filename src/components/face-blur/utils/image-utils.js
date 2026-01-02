// Maximum dimension for detection (resize large images for performance)
const MAX_DETECTION_SIZE = 1920;

/**
 * Load an image file into an Image element
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Resize image for detection if needed (keeps original aspect ratio)
 * Returns the canvas and scale factor to map coordinates back
 */
export function resizeForDetection(img) {
  // If image is small enough, return as-is
  if (img.width <= MAX_DETECTION_SIZE && img.height <= MAX_DETECTION_SIZE) {
    return { canvas: imageToCanvas(img), scale: 1 };
  }

  // Calculate scale to fit within MAX_DETECTION_SIZE
  const scale = Math.min(
    MAX_DETECTION_SIZE / img.width,
    MAX_DETECTION_SIZE / img.height
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return { canvas, scale };
}

/**
 * Convert an Image element to a Canvas
 */
export function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Extract a face thumbnail from the canvas
 */
export function extractFaceThumbnail(canvas, box, padding = 20) {
  const x = Math.max(0, Math.round(box.x - padding));
  const y = Math.max(0, Math.round(box.y - padding));
  const width = Math.min(Math.round(box.width + padding * 2), canvas.width - x);
  const height = Math.min(Math.round(box.height + padding * 2), canvas.height - y);

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = width;
  thumbCanvas.height = height;

  const ctx = thumbCanvas.getContext('2d');
  ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

  return thumbCanvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Convert canvas to downloadable blob URL
 */
export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
