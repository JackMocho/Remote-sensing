// 1. Define the Area of Interest (AOI)
// Placeholder for Mau Forest Complex (replace with actual asset ID when available)
var aoi = ee.Geometry.Rectangle([35.0, -0.5, 36.0, 0.5]); // Approximate bounds

// 2. Landsat Cloud Masking Functions

/**
 * Masks clouds and cloud shadows in Landsat 4, 5, or 7 SR imagery (Collection 1).
 * Uses the 'pixel_qa' band.
 * @param {ee.Image} image A Landsat 4, 5, or 7 SR image.
 * @return {ee.Image} Cloud-masked image.
 */
function maskL457Clouds(image) {
  var qa = image.select('pixel_qa');
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

/**
 * Masks clouds and cloud shadows in Landsat 8 SR imagery (Collection 1).
 * Uses the 'pixel_qa' band.
 * @param {ee.Image} image A Landsat 8 SR image.
 * @return {ee.Image} Cloud-masked image.
 */
function maskL8Clouds(image) {
  var qa = image.select('pixel_qa');
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  // (Assuming same bit positions as L4-7 C1 for L8 C1 pixel_qa,
  // as specific L8 C1 pixel_qa documentation wasn't fetched in this step.
  // For C2 'QA_PIXEL', bits 3 (cloud) and 4 (cloud shadow) would be used).
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

// 3. MODIS Quality Filtering Function

/**
 * Filters MODIS MOD13Q1 images for good quality pixels using 'SummaryQA'.
 * Keeps pixels where SummaryQA is 0 (good) or 1 (marginal).
 * @param {ee.Image} modisImage A MODIS MOD13Q1 image.
 * @return {ee.Image} Quality-filtered image.
 */
function maskModisQuality(modisImage) {
  var summaryQA = modisImage.select('SummaryQA');
  // Keep pixels where SummaryQA is 0 (good) or 1 (marginal).
  var mask = summaryQA.lte(1); // summaryQA <= 1
  return modisImage.updateMask(mask);
}

// 4. Image Loading Functions (Modified to apply masking)

/**
 * Loads and filters Landsat 5 TM Surface Reflectance imagery, applying cloud mask.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} The filtered and cloud-masked image collection.
 */
function loadLandsat5(geometry) {
  return ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
    .filterDate('1984-01-01', '2011-12-31')
    .filterBounds(geometry)
    .map(maskL457Clouds); // Apply cloud masking
}

/**
 * Loads and filters Landsat 7 ETM+ Surface Reflectance imagery, applying cloud mask.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} The filtered and cloud-masked image collection.
 */
function loadLandsat7(geometry) {
  return ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
    .filterDate('1999-01-01', '2020-12-31')
    .filterBounds(geometry)
    .map(maskL457Clouds); // Apply cloud masking
}

/**
 * Loads and filters Landsat 8 OLI/TIRS Surface Reflectance imagery, applying cloud mask.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} The filtered and cloud-masked image collection.
 */
function loadLandsat8(geometry) {
  return ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
    .filterDate('2013-01-01', '2020-12-31')
    .filterBounds(geometry)
    .map(maskL8Clouds); // Apply cloud masking
}

/**
 * Loads and filters MODIS Terra Vegetation Indices (NDVI), applying quality filter.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} The filtered image collection with NDVI band selected and quality-filtered.
 */
function loadModisNdvi(geometry) {
  return ee.ImageCollection('MODIS/006/MOD13Q1')
    .filterDate('2000-01-01', '2020-12-31')
    .filterBounds(geometry)
    .map(maskModisQuality) // Apply quality filtering
    .select('NDVI');
}

// Call each function and print the size of the resulting image collection.
var landsat5Col = loadLandsat5(aoi);
print('Landsat 5 Collection Size (after masking):', landsat5Col.size());

var landsat7Col = loadLandsat7(aoi);
print('Landsat 7 Collection Size (after masking):', landsat7Col.size());

var landsat8Col = loadLandsat8(aoi);
print('Landsat 8 Collection Size (after masking):', landsat8Col.size());

var modisNdviCol = loadModisNdvi(aoi);
print('MODIS NDVI Collection Size (after filtering):', modisNdviCol.size());

// 5. Verification (Optional visual check)
// Add the first image of a masked collection to the map.
// Note: You might need to adjust visualization parameters based on the actual data.
var firstL5Masked = landsat5Col.first();
// Ensure valid image before adding to map, as collection might be empty after filtering in some date/AOI.
if (firstL5Masked) {
  Map.addLayer(firstL5Masked, {bands: ['B3', 'B2', 'B1'], min: 0, max: 3000}, 'Masked L5 Image (First)');
} else {
  print('No image found in Landsat 5 collection after masking for visualization.');
}

var firstModisMasked = modisNdviCol.first();
if (firstModisMasked) {
    // MODIS NDVI visualization parameters
    var ndviVis = {min: 0, max: 9000, palette: ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901', '66A000', '529400', '3E8601', '207401', '056201', '004C00', '023B01', '012E01', '011D01', '011301']};
    Map.addLayer(firstModisMasked.select('NDVI'), ndviVis, 'Masked MODIS NDVI (First)');
} else {
    print('No image found in MODIS NDVI collection after masking for visualization.');
}


// Center map on AOI
Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: 'FF00FF'}, 'Area of Interest (Preprocessing)');
