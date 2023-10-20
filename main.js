let context0 = createThreeContext();
context0.init3D("o0");
let context1 = createThreeContext();
context1.init3D("o1");

let mag0Context = createThreeContext();
mag0Context.init3D("mo0");
let mag1Context = createThreeContext();
mag1Context.init3D("mo1");

function getOrientation(a, m) {
  const mahony = new AHRS({
    sampleInterval: 20,
    algorithm: "Mahony",
    beta: 0.0, // only for magdwick
    kp: 0.5, // Default: 0.5
    ki: 0.0, // Default: 0.0
    doInitialisation: false,
  });
  mahony.init(...a, ...m);
  return new Quaternion(mahony.getQuaternion());
}

function vectorSubtract(v1, v2) {
  return v1.map((v, i) => v - v2[i]);
}

function vectorDot(v1, v2) {
  return v1.map((v, i) => v * v2[i]).reduce((a, b) => a + b, 0);
}

function vectorMultiply(v1, v2) {
  return v1.map((v, i) => v * v2[i]);
}

function matrixVectorMultiply(m, v) {
  return m.map((row) => vectorDot(row, v));
}

function vectorMag(a) {
  if (Array.isArray(a)) return Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  return Number(a);
}

function quatToString(q, d) {
  if (!d) {
    d = 2;
  }
  return (
    "[" +
    q.w.toFixed(d) +
    ", " +
    q.x.toFixed(d) +
    ", " +
    q.y.toFixed(d) +
    ", " +
    q.z.toFixed(d) +
    "]"
  );
}
function getV1SleeveDataTransformFunction(calibration) {
  let kp = 15;
  let ki = 0.5;
  AHRS = require("ahrs");
  const thighMahony = new AHRS({
    sampleInterval: 20,
    algorithm: "Mahony",
    beta: 0.0, // only for magdwick
    kp: kp, // Default: 0.5
    ki: ki, // Default: 0.0
    doInitialisation: false,
  });

  const calfMahony = new AHRS({
    sampleInterval: 20,
    algorithm: "Mahony",
    beta: 0.0,
    kp: kp, // Default: 0.5
    ki: ki, // Default: 0.0
    doInitialisation: false,
  });

  let snAvg = 0;
  let snDCEnergy = 0;
  function filterSound(rawSound) {
    if (rawSound === undefined || rawSound == null) {
      return 0;
    }
    let alpha = 0.8;
    let alphaDC = 0.01;
    snAvg = snAvg * (1 - alpha) + rawSound * alpha;
    snDCEnergy = snAvg * (1 - alphaDC) + rawSound * alphaDC;
    return snAvg;
  }

  function applyCalibration(data) {
    if (!calibration.sensorTransforms) {
      return data;
    }
    for (sensorKey in calibration.sensorTransforms) {
      if (!(sensorKey in data)) {
        continue;
      }

      sensorTransforms = calibration.sensorTransforms[sensorKey];
      if ("offset" in sensorTransforms) {
        data[sensorKey] = vectorSubtract(
          data[sensorKey],
          sensorTransforms.offset,
        );
      }

      if ("transformMatrix" in sensorTransforms) {
        data[sensorKey] = matrixVectorMultiply(
          sensorTransforms.transformMatrix,
          data[sensorKey],
        );
      }

      if ("rearrange" in sensorTransforms) {
        data[sensorKey] = sensorTransforms.rearrange.map((idx) => {
          return data[sensorKey][idx];
        });
      }

      if ("scale" in sensorTransforms) {
        data[sensorKey] = vectorMultiply(
          data[sensorKey],
          sensorTransforms.scale,
        );
      }
    }
    return data;
  }

  let intervalCnt = 0;
  let lastTime = -10;
  let magFreq = 1;

  let thighQuat = new Quaternion(1, 0, 0, 0);
  let calfQuat = new Quaternion(1, 0, 0, 0);

  let calfRot = new Quaternion(1, 0, 0, 0); //0.82, 0.36, 0.31, -0.31);//Quaternion.fromEulerLogical(Math.PI, Math.PI / 2, 0, 'XZY');
  let thighRot = new Quaternion(1, 0, 0, 0); //0.82, 0.36, 0.31, -0.31);//Quaternion.fromEulerLogical(Math.PI, Math.PI / 2, 0, 'XZY');

  return (gd) => {
    //{"g0":[0.0018326,-0.0894917,-0.0691805],"t":1461690979011,"m1":[29.6112,-22.9611,108.082],"g1":[0.0355829,-0.0558941,-0.029627],"i":3210,"tx":1461719665540,"a0":[-0.100499,0.00358923,10.0259],"a1":[-9.52343,-1.09472,-1.26461],"sn":4,"m0":[80.0497,-52.4115,7.23472],"tmp":23.0039,"prx":0,"bar":1027.42,"v":"1.0.2","alt":-117.571,"hum":39.5758,"col":[302,168,191,688]};
    if (!gd) {
      return undefined;
    }

    let athleteInfo = {
      weightKg: 70,
      heightM: 1.6,
    };

    gd = applyCalibration(gd);
    let dt = (gd.t_s - lastTime) / 1000;
    if (dt >= 0.002) {
      if (gd.g0 && gd.a0 && gd.m0) {
        if (dt >= 1) {
          thighMahony.init(...gd.a0, ...gd.m0);
          thighRot = new Quaternion(thighMahony.getQuaternion()).inverse();
          calfRot = thighRot;
        } else if (intervalCnt % magFreq === 0) {
          thighMahony.update(...gd.g0, ...gd.a0, ...gd.m0, dt);
        } else {
          thighMahony.update(...gd.g0, ...gd.a0, dt);
        }

        let q = new Quaternion(thighMahony.getQuaternion());
        q = thighRot.mul(q);
        thighQuat = q;
      }

      if (gd.g1 && gd.a1 && gd.m1) {
        if (dt >= 1) {
          calfMahony.init(...gd.a1, ...gd.m1);
        } else if (intervalCnt % magFreq === 0) {
          calfMahony.update(...gd.g1, ...gd.a1, ...gd.m1, dt);
        } else {
          calfMahony.update(...gd.g1, ...gd.a1, dt);
        }

        let q = new Quaternion(calfMahony.getQuaternion());
        q = calfRot.mul(q);
        calfQuat = q;
      }
      lastTime = gd.t_s;
    }

    let angleQuat = thighQuat.inverse().mul(calfQuat);

    let [tilt, rotation, flexion] = angleQuat.toEuler("ZXY");
    [tilt, rotation, flexion] = vectorScale(
      angleQuat.toEuler("ZXY"),
      180 / Math.PI,
    );
    intervalCnt += 1;
    let thighAccel = vectorMag(gd.a0);
    let calfAccel = vectorMag(gd.a1);

    return {
      flexion: [flexion],
      tilt: [tilt],
      rotation: [rotation],
      thigh: [thighAccel, thighAccel * athleteInfo.weightKg * 0.07],
      calf: [calfAccel, calfAccel * athleteInfo.weightKg * 0.049],
      thighRPY: thighQuat.toEuler("ZXY").map((x) => (x * 180) / Math.PI),
      calfRPY: calfQuat.toEuler("ZXY").map((x) => (x * 180) / Math.PI),
      thighQuat: thighQuat,
      calfQuat: calfQuat,
      angleQuat: angleQuat,
      gd: gd,
    };
  };
}

