const BACKEND_URL = 'http://localhost:8000';

const imageInput = document.getElementById('image-input');
const imagePreviews = document.getElementById('image-previews');
const imagePreviewMain = document.getElementById('image-preview-main');
const imageCount = document.getElementById('image-count');
const backendUrl = document.getElementById('backend-url');
const runBtn = document.getElementById('run-seg3d');
const runStatus = document.getElementById('run-status');
const viewerCanvas = document.getElementById('viewer-canvas');
const viewerStatus = document.getElementById('viewer-status');
const resetViewBtn = document.getElementById('reset-view');
const clearViewBtn = document.getElementById('clear-view');

const threeAvailable = Boolean(window.THREE && window.THREE.Scene);
let viewerState = null;
let selectedImages = [];
let previewUrls = [];
let pollTimer = null;

if (backendUrl) backendUrl.textContent = BACKEND_URL;

const initViewer = () => {
  if (!viewerCanvas || !threeAvailable) {
    if (viewerStatus) viewerStatus.textContent = 'Three.js failed to load.';
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  viewerCanvas.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(6, 6, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff1d6, 0.35);
  fill.position.set(-4, 2, -2);
  scene.add(fill);

  const grid = new THREE.GridHelper(6, 12, 0x395047, 0x24332d);
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  scene.add(grid);

  const homePosition = new THREE.Vector3(2.5, 2, 3.5);
  const homeTarget = new THREE.Vector3(0, 0, 0);
  camera.position.copy(homePosition);
  controls.target.copy(homeTarget);
  controls.update();

  viewerState = {
    renderer,
    scene,
    camera,
    controls,
    currentObject: null,
    homePosition,
    homeTarget,
  };

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();
  resizeViewer();
};

const resizeViewer = () => {
  if (!viewerState || !viewerState.renderer || !viewerState.camera) return;
  const rect = viewerCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  viewerState.renderer.setSize(rect.width, rect.height);
  viewerState.camera.aspect = rect.width / rect.height;
  viewerState.camera.updateProjectionMatrix();
};

window.addEventListener('resize', resizeViewer);

const frameObject = (object) => {
  if (!viewerState) return;
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim <= 0) return;

  const fov = (viewerState.camera.fov * Math.PI) / 180;
  const distance = maxDim / (2 * Math.tan(fov / 2));
  const direction = new THREE.Vector3(1, 0.8, 1).normalize();

  viewerState.camera.position.copy(center.clone().add(direction.multiplyScalar(distance * 1.6)));
  viewerState.controls.target.copy(center);
  viewerState.controls.update();
  viewerState.homePosition = viewerState.camera.position.clone();
  viewerState.homeTarget = viewerState.controls.target.clone();
};

const clearViewerObject = () => {
  if (!viewerState || !viewerState.currentObject) return;
  viewerState.scene.remove(viewerState.currentObject);
  viewerState.currentObject.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  });
  viewerState.currentObject = null;
  if (viewerStatus) viewerStatus.textContent = 'No mesh loaded.';
};

const loadMeshFromUrl = (url) => {
  if (!url || !viewerState || !viewerState.scene) return;

  clearViewerObject();
  if (viewerStatus) viewerStatus.textContent = 'Loading mesh...';

  const loader = new THREE.GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      viewerState.currentObject = gltf.scene;
      viewerState.scene.add(viewerState.currentObject);
      frameObject(viewerState.currentObject);
      if (viewerStatus) viewerStatus.textContent = 'Mesh loaded.';
    },
    undefined,
    () => {
      if (viewerStatus) viewerStatus.textContent = 'Failed to load mesh.';
    }
  );
};

const setBackgroundFromFile = (file) => {
  if (!file || !viewerState || !viewerState.scene) return;
  const url = URL.createObjectURL(file);
  const loader = new THREE.TextureLoader();
  loader.load(
    url,
    (texture) => {
      viewerState.scene.background = texture;
      URL.revokeObjectURL(url);
    },
    undefined,
    () => {
      URL.revokeObjectURL(url);
    }
  );
};

const clearImages = () => {
  if (imageInput) imageInput.value = '';
  selectedImages = [];
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
  if (imagePreviews) {
    imagePreviews.innerHTML = '<span class="muted small">No images selected.</span>';
  }
  if (imagePreviewMain) {
    imagePreviewMain.innerHTML = '<span class="muted small">No image preview.</span>';
  }
  if (imageCount) {
    imageCount.textContent = '0';
  }
  if (viewerState && viewerState.scene) {
    viewerState.scene.background = null;
  }
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (runBtn) runBtn.disabled = true;
  if (runStatus) runStatus.textContent = 'Idle.';
};

