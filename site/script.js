import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js';

const launcher = document.querySelector('.via-launcher');
const panel = document.querySelector('#via-panel');
const answer = document.querySelector('#via-answer');
const modeSwitch = document.querySelector('#mode-switch');
function setAssistant(open) { panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open)); }
launcher.addEventListener('click', () => setAssistant(panel.hidden));
document.querySelector('[data-via-close]').addEventListener('click', () => setAssistant(false));
document.querySelectorAll('[data-answer]').forEach((button) => button.addEventListener('click', () => { answer.textContent = button.dataset.answer; }));

const canvas = document.querySelector('#via-universe');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070c, 0.032);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0.2, 8.8);

const world = new THREE.Group();
world.rotation.set(-0.32, -0.48, 0.04);
scene.add(world);
const roadRotation = new THREE.Euler(Math.PI / 2, 0.14, -0.18);
const road = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.55, 18, 100, Math.PI * 1.72), new THREE.MeshStandardMaterial({ color: 0x182532, roughness: 0.42, metalness: 0.37 }));
road.rotation.copy(roadRotation); world.add(road);
const roadEdge = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.62, 12, 100, Math.PI * 1.72), new THREE.MeshStandardMaterial({ color: 0x2789ff, roughness: 0.3, metalness: 0.28 }));
roadEdge.rotation.copy(roadRotation); roadEdge.position.z = -0.08; world.add(roadEdge);

const beacon = new THREE.Group();
const shell = new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 32), new THREE.MeshStandardMaterial({ color: 0x1de1bd, roughness: 0.24, metalness: 0.18 }));
shell.scale.set(1.24, 0.72, 0.63); beacon.add(shell);
const iris = new THREE.Mesh(new THREE.SphereGeometry(0.47, 32, 20), new THREE.MeshStandardMaterial({ color: 0x07101b, roughness: 0.18, metalness: 0.2 }));
iris.scale.set(1, 1, 0.3); iris.position.z = 0.63; beacon.add(iris);
const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12 }));
pupil.position.set(0.12, 0.1, 0.75); beacon.add(pupil);
const tail = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.55, 42), new THREE.MeshStandardMaterial({ color: 0x2789ff, roughness: 0.27, metalness: 0.15 }));
tail.position.y = -1.13; beacon.add(tail); beacon.position.set(0.22, 0.36, 0.15); world.add(beacon);

const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xf2f7fb, roughness: 0.3, metalness: 0.12 });
for (let index = 0; index < 20; index += 1) { const angle = -0.32 + index * 0.23; const dash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.38), dashMaterial); dash.position.set(Math.cos(angle) * 2.43, Math.sin(angle) * 2.43, 0.13); dash.rotation.z = angle + Math.PI / 2; world.add(dash); }
const starPositions = [];
for (let i = 0; i < 780; i += 1) { const r = 10 + Math.random() * 30; const t = Math.random() * Math.PI * 2; const p = Math.acos(2 * Math.random() - 1); starPositions.push(r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)); }
const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xb9d7f5, size: 0.038, transparent: true, opacity: 0.85 })); scene.add(stars);
scene.add(new THREE.HemisphereLight(0x8bdcff, 0x05070c, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 3.6); key.position.set(4, 5, 7); scene.add(key);
const cyan = new THREE.PointLight(0x1de1bd, 18, 11); cyan.position.set(-2, 1, 3); scene.add(cyan);
const blue = new THREE.PointLight(0x2789ff, 15, 10); blue.position.set(4, -2, 2); scene.add(blue);
let mouseX = 0, mouseY = 0, city = false;
window.addEventListener('pointermove', (event) => { mouseX = (event.clientX / innerWidth - .5) * 2; mouseY = (event.clientY / innerHeight - .5) * 2; });
modeSwitch.addEventListener('click', () => { city = !city; document.body.classList.toggle('city-mode', city); modeSwitch.setAttribute('aria-pressed', String(city)); modeSwitch.querySelector('.mode-label').textContent = city ? 'Modo noite' : 'Modo cidade'; scene.fog.color.set(city ? 0xdfeefa : 0x05070c); stars.material.opacity = city ? .2 : .85; });
function resize() { const { width, height } = canvas.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
function render(time) { const still = matchMedia('(prefers-reduced-motion: reduce)').matches; const move = still ? 0 : time * .00025; world.rotation.y = -.48 + move + mouseX * .16; world.rotation.x = -.32 + mouseY * .06; beacon.position.y = .36 + (still ? 0 : Math.sin(time * .0014) * .14); beacon.rotation.y = Math.sin(time * .0008) * .18; stars.rotation.y = -move * .35; renderer.render(scene, camera); requestAnimationFrame(render); }
window.addEventListener('resize', resize); resize(); requestAnimationFrame(render);
