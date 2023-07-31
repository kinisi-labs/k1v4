
    // 3d model
    var renderer = new THREE.WebGLRenderer();
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, 1, 1, 10000);

    function init3D() {
      console.log("init3D called...")
      var container = document.getElementById('a0');
      var loader = new THREE.GLTFLoader();
      scene.background = new THREE.Color(0x111111);

      renderer.setSize(container.offsetWidth, container.offsetHeight);
      renderer.setPixelRatio(4);
      container.appendChild(renderer.domElement);
      var model = bw.getURLParam("model") == "nano" ? "./assets/nano33ble.glb" : "./assets/RiggedFigure.glb";

      loader.load(model, // ./assets/RiggedFigure.glb ./
        // called when the Arduinio model is loaded
        function (gltf) {

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
    //init3D();
    function update3d(a0) {
      var c = 0.0174533;
      var Ax = a0[0] * c;// BLEsense['accelerometer'].data.Ax.latest() * 0.0174533;
      var Ay = a0[1] * c;// BLEsense['accelerometer'].data.Ay.latest() * 0.0174533;
      var Az = a0[2] * c;//BLEsense['accelerometer'].data.Az.latest() * 0.0174533;
      var pitch = Math.atan2((-Ax), Math.sqrt(Ay * Ay + Az * Az));
      var roll = Math.atan2(Ay, Az);
      arduinoModel.rotation.x = roll;
      arduinoModel.rotation.y = pitch;
      arduinoModel.rotation.z = 0;
      renderer.render(scene, camera);
    }