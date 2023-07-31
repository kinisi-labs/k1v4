//mc-ahrs2.js
// Mahony filter constants
const sampleFreq = 50.0; // sample frequency in Hz
const betaDef = 0.1; // 2 * proportional gain

// Quaternion of the estimated orientation
let q0 = 1, q1 = 0, q2 = 0, q3 = 0;

function MahonyAHRSupdate(gx, gy, gz, ax, ay, az, mx, my, mz) {
  let recipNorm;
  let hx, hy, _2bx, _2bz;
  let halfvx, halfvy, halfvz, halfwx, halfwy, halfwz;
  let halfex, halfey, halfez;
  let qa, qb, qc;

  // Use IMU algorithm if magnetometer measurement invalid (avoids NaN in magnetometer normalization)
  if ((mx === 0.0) && (my === 0.0) && (mz === 0.0)) {
    MahonyAHRSupdateIMU(gx, gy, gz, ax, ay, az);
    return;
  }

  // Compute feedback only if accelerometer measurement valid (avoids NaN in accelerometer normalization)
  if (!((ax === 0.0) && (ay === 0.0) && (az === 0.0))) {

    // Normalize accelerometer measurement
    recipNorm = 1 / Math.sqrt(ax * ax + ay * ay + az * az);
    ax *= recipNorm;
    ay *= recipNorm;
    az *= recipNorm;

    // Normalize magnetometer measurement
    recipNorm = 1 / Math.sqrt(mx * mx + my * my + mz * mz);
    mx *= recipNorm;
    my *= recipNorm;
    mz *= recipNorm;

    // Auxiliary variables to avoid repeated arithmetic
    _2q0mx = 2.0 * q0 * mx;
    _2q0my = 2.0 * q0 * my;
    _2q0mz = 2.0 * q0 * mz;
    _2q1mx = 2.0 * q1 * mx;
    _2q0 = 2.0 * q0;
    _2q1 = 2.0 * q1;
    _2q2 = 2.0 * q2;
    _2q3 = 2.0 * q3;
    _2q0q2 = 2.0 * q0 * q2;
    _2q2q3 = 2.0 * q2 * q3;
    q0q0 = q0 * q0;
    q0q1 = q0 * q1;
    q0q2 = q0 * q2;
    q0q3 = q0 * q3;
    q1q1 = q1 * q1;
    q1q2 = q1 * q2;
    q1q3 = q1 * q3;
    q2q2 = q2 * q2;
    q2q3 = q2 * q3;
    q3q3 = q3 * q3;

    // Reference direction of Earth's magnetic field
    hx = mx * q0q0 - _2q0my * q3 + _2q0mz * q2 + mx * q1q1 + _2q1 * my * q2 + _2q1 * mz * q3 - mx * q2q2 - mx * q3q3;
    hy = _2q0mx * q3 + my * q0q0 - _2q0mz * q1 + _2q1mx * q2 - my * q1q1 + my * q2q2 + _2q2 * mz * q3 - my * q3q3;
    _2bx = Math.sqrt(hx * hx + hy * hy);
    _2bz = -_2q0mx * q2 + _2q0my * q1 + mz * q0q0 + _2q1mx * q3 - mz * q1q1 + _2q2 * my * q3 - mz * q2q2 + mz * q3q3;
    _4bx = 2.0 * _2bx;
    _4bz = 2.0 * _2bz;

    // Gradient decent algorithm corrective step
    halfvx = q1q3 - q0q2 - ax;
    halfvy = q0q1 + q2q3 - ay;
    halfvz = q0q0 - 0.5 + q3q3 - az;
    halfwx = _4bx * (0.5 - q2q2 - q3q3) + _2bz * (q1q3 - q0q2) - mx;
    halfwy = _4bx * (q1q2 - q0q3) + _2bz * (q0q1 + q2q3) - my;
    halfwz = _4bx * (q0q2 + q1q3) + _2bz * (0.5 - q1q1 - q2q2) - mz;
    halfex = (ay * halfvz - az * halfvy) + (my * halfwz - mz * halfwy);
    halfey = (az * halfvx - ax * halfvz) + (mz * halfwx - mx * halfwz);
    halfez = (ax * halfvy - ay * halfvx) + (mx * halfwy - my * halfwx);

    // Compute and apply integral feedback if enabled
    if (twoKi > 0.0) {
      integralFBx += twoKi * halfex * (1.0 / sampleFreq); // integral error scaled by Ki
      integralFBy += twoKi * halfey * (1.0 / sampleFreq);
      integralFBz += twoKi * halfez * (1.0 / sampleFreq);
      gx += integralFBx; // apply integral feedback
      gy += integralFBy;
      gz += integralFBz;
    }

    // Apply proportional feedback
    gx += twoKp * halfex;
    gy += twoKp * halfey;
    gz += twoKp * halfez;
  }

  // Integrate rate of change of quaternion
  gx *= (0.5 * (1.0 / sampleFreq)); // pre-multiply common factors
  gy *= (0.5 * (1.0 / sampleFreq));
  gz *= (0.5 * (1.0 / sampleFreq));
  qa = q0;
  qb = q1;
  qc = q2;
  q0 += (-qb * gx - qc * gy - q3 * gz);
  q1 += (qa * gx + qc * gz - q3 * gy);
  q2 += (qa * gy - qb * gz + q3 * gx);
  q3 += (qa * gz + qb * gy - qc * gx);

  // Normalize quaternion
  recipNorm = 1 / Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3);
  q0 *= recipNorm;
  q1 *= recipNorm;
  q2 *= recipNorm;
  q3 *= recipNorm;
}

