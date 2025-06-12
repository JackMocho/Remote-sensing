// 1. Define the Area of Interest (AOI)
// Placeholder for Mau Forest Complex (replace with actual asset ID when available)
var aoi = ee.Geometry.Rectangle([35.0, -0.5, 36.0, 0.5]); // Approximate bounds

// 2. Create functions to load and filter image collections

/**
 * Loads and filters Landsat 5 TM Surface Reflectance imagery.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} The filtered image collection.
 */
function loadLandsat5(geometry) {
  return ee.ImageCollection('LANDSAT/LT05/C01/T1_SR') // Tier 1 Surface Reflectance
    .filterDate('1984-01-01', '2011-12-31')
    .filterBounds(geometry);
}

/**
 * Loads and filters Landsat 7 ETM+ Surface Reflectance imagery.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} The filtered image collection.
 */
function loadLandsat7(geometry) {
  return ee.ImageCollection('LANDSAT/LE07/C01/T1_SR') // Tier 1 Surface Reflectance
    .filterDate('1999-01-01', '2020-12-31')
    .filterBounds(geometry);
}

/**
 * Loads and filters Landsat 8 OLI/TIRS Surface Reflectance imagery.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} The filtered image collection.
 */
function loadLandsat8(geometry) {
  return ee.ImageCollection('LANDSAT/LC08/C01/T1_SR') // Tier 1 Surface Reflectance
    .filterDate('2013-01-01', '2020-12-31')
    .filterBounds(geometry);
}

/**
 * Loads and filters MODIS Terra Vegetation Indices (NDVI).
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} The filtered image collection with NDVI band selected.
 */
function loadModisNdvi(geometry) {
  return ee.ImageCollection('MODIS/006/MOD13Q1')
    .filterDate('2000-01-01', '2020-12-31')
    .filterBounds(geometry)
    .select('NDVI');
}

// 4. Call each function and print the size of the resulting image collection.

// Load Landsat 5
var landsat5Col = loadLandsat5(aoi);
print('Landsat 5 Collection Size:', landsat5Col.size());

// Load Landsat 7
var landsat7Col = loadLandsat7(aoi);
print('Landsat 7 Collection Size:', landsat7Col.size());

// Load Landsat 8
var landsat8Col = loadLandsat8(aoi);
print('Landsat 8 Collection Size:', landsat8Col.size());

// Load MODIS NDVI
var modisNdviCol = loadModisNdvi(aoi);
print('MODIS NDVI Collection Size:', modisNdviCol.size());

// Optional: Add AOI to map for visualization
Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: 'FFFF00'}, 'Area of Interest');
