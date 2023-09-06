import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x000000 );
var container = document.getElementById("three-knee-lateral");
var w = container.offsetWidth - 2;
var h = container.offsetHeight - 2;
const camera = new THREE.PerspectiveCamera( 130, w / h, 0.1, 200000 );

const renderer = new THREE.WebGLRenderer({alpha: true});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(w, h);
container.appendChild(renderer.domElement);

scene.background.set(0xffffe0);

const loader = new GLTFLoader();
let thighModel = undefined;
let calfModel = undefined;
/*
loader.load('models/Manu_skeleton_male_v1_with_camera_movement_no_left_femur.glb',
            (gltf) => {
    thighModel = gltf.scene;
                //const material = new MeshBasicMaterial( {color: 0xe3dac9});
                //thighModel.material = material;

    scene.add(thighModel);
                console.log("Added model");
    animate();
            });

/*
loader.load('models/Manu_skeleton_male_v1_with_camera_movement_no_left_tibia_fibula.glb',
            (gltf) => {
    calfModel = gltf.scene;
                //const material = new MeshBasicMaterial( {color: 0xe3dac9});
                //calfModel.material = material;
    scene.add(calfModel);
                console.log("Added model");
            });
            */
let controls = new OrbitControls(camera, renderer.domElement);

const geometry = new THREE.BoxGeometry( 0.05, 0.05, 0.05);
const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

thighModel = new THREE.Mesh(new THREE.BoxGeometry(5, 0.75, 0.5),
                            new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
calfModel = new THREE.Mesh(new THREE.BoxGeometry(5, 0.75, 0.5),
                            new THREE.MeshBasicMaterial({ color: 0x0000ff }));

thighModel.position.setX(-2.75);
calfModel.position.setX(2.75);

let calfPoint = new THREE.Object3D();
let thighPoint = new THREE.Object3D();
scene.add(thighPoint);
scene.add(calfPoint);
thighPoint.add(thighModel);
calfPoint.add(calfModel);

let axesHelper = new THREE.AxesHelper(1);
scene.add(axesHelper);

camera.position.y = 5;

let angle = 0;
let dir = 1.;

function animate() {
	requestAnimationFrame( animate );

	//cube.rotation.x += 0.01;
	//cube.rotation.y += 0.01;
  //cube.quaternion.set(0.4469983, 0.4469983, 0.7240368, 0.2759632);
  if (angle <= 0) {
    dir = 1.;
  } else if (angle >= 3 * Math.PI / 8){
    dir = -1;
  }

  angle += dir * Math.PI / 400.;

  console.log("Calf Quat", window.calfQuat);
  console.log("Thigh Quat", window.thighQuat);
  if (window.calfQuat) {
    calfPoint.quaternion.set(...window.calfQuat);
  }
  if (window.thighQuat) {
    thighPoint.quaternion.set(...window.thighQuat);
  }

  controls.update();

	renderer.render( scene, camera );
}

animate();
