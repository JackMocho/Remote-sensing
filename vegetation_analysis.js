// 1. Define the Area of Interest (AOI)
// Placeholder for Mau Forest Complex (replace with actual asset ID when available)
var aoi = ee.Geometry.Rectangle([35.0, -0.5, 36.0, 0.5]); // Approximate bounds

// --- PREPROCESSING FUNCTIONS (from previous step) ---

/**
 * Masks clouds and cloud shadows in Landsat 4, 5, or 7 SR imagery (Collection 1).
 * Uses the 'pixel_qa' band.
 * @param {ee.Image} image A Landsat 4, 5, or 7 SR image.
 * @return {ee.Image} Cloud-masked image.
 */
function maskL457Clouds(image) {
  var qa = image.select('pixel_qa');
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
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
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

/**
 * Filters MODIS MOD13Q1 images for good quality pixels using 'SummaryQA'.
 * @param {ee.Image} modisImage A MODIS MOD13Q1 image.
 * @return {ee.Image} Quality-filtered image.
 */
function maskModisQuality(modisImage) {
  var summaryQA = modisImage.select('SummaryQA');
  var mask = summaryQA.lte(1); // summaryQA <= 1 for good or marginal
  return modisImage.updateMask(mask);
}

// --- NDVI CALCULATION FUNCTIONS ---

/**
 * Calculates NDVI for Landsat 5 or 7.
 * NIR = B4, Red = B3. Output band is named 'NDVI'.
 * @param {ee.Image} image Cloud-masked Landsat 5/7 image.
 * @return {ee.Image} Image with 'NDVI' band.
 */
function calculateL5L7Ndvi(image) {
  var ndvi = image.normalizedDifference(['B4', 'B3']).rename('NDVI');
  return image.addBands(ndvi);
}

/**
 * Calculates NDVI for Landsat 8.
 * NIR = B5, Red = B4. Output band is named 'NDVI'.
 * @param {ee.Image} image Cloud-masked Landsat 8 image.
 * @return {ee.Image} Image with 'NDVI' band.
 */
function calculateL8Ndvi(image) {
  var ndvi = image.normalizedDifference(['B5', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

// --- IMAGE LOADING FUNCTIONS (Applying preprocessing and NDVI) ---

/**
 * Loads, filters, masks, and calculates NDVI for Landsat 5.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} Processed Landsat 5 collection with 'NDVI' band.
 */
function loadLandsat5(geometry) {
  return ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
    .filterDate('1984-01-01', '2011-12-31')
    .filterBounds(geometry)
    .map(maskL457Clouds)
    .map(calculateL5L7Ndvi); // Calculate NDVI
}

/**
 * Loads, filters, masks, and calculates NDVI for Landsat 7.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} Processed Landsat 7 collection with 'NDVI' band.
 */
function loadLandsat7(geometry) {
  return ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
    .filterDate('1999-01-01', '2020-12-31')
    .filterBounds(geometry)
    .map(maskL457Clouds)
    .map(calculateL5L7Ndvi); // Calculate NDVI
}

/**
 * Loads, filters, masks, and calculates NDVI for Landsat 8.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} Processed Landsat 8 collection with 'NDVI' band.
 */
function loadLandsat8(geometry) {
  return ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
    .filterDate('2013-01-01', '2020-12-31')
    .filterBounds(geometry)
    .map(maskL8Clouds)
    .map(calculateL8Ndvi); // Calculate NDVI
}

/**
 * Loads, filters, and selects NDVI for MODIS. Renames band to 'NDVI'.
 * @param {ee.Geometry} geometry The area of interest.
 * @return {ee.ImageCollection} Processed MODIS collection with 'NDVI' band.
 */
function loadModisNdvi(geometry) {
  return ee.ImageCollection('MODIS/006/MOD13Q1')
    .filterDate('2000-01-01', '2020-12-31')
    .filterBounds(geometry)
    .map(maskModisQuality)
    .select('NDVI'); // MODIS NDVI is already calculated, just select and ensure name
}


// --- ANNUAL MEDIAN COMPOSITING FUNCTION ---

/**
 * Creates an annual median NDVI composite collection.
 * @param {ee.ImageCollection} collection Input image collection with an 'NDVI' band.
 * @param {number} startYear The start year for compositing.
 * @param {number} endYear The end year for compositing.
 * @param {ee.Geometry} aoi The area of interest to clip composites.
 * @return {ee.ImageCollection} An image collection of annual median NDVI composites.
 */
function createAnnualMedianComposite(collection, startYear, endYear, aoi) {
  var annualComposites = ee.List([]);
  for (var year = startYear; year <= endYear; year++) {
    var startDate = ee.Date.fromYMD(year, 1, 1);
    var endDate = ee.Date.fromYMD(year, 12, 31);

    var yearlyCollection = collection
      .filterDate(startDate, endDate)
      .select('NDVI'); // Ensure we are only compositing NDVI

    // Check if the collection for the year is empty before proceeding
    var count = yearlyCollection.size();

    // Create a conditional median. If count is 0, create a dummy image (e.g. masked).
    // This avoids errors with .median() on an empty collection.
    var medianImage = ee.Algorithms.If(
      count.gt(0),
      yearlyCollection.median().clip(aoi).set('year', year),
      // Create a constant masked image if no images for that year
      ee.Image().rename('NDVI').mask(ee.Image(0)).set('year', year)
    );
    annualComposites = annualComposites.add(medianImage);
  }
  return ee.ImageCollection.fromImages(annualComposites);
}

// --- GENERATE ANNUAL COMPOSITES ---

// Load base collections
var landsat5Col = loadLandsat5(aoi);
var landsat7Col = loadLandsat7(aoi);
var landsat8Col = loadLandsat8(aoi);
var modisNdviCol = loadModisNdvi(aoi);

print('Raw L5 size (post-NDVI):', landsat5Col.size());
print('Raw L7 size (post-NDVI):', landsat7Col.size());
print('Raw L8 size (post-NDVI):', landsat8Col.size());
print('Raw MODIS size (post-filter/select):', modisNdviCol.size());


// Create Annual Median Composites
var annualL5Composites = createAnnualMedianComposite(landsat5Col, 1984, 2011, aoi);
var annualL7Composites = createAnnualMedianComposite(landsat7Col, 1999, 2020, aoi);
var annualL8Composites = createAnnualMedianComposite(landsat8Col, 2013, 2020, aoi);
var annualModisComposites = createAnnualMedianComposite(modisNdviCol, 2000, 2020, aoi);

// --- VERIFICATION ---
print('Landsat 5 Annual NDVI Composites Size:', annualL5Composites.size());
print('Landsat 7 Annual NDVI Composites Size:', annualL7Composites.size());
print('Landsat 8 Annual NDVI Composites Size:', annualL8Composites.size());
print('MODIS Annual NDVI Composites Size:', annualModisComposites.size());

// Optional: Add an NDVI composite for a specific year to the map
var ndviVisParams = {min: -0.2, max: 1, palette: ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901', '66A000', '529400', '3E8601', '207401', '056201', '004C00', '023B01', '012E01', '011D01', '011301']};

var l5Composite1990 = annualL5Composites.filter(ee.Filter.eq('year', 1990)).first();
// Check if the image exists before adding to map
if (l5Composite1990.bandNames().size().gt(0)) { // Check if the image has bands
    Map.addLayer(l5Composite1990.select('NDVI'), ndviVisParams, 'L5 NDVI Composite 1990');
} else {
    print('L5 NDVI Composite for 1990 not found or is empty.');
}


var modisComposite2010 = annualModisComposites.filter(ee.Filter.eq('year', 2010)).first();
if (modisComposite2010.bandNames().size().gt(0)) {
    Map.addLayer(modisComposite2010.select('NDVI'), ndviVisParams, 'MODIS NDVI Composite 2010');
} else {
    print('MODIS NDVI Composite for 2010 not found or is empty.');
}

// Center map on AOI
Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: '0000FF'}, 'Area of Interest (Vegetation Analysis)');