const CALIBRATIONS = {
  "kinisi-labs-k1x-6416b4": {
    sensorTransforms: {
      m0: {
        offset: [-325.8030587580871, 26.357975233757198, -39.66244435562523],
        transformMatrix: [
          [0.011535990469127476, 0.0006415064719033258, 8.72700027252829e-5],
          [0.0006415064719033264, 0.011334593079291527, 4.385222274645811e-5],
          [8.727000272528286e-5, 4.3852222746457414e-5, 0.011632286133686451],
        ],
      },
      m1: {
        rearrange: [1, 0, 2],
        scale: [1, 1, -1],
        offset: [6.052624216753724, 46.10499126952387, 44.28929751859405],
        transformMatrix: [
          [0.011790062942161266, -0.00011683870912479492, 9.746834147530805e-5],
          [
            -0.00011683870912479503, 0.011035210952801099,
            -4.603591541604084e-5,
          ],
          [9.746834147530828e-5, -4.603591541604039e-5, 0.011173405078418613],
        ],
      },
      g0: {
        offset: [
          0.14279897435897373, -0.10606974358974357, -0.05713649572649557,
        ],
      },
      g1: {
        rearrange: [1, 0, 2],
        scale: [-1, 1, 1],
        offset: [
          0.012463777994157871, 0.001294741966893882, 0.01764722492697168,
        ],
      },
      a1: {
        rearrange: [1, 0, 2],
        scale: [-1, 1, 1],
      },
    },
  },
  "kinisi-labs-k1x-4e5765": {
    sensorTransforms: {
      a1: {
        scale: [-1, 1, 1],
        rearrange: [1, 0, 2],
      },
      g0: {
        offset: [0.07635815495833333, -0.1211549353333334, -0.043829579875],
      },
      g1: {
        scale: [-1, 1, 1],
        offset: [
          -0.01760405841666666, 0.01237161766666667, -0.008026031791666666,
        ],
        rearrange: [1, 0, 2],
      },
      m0: {
        scale: vectorScale([1, 1, 1], 0.01),
        offset: [141.37678525, -103.2373543, 95.05261612],
      },
      m1: {
        scale: vectorScale([1, 1, -1], 0.01),
        offset: [19.64999962, 15.30000019, -30.749999045],
        rearrange: [1, 0, 2],
      },
    },
  },
  "kinisi-labs-k1x-f1bcad": {
    sensorTransforms: {
      a1: { scale: [-1, 1, 1], rearrange: [1, 0, 2] },
      g0: {
        offset: [-0.2005533961213536, 0.1336305107526261, 0.1810584553722289],
      },
      g1: {
        scale: [-1, 1, 1],
        offset: [0.1514726423862308, 0.1362121246102685, 0.318880108168028],
        rearrange: [1, 0, 2],
      },
      m0: {
        scale: vectorScale([1, 1, 1], 0.01),
        offset: [-273.12190245, 14.19906521, -5.312774659999999] },
      m1: {
        scale: vectorScale([1, 1, -1], 0.01),
        offset: [-17.40000057, 0.8999996150000023, -16.875000955],
        rearrange: [1, 0, 2],
      },
    },
  },

};
// TODO: get calibration from somewhere else
let calibration = CALIBRATIONS["kinisi-labs-k1x-f1bcad"];

