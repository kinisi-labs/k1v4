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