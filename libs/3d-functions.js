
function createThreeContext() {
  // 3d model
  let renderer = new THREE.WebGLRenderer();
  let scene = new THREE.Scene();
  let camera = new THREE.PerspectiveCamera(75, 1, 1, 10000);

  let axesHelper;
  let quaternion = new THREE.Quaternion();


  function init3D(element) {
    console.log("init3D called...")
    var container = document.getElementById(element);
    //var loader = new THREE.GLTFLoader();

    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(4);
    container.appendChild(renderer.domElement);
    var model = bw.getURLParam("model") == "./assets/nano33ble.glb"; //  "./assets/RiggedFigure.glb"; //"nano" ? "./assets/nano33ble.glb" : "./assets/RiggedFigure.glb";
    axesHelper = new THREE.AxesHelper(3); // The number defines the size of the helper scene.add(axesHelper);
    scene.add(axesHelper);
    scene.add(new THREE.AxesHelper(0.5));
    camera.position.set(4, 4, 4);
    //camera.rotation.z = Math.PI; // 180
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    renderer.render(scene, camera);
  }
  /*
  loader.load(model, // ./assets/RiggedFigure.glb ./
    // called when the Arduinio model is loaded
    function (gltf) {
      console.log("Model loaded");

      // Model
      arduinoModel = gltf.scene;
      scene.add(arduinoModel);

      // LED
      var geometry = new THREE.BoxGeometry(1, 1, 1);
      ledMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
      ledObject = new THREE.Mesh(geometry, ledMaterial);
      ledObject.position.set(-4.5, 4, 0);
      arduinoModel.add(ledObject);
      ledLight = new THREE.PointLight(0x111111, 3, 100);
      ledLight.position.set(-4.5, 4, -1);

      arduinoModel.add(ledLight);
      var sphereSize = 1;

      // Light
      const color = 0xFFFFFF;
      const intensity = 1;
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(-20, 100, 0);
      light.target.position.set(0, 0, 0);

      scene.add(light);
      scene.add(light.target);
      var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1000);
      scene.add(hemiLight);

      // Camera
      camera.position.set(-2, 1, -1.5);
      camera.rotation.z = Math.PI; // 180
      camera.lookAt(new THREE.Vector3(1, 0, 1));
      renderer.render(scene, camera);
    }
  );
}
*/
  //init3D();

  function update3d(quat) {
    axesHelper.applyQuaternion(quaternion.inverse());
    quaternion = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
    quaternion.normalize();
    axesHelper.applyQuaternion(quaternion);
    renderer.render(scene, camera);
  }

  return {
    init3D,
    update3d
  };
}