function MahonyAHRSupdateIMU(gx, gy, gz, ax, ay, az) {
    let recipNorm;
    let halfvx, halfvy, halfvz;
    let halfex, halfey, halfez;
    let qa, qb, qc;

    // Compute feedback only if accelerometer measurement valid (avoids NaN in accelerometer normalization)
    if (!((ax === 0.0) && (ay === 0.0) && (az === 0.0))) {

        // Normalize accelerometer measurement
        recipNorm = 1 / Math.sqrt(ax * ax + ay * ay + az * az);
        ax *= recipNorm;
        ay *= recipNorm;
        az *= recipNorm;

        // Estimated direction of gravity
        halfvx = q1 * q3 - q0 * q2;
        halfvy = q0 * q1 + q2 * q3;
        halfvz = q0 * q0 - 0.5 + q3 * q3;

        // Error is sum of cross product between estimated and measured direction of gravity
        halfex = (ay * halfvz - az * halfvy);
        halfey = (az * halfvx - ax * halfvz);
        halfez = (ax * halfvy - ay * halfvx);

        // Compute and apply integral feedback if enabled
        if (twoKi > 0.0) {
            integralFBx += twoKi * halfex * (1.0 / sampleFreq);  // integral error scaled by Ki
            integralFBy += twoKi * halfey * (1.0 / sampleFreq);
            integralFBz += twoKi * halfez * (1.0 / sampleFreq);
            gx += integralFBx;  // apply integral feedback
            gy += integralFBy;
            gz += integralFBz;
        }

        // Apply proportional feedback
        gx += twoKp * halfex;
        gy += twoKp * halfey;
        gz += twoKp * halfez;
    }

    // Integrate rate of change of quaternion
    gx *= (0.5 * (1.0 / sampleFreq));   // pre-multiply common factors
    gy *= (0.5 * (1.0 / sampleFreq));
    gz *= (0.5 * (1.0 / sampleFreq));
    qa = q0;
    qb = q1;
    qc = q2;
    q0 += (-qb * gx - qc * gy - q3 * gz);
    q1 += (qa * gx + qc * gz - q3 * gy);
    q2 += (qa * gy - qb * gz + q3 * gx);
    q3 += (qa * gz + qb * gy - qc * gx);

    // Normalize quaternion
    recipNorm = 1 / Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3);
    q0 *= recipNorm;
    q1 *= recipNorm;
    q2 *= recipNorm;
    q3 *= recipNorm;
}

/*
module.exports = {
  MahonyAHRSupdate,
  MahonyAHRSupdateIMU,
}

module.exports = {
  MahonyAHRSupdate,
  MahonyAHRSupdateIMU,
}
*/