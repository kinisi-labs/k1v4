/* 

knee image functions

*/
var kneeImageData;
const pathToImageDir = "./models/SkeletonOutput/";


async function getKneeImages() {
	const fullPath = pathToImageDir+"rendFileNames.json";
    const response = await fetch(fullPath);
    const json = await response.json();
    kneeImageData = json;
}

getKneeImages();


function renderKneeBones(sel, index,view,side) {
	view = view == "lateral" ? "lateral" : "front";
	side = side == "left"    ? "left"    : "right";

	const imagePath = "./models/"

	/*
	if (view == "lateral")	
  		bw.DOM(sel)[0].innerHTML = "<img style='width:100%;height:100%', src="+imagePath+kneeImageData.lateralFiles  [index % kneeImageData.lateralFiles.length]+" />"
  	else
  		bw.DOM(sel)[0].innerHTML = "<img style='width:100%;height:100%', src="+imagePath+kneeImageData.frontFiles  [index % kneeImageData.frontFiles.length]+" />"
	*/

	if (view == "lateral")	
  		bw.DOM(sel)[0].src = imagePath+kneeImageData.lateralFiles  [index % kneeImageData.lateralFiles.length];
  	else
  		bw.DOM(sel)[0].src = imagePath+kneeImageData.frontFiles  [index % kneeImageData.frontFiles.length];

  	//use CSS class .flipHorizontal to flip image
  	if (side == "left")  {
  		bw.DOMClass(sel,"flipHorizontal","")
  	}
  	else {
		bw.DOMClass(sel,"flipHorizontal","flipHorizontal")
  	}
  	return index;
}

function renderKneeBonesAngle(sel,angle,view,side) {
	return renderKneeBones(sel, Math.round(bw.mapScale(angle,0,90,0,kneeImageData.lateralFiles.length-1,{clip:true})) ,view,side)
}
