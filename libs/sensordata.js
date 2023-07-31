//sensordata.js

//===================================
/*
vectorAngle (requires 2 3D vectors)
    a[x,y,z]
    b[x,y,z]
*/
vectorAngle = function (a, b, degrees) {
    var p = 0;
    try {
        p = vectorDotProd(a,b) / (vectorMag(a)*vectorMag(b));
    }
    catch (e) {
        console.log (e);
        p=0;
    }
    p = Math.acos(p);
    return degrees == true ? p*180/3.14159265 : p;
}

//===================================
/*
    
*/
vectorDotProd = function  (a,b ) {
    var i=0, p=0;
    if (a.length != b.length)
        return 0;
    for (i=0; i<a.length; i++) {
        p+= a[i]*b[i];
    }
    return p;
}

vectorMag = function (a) {
    if (bw.to(a) == "array")
        return Math.sqrt(a.reduce((s,x)=>s+x*x,0));
    return Number(a);
}

vectorScale = function (a, s) {
    var i=0, p=[];
    for (i=0; i<a.length; i++) {
        p[i] = a[i]*s;
    }
    return p;
}

vectorNorm = function (a) {
    var m = vectorMag(a);
    return vectorScale(a, 1/m);
}
/* create a rotation matrix about the specified axes */
createRotMatrix = function (roll, pitch, yaw, degrees) {
    if (degrees == true) {
        roll *= 3.14159265/180;
        pitch *= 3.14159265/180;
        yaw *= 3.14159265/180;
    }

    var c1 = Math.cos(roll);
    var s1 = Math.sin(roll);
    var c2 = Math.cos(pitch);
    var s2 = Math.sin(pitch);
    var c3 = Math.cos(yaw);
    var s3 = Math.sin(yaw);

    var m = [
        [c2 * c3, -c2 * s3, s2],
        [c1 * s3 + c3 * s1 * s2, c1 * c3 - s1 * s2 * s3, -c2 * s1],
        [s1 * s3 - c1 * c3 * s2, c3 * s1 + c1 * s2 * s3, c1 * c2]
    ];

    return m;
}

const mrotx = createRotMatrix(90, 0, 0, true);
const mroty = createRotMatrix(0, 90, 0, true);
const mrotz = createRotMatrix(0, 0, 90, true);

/* rotate a vector a by 3x3 matrix m */
vectorRot = function (a, m) {
    var i=0, j=0, p=[];
    for (i=0; i<3; i++) {
        p[i] = 0;
        for (j=0; j<3; j++) {
            p[i] += a[j]*m[i][j];
        }
    }
    return p;
}