/*
3d quat viewier (takes div, quaternion) 
requres three.js
*/
function initQuatView(container) {
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const k= 0.75;
    camera.position.set(2*k, 1.5*k, 2*k); // x, y, z — oblique view
    camera.lookAt(0, 0, 0);         // center the view

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.BoxGeometry(1, 0.2, 0.5);
    const material = new THREE.MeshNormalMaterial();
    const imuBox = new THREE.Mesh(geometry, material);
    scene.add(imuBox);

    const axesHelper = new THREE.AxesHelper(1.5);
    scene.add(axesHelper);

    const light = new THREE.AmbientLight(0xffffff, 1);
    scene.add(light);

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    return {
        container,
        scene,
        camera,
        renderer,
        mesh: imuBox,
        updateQuat: function (quat) {
            if (!quat || quat.length !== 4) return;
            const [w, x, y, z] = quat;
            imuBox.quaternion.set(x, y, z, w); // Note: THREE uses (x, y, z, w)
        }
    };
}