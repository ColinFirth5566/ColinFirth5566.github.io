const API_CONFIG = {
  baseUrl: 'https://api.yfcosmos.com',
  submitPath: '/seg3d',
  statusPath: '/seg3d/status',
  pollIntervalMs: 2000,
};

const imageInput = document.getElementById('image-input');
const roiCanvas = document.getElementById('roi-canvas');
const jobStatus = document.getElementById('job-status');
const jobDetail = document.getElementById('job-detail');
const roiStatus = document.getElementById('roi-status');
const submitBtn = document.getElementById('submit-job');
const undoBtn = document.getElementById('undo-point');
const clearBtn = document.getElementById('clear-points');
const closeBtn = document.getElementById('close-polygon');
const viewerCanvas = document.getElementById('viewer-canvas');
const viewerStatus = document.getElementById('viewer-status');
const resetViewBtn = document.getElementById('reset-view');

const ctx = roiCanvas.getContext('2d');
let imageFile = null;
let imageObj = null;
let contourPoints = [];
let contourClosed = false;
let drawRect = null;
let canvasSize = { width: 0, height: 0 };
let pollTimer = null;

const setStatus = (pill, detail) => {
  if (jobStatus) jobStatus.textContent = pill;
  if (jobDetail) jobDetail.textContent = detail;
};

const updateRoiStatus = () => {
  if (!roiStatus) return;
  if (!imageObj) {
    roiStatus.textContent = 'No contour yet.';
    return;
  }
  if (!contourPoints.length) {
    roiStatus.textContent = 'Click to add contour points.';
    return;
  }
  const state = contourClosed ? 'closed' : 'open';
  roiStatus.textContent = `${contourPoints.length} points (${state}).`;
};

const updateSubmitState = () => {
  if (!submitBtn) return;
  submitBtn.disabled = !(imageObj && contourPoints.length >= 3);
};

const resizeCanvas = () => {
  const rect = roiCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = window.devicePixelRatio || 1;
  roiCanvas.width = rect.width * ratio;
  roiCanvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  canvasSize = { width: rect.width, height: rect.height };
  computeDrawRect();
  drawCanvas();
};

const computeDrawRect = () => {
  if (!imageObj) {
    drawRect = null;
    return;
  }
  const imgW = imageObj.naturalWidth;
  const imgH = imageObj.naturalHeight;
  const scale = Math.min(canvasSize.width / imgW, canvasSize.height / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = (canvasSize.width - drawW) / 2;
  const offsetY = (canvasSize.height - drawH) / 2;
  drawRect = { offsetX, offsetY, drawW, drawH, scale, imgW, imgH };
};

const canvasToImage = (x, y) => {
  if (!drawRect) return null;
  const withinX = x >= drawRect.offsetX && x <= drawRect.offsetX + drawRect.drawW;
  const withinY = y >= drawRect.offsetY && y <= drawRect.offsetY + drawRect.drawH;
  if (!withinX || !withinY) return null;
  return {
    x: (x - drawRect.offsetX) / drawRect.scale,
    y: (y - drawRect.offsetY) / drawRect.scale,
  };
};

const imageToCanvas = (point) => {
  if (!drawRect) return { x: 0, y: 0 };
  return {
    x: point.x * drawRect.scale + drawRect.offsetX,
    y: point.y * drawRect.scale + drawRect.offsetY,
  };
};

const drawCanvas = () => {
  ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
  if (!imageObj || !drawRect) return;

  ctx.drawImage(
    imageObj,
    drawRect.offsetX,
    drawRect.offsetY,
    drawRect.drawW,
    drawRect.drawH
  );

  if (!contourPoints.length) return;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2c6b5f';
  ctx.fillStyle = 'rgba(44, 107, 95, 0.15)';

  ctx.beginPath();
  contourPoints.forEach((point, index) => {
    const canvasPoint = imageToCanvas(point);
    if (index === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });
  if (contourClosed) ctx.closePath();
  ctx.stroke();
  if (contourClosed) ctx.fill();

  contourPoints.forEach((point) => {
    const canvasPoint = imageToCanvas(point);
    ctx.beginPath();
    ctx.arc(canvasPoint.x, canvasPoint.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f6c177';
    ctx.fill();
    ctx.strokeStyle = '#1d2320';
    ctx.stroke();
  });

  ctx.restore();
};

const loadImage = (file) => {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    imageObj = img;
    imageFile = file;
    contourPoints = [];
    contourClosed = false;
    computeDrawRect();
    drawCanvas();
    updateRoiStatus();
    updateSubmitState();
    setStatus('Ready', 'Draw contour points on the image.');
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    setStatus('Error', 'Could not load image.');
    URL.revokeObjectURL(url);
  };
  img.src = url;
};

const closeContour = () => {
  if (contourPoints.length < 3) return;
  contourClosed = true;
  drawCanvas();
  updateRoiStatus();
};

const clearContour = () => {
  contourPoints = [];
  contourClosed = false;
  drawCanvas();
  updateRoiStatus();
  updateSubmitState();
};

const buildContourPayload = () => {
  if (!drawRect) return { points: [] };
  return {
    points: contourPoints.map((point) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
    })),
    width: drawRect.imgW,
    height: drawRect.imgH,
  };
};

