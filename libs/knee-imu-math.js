// knee math for joint angles
// knee-angle-math.md in root for explanations

export class KneeAngleCalculator {
  static quatToMat3({ w, x, y, z }) {
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    return [
      1 - 2 * (yy + zz),     2 * (xy - wz),       2 * (xz + wy),
      2 * (xy + wz),         1 - 2 * (xx + zz),   2 * (yz - wx),
      2 * (xz - wy),         2 * (yz + wx),       1 - 2 * (xx + yy)
    ];
  }

  static transposeMat3(m) {
    return [
      m[0], m[3], m[6],
      m[1], m[4], m[7],
      m[2], m[5], m[8]
    ];
  }

  static mat3Mul(a, b) {
    let out = new Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        out[i * 3 + j] = 0;
        for (let k = 0; k < 3; k++) {
          out[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
        }
      }
    }
    return out;
  }

  static mat3ToEulerYXZ(m) {
    let sy = -m[2]; // -r13
    let cy = Math.sqrt(1 - sy * sy);

    let x, y, z;
    if (cy > 1e-6) {
      x = Math.atan2(m[5], m[8]); // r23, r33
      y = Math.asin(sy);
      z = Math.atan2(m[1], m[0]); // r12, r11
    } else {
      x = Math.atan2(-m[7], m[4]); // -r32, r22
      y = Math.asin(sy);
      z = 0;
    }

    return {
      flexion: x * 180 / Math.PI,
      rotation: y * 180 / Math.PI,
      tilt: z * 180 / Math.PI
    };
  }

  static computeKneeAngles(q_thigh, q_shin) {
    const R_thigh = this.quatToMat3(q_thigh);
    const R_shin  = this.quatToMat3(q_shin);
    const R_rel   = this.mat3Mul(this.transposeMat3(R_thigh), R_shin);
    return this.mat3ToEulerYXZ(R_rel);
  }
}

export class MahonyFilter {
  constructor(kp = 1.0, ki = 0.0) {
    this.kp = kp;
    this.ki = ki;
    this.q = { w: 1, x: 0, y: 0, z: 0 };
    this.integral = { x: 0, y: 0, z: 0 };
  }

  normalize(v) {
    const norm = Math.hypot(v.x, v.y, v.z);
    return norm > 0 ? { x: v.x / norm, y: v.y / norm, z: v.z / norm } : { x: 0, y: 0, z: 0 };
  }

  update(g, a, m = null, dt) {
    const q = this.q;
    a = this.normalize(a);
    if (!a || (a.x === 0 && a.y === 0 && a.z === 0)) return;

    let ex = 0, ey = 0, ez = 0;

    // Gravity direction from quaternion
    const vx = 2 * (q.x * q.z - q.w * q.y);
    const vy = 2 * (q.w * q.x + q.y * q.z);
    const vz = q.w * q.w - q.x * q.x - q.y * q.y + q.z * q.z;

    ex += (a.y * vz - a.z * vy);
    ey += (a.z * vx - a.x * vz);
    ez += (a.x * vy - a.y * vx);

    if (m) {
      m = this.normalize(m);
      if (!(m.x === 0 && m.y === 0 && m.z === 0)) {
        const q1 = q.w, q2 = q.x, q3 = q.y, q4 = q.z;

        const hx = 2 * m.x * (0.5 - q3 * q3 - q4 * q4) + 2 * m.y * (q2 * q3 - q1 * q4) + 2 * m.z * (q2 * q4 + q1 * q3);
        const hy = 2 * m.x * (q2 * q3 + q1 * q4) + 2 * m.y * (0.5 - q2 * q2 - q4 * q4) + 2 * m.z * (q3 * q4 - q1 * q2);
        const bx = Math.sqrt(hx * hx + hy * hy);

        const wz = q1 * q1 - q2 * q2 - q3 * q3 + q4 * q4;
        const wx = 2 * (q2 * q4 - q1 * q3);
        const wy = 2 * (q1 * q2 + q3 * q4);

        const mx = m.x, my = m.y, mz = m.z;
        const exMag = (my * wz - mz * wy);
        const eyMag = (mz * wx - mx * wz);
        const ezMag = (mx * wy - my * wx);

        ex += exMag;
        ey += eyMag;
        ez += ezMag;
      }
    }

    this.integral.x += this.ki * ex * dt;
    this.integral.y += this.ki * ey * dt;
    this.integral.z += this.ki * ez * dt;

    g.x += this.kp * ex + this.integral.x;
    g.y += this.kp * ey + this.integral.y;
    g.z += this.kp * ez + this.integral.z;

    const gx = g.x * (0.5 * dt);
    const gy = g.y * (0.5 * dt);
    const gz = g.z * (0.5 * dt);

    const qw = q.w, qx = q.x, qy = q.y, qz = q.z;
    this.q.w += -qx * gx - qy * gy - qz * gz;
    this.q.x +=  qw * gx + qy * gz - qz * gy;
    this.q.y +=  qw * gy - qx * gz + qz * gx;
    this.q.z +=  qw * gz + qx * gy - qy * gx;

    const norm = Math.hypot(this.q.w, this.q.x, this.q.y, this.q.z);
    this.q.w /= norm;
    this.q.x /= norm;
    this.q.y /= norm;
    this.q.z /= norm;
  }

  getQuaternion() {
    return this.q;
  }
}