let transformFunction = getV1SleeveDataTransformFunction(calibration);

// show data streaming stats
if (bw.getURLParam("showstats", "false") == "true") {
  bw.DOM("#infobarcontainer")[0].style.display = "block";
} else {
  bw.DOM("#infobarcontainer")[0].style.display = "none";
}
bw.getURLParam("showstats", "true");
const maxlen = 120; // chart len in points

let a0 = newChartJSLineChart("#a0", 3, "Thigh Accel", maxlen, [-20, 20]);
let g0 = newChartJSLineChart("#g0", 3, "Thigh Gyro", maxlen, [-10, 10]);
let m0 = newChartJSLineChart("#m0", 4, "Thigh Mags", maxlen, [-2, 2]);

let a1 = newChartJSLineChart("#a1", 3, "Calf Accel", maxlen, [-20, 20]);
let g1 = newChartJSLineChart("#g1", 3, "Calf Gyro", maxlen, [-10, 10]);
let m1 = newChartJSLineChart("#m1", 4, "Calf Mags", maxlen, [-2, 2]);

let sn = newChartJSLineChart("#sn", 1, "Sound Energy", maxlen, [0, 250]);
let snAvg = 0;
let snDCEnergy = 0;

let flexion = newChartJSLineChart(
  "#flexion",
  3,
  "Flexion, Tilt, Rotation Angle",
  maxlen,
  [-30, 150],
);

let accel_chart = newChartJSLineChart(
  "#tilt_rot",
  2,
  "Thigh and Calf Acceleration",
  maxlen,
  [-50, 50],
);

