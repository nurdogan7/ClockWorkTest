//Creates scene and camera
import * as THREE from 'https://unpkg.com/three@0.138.0/build/three.module.js';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.5, 1000);
const renderer = new THREE.WebGLRenderer;

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(20,20,20);
const material = new THREE.MeshBasicMaterial({ color: 0x00a3b4 });
const cube = new THREE.Mesh(geometry, material);

cube.rotation.x = Math.PI / 8;
cube.rotation.y = Math.PI / 8;
scene.add(cube);

camera.position.z = 80;

const render = () => {
  requestAnimationFrame(render);
  cube.rotation.y += 0.03;
  cube.rotation.x += 0.01;
  renderer.render(scene, camera);
};
render();
