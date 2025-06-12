// 1. Load a placeholder geometry for the Mau Forest Complex.
// Replace this with the actual asset ID once uploaded to GEE.
var aoi = ee.Geometry.Rectangle([35.0, -0.5, 36.0, 0.5]); // Approximate bounds for Mau Forest

// 2. Print the loaded feature collection (or placeholder geometry) to the console.
print('Area of Interest:', aoi);

// 3. Center the map view on the loaded AOI.
Map.centerObject(aoi, 9); // Zoom level 9, adjust as needed
Map.addLayer(aoi, {color: 'FF0000'}, 'Area of Interest');
