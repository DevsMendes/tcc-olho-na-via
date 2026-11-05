const launcher = document.querySelector('.via-launcher');
const panel = document.querySelector('#via-panel');
const answer = document.querySelector('#via-answer');
const modeSwitch = document.querySelector('#mode-switch');
const canvas = document.querySelector('#via-universe');

function setAssistant(open) {
  panel.hidden = !open;
  launcher.setAttribute('aria-expanded', String(open));
}

launcher.addEventListener('click', () => setAssistant(panel.hidden));
document.querySelector('[data-via-close]').addEventListener('click', () => setAssistant(false));
document.querySelectorAll('[data-answer]').forEach((button) => {
  button.addEventListener('click', () => { answer.textContent = button.dataset.answer; });
});

if (!window.THREE) {
  canvas.classList.add('scene-unavailable');
} else {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070c, 0.028);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 2.5, 9.5);
  camera.lookAt(0, 0, 0);

  const city = new THREE.Group();
  city.rotation.set(-0.3, -0.25, 0.02);
  scene.add(city);

  const asphaltMaterial = new THREE.MeshStandardMaterial({ color: 0x202d3a, roughness: 0.72, metalness: 0.08 });
  const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xf3f7fb, roughness: 0.35, metalness: 0.12 });
  const blueMaterial = new THREE.MeshStandardMaterial({ color: 0x2789ff, roughness: 0.26, metalness: 0.16 });
  const tealMaterial = new THREE.MeshStandardMaterial({ color: 0x1de1bd, roughness: 0.25, metalness: 0.16 });
  const cautionMaterial = new THREE.MeshStandardMaterial({ color: 0xf6d749, roughness: 0.34, metalness: 0.08 });

  const road = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.36, 3.3), asphaltMaterial);
  road.position.y = -0.25;
  city.add(road);

  [-1.08, 1.08].forEach((x) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 2.9), laneMaterial);
    line.position.set(x, -0.04, 0);
    city.add(line);
  });

  for (let z = -1.13; z < 1.3; z += 0.56) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.28), laneMaterial);
    dash.position.set(0, -0.035, z);
    city.add(dash);
  }

  const pothole = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.64, 0.08, 30), new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.95 }));
  pothole.position.set(-0.72, -0.01, 0.35);
  city.add(pothole);
  const warningRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.055, 12, 36), cautionMaterial);
  warningRing.rotation.x = Math.PI / 2;
  warningRing.position.set(-0.72, 0.025, 0.35);
  city.add(warningRing);

  const marker = new THREE.Group();
  const markerHead = new THREE.Mesh(new THREE.SphereGeometry(0.67, 36, 24), tealMaterial);
  markerHead.scale.set(1, 1, 0.6);
  marker.add(markerHead);
  const markerPoint = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.25, 36), blueMaterial);
  markerPoint.position.y = -0.84;
  marker.add(markerPoint);
  const markerEye = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.16 }));
  markerEye.scale.z = 0.4;
  markerEye.position.set(0, 0.04, 0.4);
  marker.add(markerEye);
  marker.position.set(-0.72, 1.1, 0.35);
  city.add(marker);

  const barrier = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.17, 0.12), cautionMaterial);
  bar.position.y = 0.88;
  barrier.add(bar);
  [-0.58, 0.58].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 12), cautionMaterial);
    post.position.set(x, 0.25, 0);
    barrier.add(post);
  });
  barrier.position.set(1.55, 0, -0.54);
  city.add(barrier);

  const stars = [];
  for (let index = 0; index < 450; index += 1) {
    stars.push((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 19, -4 - Math.random() * 25);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xaecff0, size: 0.04, transparent: true, opacity: 0.9 });
  const starField = new THREE.Points(starGeometry, starMaterial);
  scene.add(starField);

  const skyLight = new THREE.HemisphereLight(0x9edcff, 0x060b12, 2.1);
  scene.add(skyLight);
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.7);
  keyLight.position.set(3.5, 6, 5);
  scene.add(keyLight);
  const accentLight = new THREE.PointLight(0x1de1bd, 14, 8);
  accentLight.position.set(-3, 2, 3);
  scene.add(accentLight);

  let cityMode = false;
  let pointerX = 0;
  let pointerY = 0;

  modeSwitch.addEventListener('click', () => {
    cityMode = !cityMode;
    document.body.classList.toggle('city-mode', cityMode);
    modeSwitch.setAttribute('aria-pressed', String(cityMode));
    modeSwitch.querySelector('.mode-label').textContent = cityMode ? 'Modo noite' : 'Modo cidade';
    scene.fog.color.set(cityMode ? 0xdfeefa : 0x05070c);
    asphaltMaterial.color.set(cityMode ? 0xbacbd7 : 0x202d3a);
    laneMaterial.color.set(cityMode ? 0x31546d : 0xf3f7fb);
    tealMaterial.color.set(cityMode ? 0x00a88d : 0x1de1bd);
    starMaterial.opacity = cityMode ? 0.13 : 0.9;
    skyLight.intensity = cityMode ? 3.2 : 2.1;
    renderer.setClearColor(cityMode ? 0xdfeefa : 0x05070c, cityMode ? 1 : 0);
  });

  window.addEventListener('pointermove', (event) => {
    pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(time) {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    city.rotation.y = -0.25 + pointerX * 0.13 + (still ? 0 : Math.sin(time * 0.0003) * 0.08);
    city.rotation.x = -0.3 + pointerY * 0.05;
    marker.position.y = 1.1 + (still ? 0 : Math.sin(time * 0.0015) * 0.13);
    marker.rotation.y = still ? 0 : Math.sin(time * 0.0008) * 0.14;
    warningRing.rotation.z = time * 0.0008;
    starField.rotation.y = time * 0.00003;
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(render);
}
