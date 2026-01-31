const meshInput = document.getElementById('mesh-input');
const fileName = document.getElementById('file-name');
const viewerCanvas = document.getElementById('viewer-canvas');
const viewerStatus = document.getElementById('viewer-status');
const resetViewBtn = document.getElementById('reset-view');
const clearViewBtn = document.getElementById('clear-view');

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
  if (viewerStatus) viewerStatus.textContent = 'No mesh loaded.';
};

const loadMeshFile = (file) => {
  if (!file || !viewerState.scene) return;

  clearViewerObject();
  if (viewerStatus) viewerStatus.textContent = 'Loading mesh...';

  const url = URL.createObjectURL(file);
  const loader = new THREE.GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      viewerState.currentObject = gltf.scene;
      viewerState.scene.add(viewerState.currentObject);
      frameObject(viewerState.currentObject);
      if (viewerStatus) viewerStatus.textContent = 'Mesh loaded.';
      URL.revokeObjectURL(url);
    },
    undefined,
    () => {
      if (viewerStatus) viewerStatus.textContent = 'Failed to load mesh.';
      URL.revokeObjectURL(url);
    }
  );
};

if (meshInput) {
  meshInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (fileName) fileName.textContent = file.name;
    loadMeshFile(file);
  });
}

if (resetViewBtn) {
  resetViewBtn.addEventListener('click', () => {
    if (!viewerState.camera || !viewerState.controls) return;
    viewerState.camera.position.copy(viewerState.homePosition);
    viewerState.controls.target.copy(viewerState.homeTarget);
    viewerState.controls.update();
  });
}

if (clearViewBtn) {
  clearViewBtn.addEventListener('click', () => {
    if (meshInput) meshInput.value = '';
    if (fileName) fileName.textContent = 'No file selected.';
    clearViewerObject();
  });
}

initViewer();