//let o0 = newChartJSLineChart("#o0", 3, "Orientation 0", maxlen, [-200, 200]);
//let o1 = newChartJSLineChart("#o1", 3, "Orientation 1", maxlen, [-200, 200]);
//let o0 = newChartJSLineChart("#o0", 3, "Orientation 0", maxlen, [-1, 1]);
//let o1 = newChartJSLineChart("#o1", 3, "Orientation 1", maxlen, [-1, 1]);

// state vars
let thighState = { quat: [1, 0, 0, 0], intFB: [0, 0, 0] };
let calfState = { quat: [1, 0, 0, 0], intFB: [0, 0, 0] };

//computed from quaternion
let thighRPY = [0, 0, 0];
let calfRPY = [0, 0, 0];
/*
  let mahony0 = new Mahony(20);
  let mahony1 = new Mahony(20);
*/
let ahrs_init = false;

let cnt = 0;
//update renderings
setInterval(function () {
  let cntOld = cnt;
  cnt = gDataStorage.data.length;
  if (cnt < cntOld) {
    cnt = 0;
    return;
  }

  let transformed;
  for (let idx = cntOld; idx < cnt; idx++) {
    var gd = JSON.parse(JSON.stringify(gDataStorage.data[idx]));

    if ("a0" in gDataStable) {
      transformed = transformFunction(gd);
    }
  }
  if (transformed) {
    flexion.updateChart(
      [...transformed.flexion, ...transformed.tilt, ...transformed.rotation],
      true,
    );

    context0.update3d(transformed.thighQuat);
    context1.update3d(transformed.calfQuat);
    mag0Context.update3d(getOrientation(transformed.gd.a0, transformed.gd.m0));
    mag1Context.update3d(getOrientation(transformed.gd.a1, transformed.gd.m1));

    bw.DOM("#ahrs")[0].innerHTML =
      "flexion: " +
      transformed.flexion +
      "<br>" +
      "tilt: " +
      transformed.tilt +
      "<br>" +
      "rotn: " +
      transformed.rotation +
      "<br>" +
      "magDotProd: " +
      vectorDot(transformed.gd.m0, transformed.gd.m1) +
      "<br>" +
      "angleQuat: " +
      quatToString(transformed.angleQuat) +
      "<br>" +
      "thighQuat: " +
      quatToString(transformed.thighQuat) +
      "<br>" +
      "calfQuat: " +
      quatToString(transformed.calfQuat) +
      "<br>" +
      "latitude: " +
      gDataStable.g_lat +
      "<br>" +
      "longitude: " +
      gDataStable.g_lon +
      "<br>";
  }

  if (transformed) {
    if ("a0" in gDataStable) {
      a0.updateChart(transformed.gd["a0"], true);
      accel_chart.updateChart([transformed.thigh[0], transformed.calf[0]]);
    }

    if ("g0" in gDataStable) g0.updateChart(transformed.gd["g0"], true);

    if ("m0" in gDataStable) {
      console.log(transformed.gd["m0"][1]);
      m0.updateChart(transformed.gd["m0"], true);
    }

    if ("a1" in gDataStable) a1.updateChart(transformed.gd["a1"], true);

    if ("g1" in gDataStable) g1.updateChart(transformed.gd["g1"], true);

    if ("m1" in gDataStable) {
      m1.updateChart(transformed.gd["m1"], true);
    }

    if ("sn" in gDataStable) {
      let alpha = 0.8;
      let alphaDC = 0.01;
      snAvg = snAvg * (1 - alpha) + gDataStable["sn"] * alpha;
      snDCEnergy = snAvg * (1 - alphaDC) + gDataStable["sn"] * alphaDC;
      sn.updateChart([gDataStable["sn"]], true);
    }
  }

  // stats area refresh
  let i,
    info = "";
  for (i in gDataStorage.packetInfo) {
    let k = i,
      v = gDataStorage.packetInfo[i];
    info += k + ": " + v.toFixed(2) + "&nbsp;&nbsp;";
  }
  document.getElementById("info").innerHTML = info;
}, 50);

/*
// BLE request enviroment data
setInterval(function () {
try {
if (gBLE.connected)
gBLE.write(JSON.stringify({ "env": "true" })); // fw 1.0.x allows 2 way coms via BLE json
}
catch (e) { }
}, 10000); // every 10 seconds update the environment (pressure, altitude, etc)
*/