const extractJobId = (payload) => payload.job_id || payload.jobId || payload.id;

const extractMeshUrl = (payload) =>
  payload.mesh_url || payload.result_url || payload.glb_url || payload.url;

const buildStatusUrl = (jobId, payload) =>
  payload.status_url || `${API_CONFIG.baseUrl}${API_CONFIG.statusPath}/${jobId}`;

const pollStatus = async (statusUrl) => {
  try {
    const response = await fetch(statusUrl);
    if (!response.ok) throw new Error('Failed to poll status');
    const payload = await response.json();

    const status = (payload.status || payload.state || '').toLowerCase();
    const meshUrl = extractMeshUrl(payload);

    if (status === 'failed') {
      setStatus('Failed', payload.message || 'Seg3D job failed.');
      return;
    }

    if (status === 'done' || status === 'succeeded' || meshUrl) {
      setStatus('Complete', 'Mesh ready.');
      if (meshUrl) {
        loadMesh(meshUrl);
      }
      return;
    }

    setStatus('Running', payload.message || 'Seg3D running...');
    pollTimer = setTimeout(() => pollStatus(statusUrl), API_CONFIG.pollIntervalMs);
  } catch (error) {
    setStatus('Error', 'Could not reach backend. Check API URL and CORS.');
  }
};

const submitJob = async () => {
  if (!imageFile || contourPoints.length < 3) return;
  if (!contourClosed) closeContour();

  setStatus('Uploading', 'Sending image + contour to Seg3D.');
  submitBtn.disabled = true;

  const form = new FormData();
  form.append('image', imageFile);
  form.append('contour', JSON.stringify(buildContourPayload()));

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.submitPath}`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) throw new Error('Submit failed');
    const payload = await response.json();
    const meshUrl = extractMeshUrl(payload);

    if (meshUrl) {
      setStatus('Complete', 'Mesh ready.');
      loadMesh(meshUrl);
      submitBtn.disabled = false;
      return;
    }

    const jobId = extractJobId(payload);
    if (!jobId) throw new Error('No job id returned');

    const statusUrl = buildStatusUrl(jobId, payload);
    setStatus('Queued', `Job ${jobId} queued.`);

    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => pollStatus(statusUrl), API_CONFIG.pollIntervalMs);
  } catch (error) {
    setStatus('Error', 'Submit failed. Check API URL and response format.');
  } finally {
    submitBtn.disabled = false;
  }
};

roiCanvas.addEventListener('click', (event) => {
  if (!imageObj || contourClosed) return;
  const point = canvasToImage(event.offsetX, event.offsetY);
  if (!point) return;
  contourPoints.push(point);
  drawCanvas();
  updateRoiStatus();
  updateSubmitState();
});

roiCanvas.addEventListener('dblclick', (event) => {
  event.preventDefault();
  closeContour();
});

imageInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  loadImage(file);
});

undoBtn.addEventListener('click', () => {
  contourPoints.pop();
  contourClosed = false;
  drawCanvas();
  updateRoiStatus();
  updateSubmitState();
});

clearBtn.addEventListener('click', clearContour);
closeBtn.addEventListener('click', closeContour);
submitBtn.addEventListener('click', submitJob);

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
updateRoiStatus();
updateSubmitState();

if (!viewerCanvas || !window.THREE) {
  if (viewerStatus) viewerStatus.textContent = 'Three.js failed to load.';
}

const viewerState = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  currentObject: null,
  homePosition: new THREE.Vector3(2.5, 2, 3.5),
  homeTarget: new THREE.Vector3(0, 0, 0),
};

const initViewer = () => {
  if (!viewerCanvas || !window.THREE) return;

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

  camera.position.copy(viewerState.homePosition);
  controls.target.copy(viewerState.homeTarget);
  controls.update();

  viewerState.renderer = renderer;
  viewerState.scene = scene;
  viewerState.camera = camera;
  viewerState.controls = controls;

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();
  resizeViewer();
};

const resizeViewer = () => {
  if (!viewerState.renderer || !viewerState.camera) return;
  const rect = viewerCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  viewerState.renderer.setSize(rect.width, rect.height);
  viewerState.camera.aspect = rect.width / rect.height;
  viewerState.camera.updateProjectionMatrix();
};

window.addEventListener('resize', resizeViewer);

const frameObject = (object) => {
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
  if (!viewerState.currentObject) return;
  viewerState.scene.remove(viewerState.currentObject);
  viewerState.currentObject.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  });
  viewerState.currentObject = null;
};

const loadMesh = (url) => {
  if (!viewerState.scene) return;
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

if (resetViewBtn) {
  resetViewBtn.addEventListener('click', () => {
    if (!viewerState.camera || !viewerState.controls) return;
    viewerState.camera.position.copy(viewerState.homePosition);
    viewerState.controls.target.copy(viewerState.homeTarget);
    viewerState.controls.update();
  });
}

initViewer();
