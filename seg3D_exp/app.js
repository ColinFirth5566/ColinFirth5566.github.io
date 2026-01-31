const form = document.querySelector('.builder-form');
const commandEl = document.getElementById('command');
const regenBtn = document.getElementById('regen');

const revealTargets = document.querySelectorAll('.hero, .section, .site-footer');

const buildCommand = () => {
  const data = form.querySelector('[name="data"]').value.trim() || '/path/to/data';
  const output = form.querySelector('[name="output"]').value.trim() || '/path/to/output';
  const device = form.querySelector('[name="device"]').value;
  const precision = form.querySelector('[name="precision"]').value;
  const grid = form.querySelector('[name="grid"]').value;
  const threshold = form.querySelector('[name="threshold"]').value;
  const format = form.querySelector('[name="format"]').value;

  const exports = format === 'mesh+volume' ? ['mesh', 'volume'] : [format];
  const exportFlags = exports.map((item) => `--export ${item}`).join(' ');

  return [
    'python run_seg3d.py',
    `--data "${data}"`,
    `--out "${output}"`,
    `--device ${device}`,
    `--precision ${precision}`,
    `--grid ${grid}`,
    `--threshold ${threshold}`,
    exportFlags,
  ].join(' \\\n  ');
};

const updateCommand = () => {
  commandEl.textContent = buildCommand();
};

const copyCommand = async (targetId, button) => {
  const target = document.getElementById(targetId);
  if (!target) return;

  try {
    await navigator.clipboard.writeText(target.textContent);
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = original;
    }, 1400);
  } catch (err) {
    button.textContent = 'Copy failed';
  }
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach((target) => {
  target.classList.add('reveal');
  observer.observe(target);
});

form.addEventListener('input', updateCommand);
regenBtn.addEventListener('click', updateCommand);

const copyButtons = document.querySelectorAll('[data-copy]');
copyButtons.forEach((button) => {
  button.addEventListener('click', () => copyCommand(button.dataset.copy, button));
});

const viewerCanvas = document.getElementById('viewer-canvas');
const imageInput = document.getElementById('input-images');
const meshInput = document.getElementById('mesh-file');
const meshStatus = document.getElementById('mesh-status');
const imagePreviews = document.getElementById('image-previews');
const resetViewBtn = document.getElementById('reset-view');
const clearViewBtn = document.getElementById('clear-view');

