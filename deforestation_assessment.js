// --- Boilerplate: AOI, Preprocessing, NDVI, Compositing (from previous steps) ---

// 1. Define the Area of Interest (AOI)
var aoi = ee.Geometry.Rectangle([35.0, -0.5, 36.0, 0.5]); // Approximate bounds for Mau Forest
var LANDSAT_SCALE = 30; // Nominal scale for Landsat in meters

// (Assuming all boilerplate functions: maskL457Clouds, maskL8Clouds, calculateL5L7Ndvi, calculateL8Ndvi, loadLandsat5, loadLandsat7, loadLandsat8, createAnnualMedianComposite are present)
// ...
function maskL457Clouds(image) {
  var qa = image.select('pixel_qa');
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

function maskL8Clouds(image) {
  var qa = image.select('pixel_qa');
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

function calculateL5L7Ndvi(image) {
  var ndvi = image.normalizedDifference(['B4', 'B3']).rename('NDVI');
  return image.addBands(ndvi);
}

function calculateL8Ndvi(image) {
  var ndvi = image.normalizedDifference(['B5', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

function loadLandsat5(geometry) {
  return ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
    .filterDate('1984-01-01', '2011-12-31')
    .filterBounds(geometry)
    .map(maskL457Clouds)
    .map(calculateL5L7Ndvi);
}

function loadLandsat7(geometry) {
  return ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
    .filterDate('1999-01-01', '2020-12-31')
    .filterBounds(geometry)
    .map(maskL457Clouds)
    .map(calculateL5L7Ndvi);
}

function loadLandsat8(geometry) {
  return ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
    .filterDate('2013-01-01', '2020-12-31')
    .filterBounds(geometry)
    .map(maskL8Clouds)
    .map(calculateL8Ndvi);
}

function createAnnualMedianComposite(collection, startYear, endYear, aoi) {
  var annualCompositesList = ee.List([]);
  for (var year = startYear; year <= endYear; year++) {
    var startDate = ee.Date.fromYMD(year, 1, 1);
    var endDate = ee.Date.fromYMD(year, 12, 31);
    var yearlyCollection = collection.filterDate(startDate, endDate).select('NDVI');
    var count = yearlyCollection.size();
    var medianImage = ee.Algorithms.If(
      count.gt(0),
      yearlyCollection.median().clip(aoi).set('year', year).rename('NDVI'),
      ee.Image().rename('NDVI').mask(ee.Image(0)).set('year', year)
    );
    annualCompositesList = annualCompositesList.add(medianImage);
  }
  return ee.ImageCollection.fromImages(annualCompositesList);
}
// --- End Boilerplate ---

// --- Generate Annual Composites ---
var annualL5Composites = createAnnualMedianComposite(loadLandsat5(aoi), 1984, 2011, aoi);
var annualL7Composites = createAnnualMedianComposite(loadLandsat7(aoi), 1999, 2020, aoi);
var annualL8Composites = createAnnualMedianComposite(loadLandsat8(aoi), 2013, 2020, aoi);

// --- Initial Forest Mask ---
var baselineStartYear = 1984;
var baselineEndYear = 1990; // Baseline period ends
var baselineAnnualNdvi = annualL5Composites
  .filter(ee.Filter.gte('year', baselineStartYear))
  .filter(ee.Filter.lte('year', baselineEndYear))
  .select('NDVI');
var baselineNdviComposite = ee.Image(ee.Algorithms.If(
    baselineAnnualNdvi.size().gt(0),
    baselineAnnualNdvi.median().rename('NDVI_baseline'),
    ee.Image().rename('NDVI_baseline').mask(ee.Image(0))
));
var forestNdviThreshold = 0.5;
var initialForestMask = baselineNdviComposite // This is a key image for export
  .select('NDVI_baseline')
  .gt(forestNdviThreshold)
  .selfMask()
  .rename('initial_forest');
print('Initial Forest Mask calculated for baseline ' + baselineStartYear + '-' + baselineEndYear);

// --- Yearly Deforestation (Initial Pass) & Refinement ---
var allAnnualNdviComposites = annualL5Composites.merge(annualL7Composites).merge(annualL8Composites).sort('year');
var distinctYears = ee.List(allAnnualNdviComposites.aggregate_array('year')).distinct().sort();
var uniqueAnnualNdviComposites = ee.ImageCollection.fromImages(
  distinctYears.map(function(year) {
    var yearComposites = allAnnualNdviComposites.filter(ee.Filter.eq('year', year));
    return yearComposites.select('NDVI').median().set('year', year).rename('NDVI');
  })
);
var deforestationNdviThreshold = 0.3;
function detectDeforestation(currentNdviImage, initialForest, deforestThresh) {
  var year = currentNdviImage.get('year');
  var potentialDeforestation = currentNdviImage.select('NDVI').lt(deforestThresh);
  var deforestation = initialForest.eq(1).and(potentialDeforestation).rename('deforestation');
  return deforestation.selfMask().set('year', year);
}
var analysisComposites = uniqueAnnualNdviComposites.filter(ee.Filter.gt('year', baselineEndYear));
var yearlyDeforestation = analysisComposites.map(function(image) {
  return detectDeforestation(image, initialForestMask, deforestationNdviThreshold);
});

var persistenceDuration = 2;
var deforestationList = yearlyDeforestation.toList(yearlyDeforestation.size());
var refinedDeforestationList = ee.List([]);
var numDeforestationYears = deforestationList.size().getInfo();

for (var i = 0; i < numDeforestationYears - (persistenceDuration - 1) ; i++) {
  var img_Y = ee.Image(deforestationList.get(i));
  var img_Y_plus_1 = ee.Image(deforestationList.get(i + 1));
  img_Y = img_Y.unmask(0);
  img_Y_plus_1 = img_Y_plus_1.unmask(0);
  var year_Y = ee.Number(img_Y.get('year'));
  var year_Y_plus_1 = ee.Number(img_Y_plus_1.get('year'));
  var persistentDeforestation = ee.Algorithms.If(
    year_Y_plus_1.subtract(year_Y).eq(1),
    img_Y.select('deforestation').and(img_Y_plus_1.select('deforestation')).rename('persistent_deforestation'),
    ee.Image(0).rename('persistent_deforestation')
  );
  persistentDeforestation = ee.Image(persistentDeforestation).selfMask().set('year', year_Y);
  refinedDeforestationList = refinedDeforestationList.add(persistentDeforestation);
}
var refinedDeforestation = ee.ImageCollection.fromImages(refinedDeforestationList); // Each image is binary mask for deforestation starting in 'year'
print('Refined Deforestation (2-year persistence) Collection Size:', refinedDeforestation.size());

// --- Quantify Deforested Areas ---
function calculateDeforestedArea(image, geometry, scale) {
  var areaImage = image.multiply(ee.Image.pixelArea());
  var areaStats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(), geometry: geometry, scale: scale, maxPixels: 1e10
  });
  var deforestedAreaSqMeters = ee.Number(areaStats.get(image.bandNames().get(0)));
  var deforestedAreaSqKm = deforestedAreaSqMeters.divide(1e6);
  return image.set('deforested_area_sqkm', deforestedAreaSqKm);
}
var refinedDeforestationWithArea = refinedDeforestation.map(function(image) {
  var bandCount = image.bandNames().size();
  var area = ee.Algorithms.If(
    bandCount.gt(0),
    calculateDeforestedArea(image, aoi, LANDSAT_SCALE).get('deforested_area_sqkm'),
    0
  );
  return image.set('deforested_area_sqkm', area);
});
var annualAreasList = refinedDeforestationWithArea.aggregate_array('deforested_area_sqkm');
var yearsList = refinedDeforestationWithArea.aggregate_array('year');
// (Printing of annual and total areas assumed to be here as per previous step)
// ...

// --- ENHANCED VISUALIZATION & PREPARE FOR OUTPUT ---

// 1. Create "Year of Deforestation" Image
// This image will show *when* persistent deforestation first occurred.
var yearOfDeforestation = refinedDeforestationWithArea.map(function(image) {
  // Deforested pixels (value 1) get the year value, others remain 0 or masked.
  // Ensure image is unmasked so that non-deforested areas are 0, not masked, before multiplication.
  var year = ee.Number(image.get('year'));
  return image.unmask(0).multiply(year).rename('year_of_deforestation');
}).mosaic(); // Mosaic will take the value from the first image where pixel is not masked (i.e., first year of deforestation)
              // .min() could also be used if there's any concern of overlap; .max() if we want last year.
              // Since refinedDeforestation should be one event per pixel, mosaic is fine.

// Mask out pixels that were never deforested (where yearOfDeforestation is 0)
yearOfDeforestation = yearOfDeforestation.selfMask(); // This is a key image for export

// 2. Visualize "Year of Deforestation"
// Determine min and max years for visualization from the actual data
var minYear = ee.Number(yearsList.reduce(ee.Reducer.min())).getInfo(); // Get min year from evaluated list
var maxYear = ee.Number(yearsList.reduce(ee.Reducer.max())).getInfo();

if (minYear && maxYear) { // Ensure minYear and maxYear were successfully retrieved
  var yearVisParams = {
    min: minYear,
    max: maxYear,
    palette: ['#FFFF00', '#FFA500', '#FF0000', '#800000'] // Yellow -> Orange -> Red -> Dark Red
  };
  Map.addLayer(yearOfDeforestation, yearVisParams, 'Year of First Persistent Deforestation');
} else {
  print('Could not determine min/max years for Year of Deforestation visualization. Years list:', yearsList.getInfo());
  // Add layer without specific min/max if retrieval failed, GEE will auto-stretch
  Map.addLayer(yearOfDeforestation, {palette: ['#FFFF00', '#FFA500', '#FF0000', '#800000']}, 'Year of First Persistent Deforestation (auto-stretch)');
}


// 3. Layering for Context & Map Setup
Map.addLayer(initialForestMask, {palette: ['00AA00'], opacity: 0.5}, 'Initial Forest Mask (Baseline ' + baselineEndYear + ')', false); // Initially off

// (Optional: Add a specific year's refined deforestation for comparison)
var yearToVerify = 2004;
var refinedDeforestationForYear = refinedDeforestationWithArea.filter(ee.Filter.eq('year', yearToVerify)).first();
if (refinedDeforestationForYear) {
    var areaThisYear = ee.Number(refinedDeforestationForYear.get('deforested_area_sqkm')).getInfo();
    Map.addLayer(refinedDeforestationForYear.selfMask(),
                 {palette: ['990099']},
                 'Refined Deforestation ' + yearToVerify + ' (' + areaThisYear.toFixed(2) + ' sqKm)',
                 false); // Initially off
}

Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: '0000FF', fillOpacity: 0}, 'Area of Interest', false); // Initially off


// --- Print Annual and Total Areas (from previous step, ensure it's active) ---
print('--- Annual Refined Deforestation ---');
yearsList.evaluate(function(yearsEval, errorYears) {
  if (errorYears) { print('Error evaluating years: ' + errorYears); return; }
  annualAreasList.evaluate(function(areasEval, errorAreas) {
    if (errorAreas) { print('Error evaluating areas: ' + errorAreas); return; }
    if (yearsEval && areasEval && yearsEval.length === areasEval.length) {
      for (var i = 0; i < yearsEval.length; i++) {
        print('Year ' + yearsEval[i] + ': ' + areasEval[i].toFixed(2) + ' sq km');
      }
      var totalRefinedDeforestationArea = areasEval.reduce(function(sum, value) { return sum + value; }, 0);
      print('--- Total Refined Deforestation Area (over analyzed period) ---');
      print(totalRefinedDeforestationArea.toFixed(2) + ' sq km');
    } else {
      print('Years and areas lists do not match or are empty for printing.');
    }
  });
});

print("--- Key Image Variables for Potential Export ---");
print("Initial Forest Mask (Binary): initialForestMask");
print("Year of First Persistent Deforestation (Year values): yearOfDeforestation");
