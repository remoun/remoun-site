// Fixed blur intensity values
const GAUSSIAN_BLUR_RADIUS = 30; // px
const PIXEL_SIZE = 24; // px - larger blocks for better anonymization

/**
 * Apply Gaussian blur to a face region using CSS filter
 * Uses elliptical clip for more natural face shape
 */
export function applyGaussianBlur(ctx, box) {
  const x = Math.round(box.x);
  const y = Math.round(box.y);
  const width = Math.round(box.width);
  const height = Math.round(box.height);

  // Add padding around the face for blur overflow
  const padding = 50;
  const srcX = Math.max(0, x - padding);
  const srcY = Math.max(0, y - padding);
  const srcWidth = Math.min(width + padding * 2, ctx.canvas.width - srcX);
  const srcHeight = Math.min(height + padding * 2, ctx.canvas.height - srcY);

  ctx.save();

  // Create elliptical clip path for more natural face blur
  ctx.beginPath();
  ctx.ellipse(
    x + width / 2,
    y + height / 2,
    width / 2 + 10,
    height / 2 + 10,
    0,
    0,
    Math.PI * 2
  );
  ctx.clip();

  // Apply blur using filter
  ctx.filter = `blur(${GAUSSIAN_BLUR_RADIUS}px)`;
  ctx.drawImage(
    ctx.canvas,
    srcX, srcY, srcWidth, srcHeight,
    srcX, srcY, srcWidth, srcHeight
  );

  ctx.restore();
}

/**
 * Apply pixelation (mosaic) effect to a face region
 */
export function applyPixelation(ctx, box) {
  const x = Math.round(box.x);
  const y = Math.round(box.y);
  const width = Math.round(box.width);
  const height = Math.round(box.height);

  // Get the face region
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;

  // Pixelate by averaging blocks
  for (let py = 0; py < height; py += PIXEL_SIZE) {
    for (let px = 0; px < width; px += PIXEL_SIZE) {
      // Calculate average color for this block
      let r = 0, g = 0, b = 0, count = 0;

      for (let dy = 0; dy < PIXEL_SIZE && py + dy < height; dy++) {
        for (let dx = 0; dx < PIXEL_SIZE && px + dx < width; dx++) {
          const i = ((py + dy) * width + (px + dx)) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      // Fill block with average color
      for (let dy = 0; dy < PIXEL_SIZE && py + dy < height; dy++) {
        for (let dx = 0; dx < PIXEL_SIZE && px + dx < width; dx++) {
          const i = ((py + dy) * width + (px + dx)) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
      }
    }
  }

  ctx.putImageData(imageData, x, y);
}

/**
 * Apply blur to all selected faces on a canvas
 */
export function applyBlurToFaces(canvas, faces, blurType = 'gaussian') {
  const ctx = canvas.getContext('2d');
  const selectedFaces = faces.filter(f => f.selected);

  for (const face of selectedFaces) {
    if (blurType === 'gaussian') {
      applyGaussianBlur(ctx, face.box);
    } else {
      applyPixelation(ctx, face.box);
    }
  }

  return canvas;
}