if (viewerCanvas && window.THREE) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  viewerCanvas.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(5, 6, 4);
  const fillLight = new THREE.DirectionalLight(0xfff1d6, 0.35);
  fillLight.position.set(-4, 3, -2);
  scene.add(ambient, keyLight, fillLight);

  const grid = new THREE.GridHelper(8, 16, 0x395047, 0x24332d);
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  scene.add(grid);

  let currentObject = null;
  let homePosition = new THREE.Vector3(2.5, 2, 3.5);
  let homeTarget = new THREE.Vector3(0, 0, 0);

  const resizeRenderer = () => {
    const { width, height } = viewerCanvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const setHome = () => {
    homePosition = camera.position.clone();
    homeTarget = controls.target.clone();
  };

  const resetView = () => {
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    controls.update();
  };

  const disposeMaterial = (material) => {
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach((mat) => disposeMaterial(mat));
      return;
    }
    if (material.map) material.map.dispose();
    material.dispose();
  };

  const clearObject = () => {
    if (!currentObject) return;
    scene.remove(currentObject);
    currentObject.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        disposeMaterial(child.material);
      }
    });
    currentObject = null;
  };

  const frameObject = (object) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (!isFinite(maxDim) || maxDim <= 0) {
      return;
    }

    const fov = (camera.fov * Math.PI) / 180;
    const distance = maxDim / (2 * Math.tan(fov / 2));
    const direction = new THREE.Vector3(1, 0.8, 1).normalize();

    camera.position.copy(center.clone().add(direction.multiplyScalar(distance * 1.6)));
    controls.target.copy(center);
    controls.update();
    setHome();
  };

  const setStatus = (text, isError = false) => {
    if (!meshStatus) return;
    meshStatus.textContent = text;
    meshStatus.style.color = isError ? '#c2523e' : '';
  };

  const setBackgroundFromImage = (file) => {
    if (!file) {
      scene.background = null;
      return;
    }
    const url = URL.createObjectURL(file);
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        scene.background = texture;
        URL.revokeObjectURL(url);
      },
      undefined,
      () => {
        URL.revokeObjectURL(url);
      }
    );
  };

  const loadMesh = (file) => {
    if (!file) return;
    clearObject();

    const extension = file.name.split('.').pop().toLowerCase();
    const url = URL.createObjectURL(file);

    if (extension === 'glb' || extension === 'gltf') {
      const loader = new THREE.GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          currentObject = gltf.scene;
          scene.add(currentObject);
          frameObject(currentObject);
          setStatus(`Loaded ${file.name}`);
          URL.revokeObjectURL(url);
        },
        undefined,
        (err) => {
          setStatus('Failed to load GLTF/GLB. Prefer .glb for a single file.', true);
          URL.revokeObjectURL(url);
        }
      );
      return;
    }

    if (extension === 'ply') {
      const loader = new THREE.PLYLoader();
      loader.load(
        url,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0xf6c177,
            roughness: 0.45,
            metalness: 0.05,
          });
          currentObject = new THREE.Mesh(geometry, material);
          scene.add(currentObject);
          frameObject(currentObject);
          setStatus(`Loaded ${file.name}`);
          URL.revokeObjectURL(url);
        },
        undefined,
        () => {
          setStatus('Failed to load PLY file.', true);
          URL.revokeObjectURL(url);
        }
      );
      return;
    }

    if (extension === 'obj') {
      const loader = new THREE.OBJLoader();
      loader.load(
        url,
        (object) => {
          object.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xf6c177,
                roughness: 0.5,
                metalness: 0.05,
              });
            }
          });
          currentObject = object;
          scene.add(currentObject);
          frameObject(currentObject);
          setStatus(`Loaded ${file.name}`);
          URL.revokeObjectURL(url);
        },
        undefined,
        () => {
          setStatus('Failed to load OBJ file.', true);
          URL.revokeObjectURL(url);
        }
      );
      return;
    }

    setStatus('Unsupported file type. Use .glb, .ply, or .obj.', true);
    URL.revokeObjectURL(url);
  };

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };

  resizeRenderer();
  camera.position.copy(homePosition);
  controls.target.copy(homeTarget);
  controls.update();
  animate();

  window.addEventListener('resize', resizeRenderer);

  if (resetViewBtn) {
    resetViewBtn.addEventListener('click', resetView);
  }

  if (clearViewBtn) {
    clearViewBtn.addEventListener('click', () => {
      clearObject();
      scene.background = null;
      setStatus('No mesh loaded.');
      camera.position.copy(new THREE.Vector3(2.5, 2, 3.5));
      controls.target.set(0, 0, 0);
      controls.update();
      setHome();
    });
  }

  if (meshInput) {
    meshInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      loadMesh(file);
    });
  }

  if (imageInput) {
    imageInput.addEventListener('change', (event) => {
      const files = Array.from(event.target.files || []);
      if (!imagePreviews) return;
      imagePreviews.innerHTML = '';

      if (!files.length) {
        imagePreviews.innerHTML = '<span class="muted small">No images loaded yet.</span>';
        scene.background = null;
        return;
      }

      files.slice(0, 6).forEach((file, index) => {
        const url = URL.createObjectURL(file);
        const img = document.createElement('img');
        img.src = url;
        img.alt = file.name;
        img.onload = () => URL.revokeObjectURL(url);
        imagePreviews.appendChild(img);
        if (index === 0) {
          setBackgroundFromImage(file);
        }
      });
    });
  }
} else if (meshStatus) {
  meshStatus.textContent = 'Viewer unavailable. Check that Three.js is loading.';
}

updateCommand();
