//ahrs fns written on Jul 29 2023
// Quaternion class to handle quaternion calculations
class Quaternion {
    constructor(w, x, y, z) {
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    multiply(q) {
        const w = this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z;
        const x = this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y;
        const y = this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x;
        const z = this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w;
        return new Quaternion(w, x, y, z);
    }

    normalize() {
        const magnitude = Math.sqrt(this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z);
        this.w /= magnitude;
        this.x /= magnitude;
        this.y /= magnitude;
        this.z /= magnitude;
    }
}

// Mahony class to estimate orientation using Mahony algorithm
class Mahony {
    constructor(sampleFreq, kp = 0.5, ki = 0.01) {
        this.sampleFreq = sampleFreq;
        this.kp = kp; // Proportional gain
        this.ki = ki; // Integral gain

        this.quaternion = new Quaternion(1, 0, 0, 0); // Initial quaternion
        this.integralError = new Quaternion(0, 0, 0, 0);
    }

    updateIMU(gyro, acc, mag) {
        let x, y, z, ax, ay, az, mx, my, mz;
        [x, y, z] = gyro;
        [ax, ay, az] = acc;
        [mx, my, mz] = mag;

        // Convert gyroscope readings to radians per second
        const gx = x * (Math.PI / 180);
        const gy = y * (Math.PI / 180);
        const gz = z * (Math.PI / 180);

        // Normalized accelerometer and magnetometer readings
        const normAcc = Math.sqrt(ax * ax + ay * ay + az * az);
        const normMag = Math.sqrt(mx * mx + my * my + mz * mz);
        
       // console.log(normAcc, normMag)
        // Avoid division by zero
        if (normAcc === 0 || normMag === 0) return;

        const invNormAcc = 1.0 / normAcc;
        const invNormMag = 1.0 / normMag;

        // Normalize accelerometer and magnetometer readings
        const accX = ax * invNormAcc;
        const accY = ay * invNormAcc;
        const accZ = az * invNormAcc;

        const magX = mx * invNormMag;
        const magY = my * invNormMag;
        const magZ = mz * invNormMag;

        // Reference direction of Earth's magnetic field
        const hx = magX * this.quaternion.w - magZ * this.quaternion.y;
        const hy = magX * this.quaternion.z + magZ * this.quaternion.x;
        const bx = Math.sqrt(hx * hx + hy * hy);
        const bz = magY * this.quaternion.w - magX * this.quaternion.x + magZ * this.quaternion.y;

        // Estimated direction of gravity and magnetic field
        const halfSEq_1 = 0.5 * this.quaternion.w;
        const halfSEq_2 = 0.5 * this.quaternion.x;
        const halfSEq_3 = 0.5 * this.quaternion.y;
        const halfSEq_4 = 0.5 * this.quaternion.z;

        const halfSEq_1SEq_3 = halfSEq_1 * this.quaternion.y;
        const halfSEq_1SEq_4 = halfSEq_1 * this.quaternion.z;
        const halfSEq_3SEq_4 = halfSEq_3 * this.quaternion.z;
        const halfSEq_1SEq_2 = halfSEq_1 * this.quaternion.x;
        const halfSEq_2SEq_3 = halfSEq_2 * this.quaternion.y;
        const halfSEq_2SEq_4 = halfSEq_2 * this.quaternion.z;

        const twoSEq_1 = 2.0 * this.quaternion.w;
        const twoSEq_2 = 2.0 * this.quaternion.x;
        const twoSEq_3 = 2.0 * this.quaternion.y;
        const twoSEq_4 = 2.0 * this.quaternion.z;

        const twoSEq_1SEq_3 = twoSEq_1 * this.quaternion.y;
        const twoSEq_3SEq_4 = twoSEq_3 * this.quaternion.z;

        // Error is cross product between estimated direction and measured direction of gravity
        const se_1 = twoSEq_1 * accY - twoSEq_3 * accZ - gx;
        const se_2 = twoSEq_2 * accZ + twoSEq_4 * accX - gy;
        const se_3 = twoSEq_2 * accY - twoSEq_3 * accX - gz;

        // Compute and apply integral feedback
        this.integralError.w += this.ki * se_1;
        this.integralError.x += this.ki * se_2;
        this.integralError.y += this.ki * se_3;

        // Apply proportional feedback
        const scaledSEq_1 = this.kp * se_1;
        const scaledSEq_2 = this.kp * se_2;
        const scaledSEq_3 = this.kp * se_3;
        const scaledSEq_4 = 0;

        // Update quaternion using feedback
        this.quaternion.w += scaledSEq_1 - this.integralError.w;
        this.quaternion.x += scaledSEq_2 - this.integralError.x;
        this.quaternion.y += scaledSEq_3 - this.integralError.y;
        this.quaternion.z += scaledSEq_4;

        // Normalize the quaternion
        this.quaternion.normalize();

    }
    // Function to get Euler angles from the quaternion
    getEulerAngles(deg) {
        const { w, x, y, z } = this.quaternion;

        // Roll (x-axis rotation)
        const sinRoll = 2.0 * (w * x + y * z);
        const cosRoll = 1.0 - 2.0 * (x * x + y * y);
        const roll = Math.atan2(sinRoll, cosRoll);

        // Pitch (y-axis rotation)
        const sinPitch = 2.0 * (w * y - z * x);
        const pitch = Math.asin(sinPitch);

        // Yaw (z-axis rotation)
        const sinYaw = 2.0 * (w * z + x * y);
        const cosYaw = 1.0 - 2.0 * (y * y + z * z);
        const yaw = Math.atan2(sinYaw, cosYaw);

        if (deg == true) 
            return [roll*180/Math.PI, pitch*180/Math.PI, yaw*180/Math.PI]
        else 
            return [roll, pitch, yaw];
    }

    // Function to get orientation vector from the quaternion
    getOrientationVector() {
        const { x, y, z } = this.quaternion;
        return [x, y, z];
    }
}
  /*
// Example usage
const mahonyFilter = new Mahony(sampleFreq, kp, ki); // Replace sampleFreq, kp, ki with appropriate values
const gyro = { x: 0.1, y: 0.2, z: 0.3 }; // Replace with actual gyro readings
const acc = { x: 0.1, y: 0.2, z: 9.8 }; // Replace with actual accelerometer readings
const mag = { x: 0.2, y: 0.3, z: 0.4 }; // Replace with actual magnetometer readings
 
mahonyFilter.updateIMU(gyro, acc, mag);
console.log(mahonyFilter.quaternion); // Updated quaternion representing orientation


// Get Euler angles and orientation vector
const eulerAngles = mahonyFilter.getEulerAngles();
const orientationVector = mahonyFilter.getOrientationVector();

console.log("Euler Angles (in radians):", eulerAngles);
console.log("Orientation Vector:", orientationVector);

*/