if (imageInput) {
  imageInput.addEventListener('change', (event) => {
    const files = Array.from(event.target.files || []);
    selectedImages = files;
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
    if (!imagePreviews) return;

    imagePreviews.innerHTML = '';
    if (imagePreviewMain) {
      imagePreviewMain.innerHTML = '<span class="muted small">No image preview.</span>';
    }
    if (imageCount) {
      imageCount.textContent = String(files.length);
    }
    if (runBtn) runBtn.disabled = files.length === 0;

    if (!files.length) {
      imagePreviews.innerHTML = '<span class="muted small">No images selected.</span>';
      if (viewerState && viewerState.scene) viewerState.scene.background = null;
      return;
    }

    files.slice(0, 8).forEach((file, index) => {
      const thumbUrl = URL.createObjectURL(file);
      previewUrls.push(thumbUrl);
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = file.name;
      img.onload = () => URL.revokeObjectURL(thumbUrl);
      imagePreviews.appendChild(img);
      if (index === 0) {
        if (imagePreviewMain) {
          imagePreviewMain.innerHTML = '';
          const mainImg = document.createElement('img');
          const mainUrl = URL.createObjectURL(file);
          previewUrls.push(mainUrl);
          mainImg.src = mainUrl;
          mainImg.alt = file.name;
          mainImg.onload = () => URL.revokeObjectURL(mainUrl);
          imagePreviewMain.appendChild(mainImg);
        }
        setBackgroundFromFile(file);
      }
    });
  });
}

if (resetViewBtn) {
  resetViewBtn.addEventListener('click', () => {
    if (!viewerState || !viewerState.camera || !viewerState.controls) return;
    viewerState.camera.position.copy(viewerState.homePosition);
    viewerState.controls.target.copy(viewerState.homeTarget);
    viewerState.controls.update();
  });
}

if (clearViewBtn) {
  clearViewBtn.addEventListener('click', () => {
    clearViewerObject();
    clearImages();
  });
}

const setRunStatus = (text) => {
  if (runStatus) runStatus.textContent = text;
};

const normalizeUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BACKEND_URL}${url}`;
  return `${BACKEND_URL}/${url}`;
};

const pollStatus = async (statusUrl) => {
  try {
    const response = await fetch(normalizeUrl(statusUrl));
    if (!response.ok) throw new Error('status failed');
    const payload = await response.json();
    const status = (payload.status || '').toLowerCase();
    const meshUrl = normalizeUrl(payload.mesh_url || payload.result_url || payload.glb_url || payload.url);

    if (status === 'failed') {
      setRunStatus(payload.message || 'Seg3D failed.');
      return;
    }

    if (status === 'done' || status === 'succeeded' || meshUrl) {
      setRunStatus('Complete. Loading mesh...');
      if (meshUrl) loadMeshFromUrl(meshUrl);
      return;
    }

    setRunStatus(payload.message || 'Running...');
    pollTimer = setTimeout(() => pollStatus(statusUrl), 2000);
  } catch (error) {
    setRunStatus('Could not reach backend.');
  }
};

const runSeg3D = async () => {
  if (!selectedImages.length) return;
  if (window.location.protocol === 'https:' && BACKEND_URL.startsWith('http://')) {
    setRunStatus('Blocked by browser (HTTPS → HTTP). Open the site locally or use HTTPS for the backend.');
    return;
  }
  if (runBtn) runBtn.disabled = true;
  setRunStatus('Uploading images...');

  const form = new FormData();
  selectedImages.forEach((file) => {
    form.append('images', file, file.name);
  });

  try {
    const response = await fetch(`${BACKEND_URL}/run`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error('submit failed');
    const payload = await response.json();
    const meshUrl = normalizeUrl(payload.mesh_url || payload.result_url || payload.glb_url || payload.url);
    if (meshUrl) {
      setRunStatus('Complete. Loading mesh...');
      loadMeshFromUrl(meshUrl);
      return;
    }
    const jobId = payload.job_id || payload.jobId || payload.id;
    if (!jobId) throw new Error('no job id');
    const statusUrl = normalizeUrl(payload.status_url || `/status/${jobId}`);
    setRunStatus(`Queued (${jobId}).`);
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => pollStatus(statusUrl), 1500);
  } catch (error) {
    setRunStatus('Submit failed. Check backend URL.');
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
};

if (runBtn) {
  runBtn.addEventListener('click', runSeg3D);
}

initViewer();
