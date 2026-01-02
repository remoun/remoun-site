import { useState, useCallback, useRef } from 'react';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/**
 * Custom hook for face detection with age estimation and face recognition
 * Models are loaded from CDN on first use
 */
export function useFaceDetection() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  const modelsLoadedRef = useRef(false);
  const faceapiRef = useRef(null);

  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return;

    try {
      setError(null);
      setLoadingProgress(0);

      // Dynamically import face-api to avoid SSR issues
      const faceapi = await import('@vladmandic/face-api');
      faceapiRef.current = faceapi;

      // Load models sequentially with progress updates
      // SSD MobileNet for face detection (~5.4MB)
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      setLoadingProgress(30);

      // Age and Gender net (~420KB)
      await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
      setLoadingProgress(50);

      // Face landmarks for better positioning (~350KB)
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      setLoadingProgress(70);

      // Face recognition net for embeddings (~6.2MB)
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setLoadingProgress(100);

      modelsLoadedRef.current = true;
      setModelsLoaded(true);
    } catch (err) {
      setError(`Failed to load face detection models: ${err.message}`);
      console.error('Model loading error:', err);
    }
  }, []);

  const detectFaces = useCallback(async (imageElement) => {
    if (!modelsLoadedRef.current || !faceapiRef.current) {
      throw new Error('Models not loaded. Call loadModels() first.');
    }

    const faceapi = faceapiRef.current;

    // Detect faces with landmarks, age/gender, and face descriptors (embeddings)
    const detections = await faceapi
      .detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options({
        minConfidence: 0.5,
      }))
      .withFaceLandmarks()
      .withAgeAndGender()
      .withFaceDescriptors();

    return detections.map((detection, index) => {
      const age = Math.round(detection.age);
      const isChild = age < 18;

      return {
        id: `face-${Date.now()}-${index}`,
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: detection.landmarks,
        age,
        gender: detection.gender,
        genderProbability: detection.genderProbability,
        isChild,
        selected: isChild, // Pre-select children for blurring
        // Face descriptor (128-dimensional embedding) for recognition
        descriptor: Array.from(detection.descriptor),
      };
    });
  }, []);

  return {
    modelsLoaded,
    loadingProgress,
    error,
    loadModels,
    detectFaces,
  };
}

/**
 * Calculate Euclidean distance between two face descriptors
 */
export function faceDistance(descriptor1, descriptor2) {
  if (!descriptor1 || !descriptor2) return Infinity;
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Cluster faces by similarity into "persons"
 * Returns array of person objects, each with array of face IDs
 */
export function clusterFacesByPerson(faces, threshold = 0.6) {
  if (faces.length === 0) return [];

  const persons = [];
  const assigned = new Set();

  for (const face of faces) {
    if (assigned.has(face.id)) continue;

    // Find all faces similar to this one
    const personFaces = [face];
    assigned.add(face.id);

    for (const otherFace of faces) {
      if (assigned.has(otherFace.id)) continue;

      const distance = faceDistance(face.descriptor, otherFace.descriptor);
      if (distance < threshold) {
        personFaces.push(otherFace);
        assigned.add(otherFace.id);
      }
    }

    // Determine if this person is a child (majority vote or any child)
    const childCount = personFaces.filter(f => f.isChild).length;
    const isChild = childCount > personFaces.length / 2;

    // Calculate average age
    const avgAge = Math.round(
      personFaces.reduce((sum, f) => sum + f.age, 0) / personFaces.length
    );

    persons.push({
      id: `person-${Date.now()}-${persons.length}`,
      faces: personFaces,
      faceIds: personFaces.map(f => f.id),
      isChild,
      avgAge,
      // Use the first face's thumbnail as representative
      thumbnail: personFaces[0].thumbnail,
      // Selected if any face was selected (children pre-selected)
      selected: personFaces.some(f => f.selected),
    });
  }

  return persons;
}
