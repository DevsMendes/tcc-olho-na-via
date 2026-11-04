import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js';

const revealElements = document.querySelectorAll('.step-card, .impact-copy, .impact-board, .project > *');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 },
);

revealElements.forEach((element) => {
  element.classList.add('will-reveal');
  observer.observe(element);
});

const launcher = document.querySelector('.via-launcher');
const panel = document.querySelector('#via-panel');
const closeButton = document.querySelector('[data-via-close]');
const answer = document.querySelector('#via-answer');

function setAssistantOpen(isOpen) {
  panel.hidden = !isOpen;
  launcher.setAttribute('aria-expanded', String(isOpen));
}

launcher.addEventListener('click', () => setAssistantOpen(panel.hidden));
closeButton.addEventListener('click', () => setAssistantOpen(false));

document.querySelectorAll('[data-answer]').forEach((question) => {
  question.addEventListener('click', () => {
    answer.textContent = question.dataset.answer;
  });
});

const canvas = document.querySelector('#hero-three');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 1.15, 7.5);

const mark = new THREE.Group();
scene.add(mark);

const disk = new THREE.Mesh(
  new THREE.CylinderGeometry(1.55, 1.78, 0.42, 48),
  new THREE.MeshStandardMaterial({ color: 0x182b3d, roughness: 0.52, metalness: 0.08 }),
);
disk.rotation.z = -0.2;
mark.add(disk);

const road = new THREE.Mesh(
  new THREE.BoxGeometry(0.44, 0.05, 2.75),
  new THREE.MeshStandardMaterial({ color: 0x273d50, roughness: 0.45 }),
);
road.position.y = 0.24;
road.rotation.z = -0.2;
mark.add(road);

for (let index = -0.88; index < 1.05; index += 0.5) {
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.065, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  );
  dash.position.set(0, 0.28, index);
  dash.rotation.z = -0.2;
  mark.add(dash);
}

const pin = new THREE.Group();
const pinBody = new THREE.Mesh(
  new THREE.SphereGeometry(0.78, 32, 24),
  new THREE.MeshStandardMaterial({ color: 0x08a98d, roughness: 0.28, metalness: 0.08 }),
);
pin.add(pinBody);
const pinPoint = new THREE.Mesh(
  new THREE.ConeGeometry(0.48, 1.2, 32),
  new THREE.MeshStandardMaterial({ color: 0x0878d7, roughness: 0.28, metalness: 0.08 }),
);
pinPoint.position.y = -0.9;
pin.add(pinPoint);
const pinEye = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 24, 16),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
);
pinEye.position.set(0, 0.05, 0.7);
pin.add(pinEye);
pin.position.set(0, 1.05, 0);
mark.add(pin);

const ambient = new THREE.HemisphereLight(0xd9f5e9, 0x13233a, 2.4);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffffff, 3.3);
keyLight.position.set(4, 6, 4);
scene.add(keyLight);
const fillLight = new THREE.PointLight(0x0878d7, 18, 11);
fillLight.position.set(-3, 1, 4);
scene.add(fillLight);

function resizeScene() {
  const { width, height } = canvas.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function renderScene(time) {
  mark.rotation.y = time * 0.00035;
  mark.rotation.x = Math.sin(time * 0.001) * 0.07;
  pin.position.y = 1.05 + Math.sin(time * 0.002) * 0.15;
  renderer.render(scene, camera);
  requestAnimationFrame(renderScene);
}

window.addEventListener('resize', resizeScene);
resizeScene();
requestAnimationFrame(renderScene);
