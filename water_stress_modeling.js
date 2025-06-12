// --- BEGIN SCRIPT HEADER ---
// *************************************************************************************************
// GOOGLE EARTH ENGINE SCRIPT FOR WATER STRESS MODELING
// *************************************************************************************************
//
// PURPOSE:
// This script models water stress using a hybrid machine learning approach in Google Earth Engine.
// It utilizes various remote sensing datasets (Landsat 8, MODIS LST, MODIS ET, CHIRPS Precipitation)
// to derive environmental indicators, which are then used as features for machine learning models.
//
// WORKFLOW:
// 1. Data Ingestion & Preprocessing: Loads and prepares satellite and meteorological data.
// 2. Annual Composites: Creates annual median/sum composites of key indicators.
// 3. Feature Engineering: Combines annual indicators into multi-band images for analysis.
// 4. Machine Learning Model Training:
//    - Trains Random Forest (RF), Support Vector Machine (SVM), and CART (as an ANN proxy) models.
//    - !!! CRITICAL: USES DUMMY TRAINING DATA by default. This MUST be replaced by the user
//      with actual, representative training points/polygons for meaningful results.
// 5. Hybrid Model Development: Implements a majority voting scheme using the three trained models.
// 6. Water Stress Mapping & Analysis: Generates annual water stress maps and provides guidance
//    for further analysis (area calculation, temporal trends, export).
//
// USAGE:
// - Define your Area of Interest (AOI).
// - Specify the date range for analysis.
// - !!! MOST IMPORTANTLY: Replace the DUMMY 'trainingGeometries' FeatureCollection with your own
//   labeled data representing different water stress levels for specific years.
// - Adjust machine learning model parameters as needed.
// - Run the script in the Google Earth Engine Code Editor.
//
// DISCLAIMER:
// The accuracy of the model heavily depends on the quality and representativeness of the
// training data provided by the user. The dummy data included is for script execution demonstration ONLY.
//
// --- END SCRIPT HEADER ---



// Define the Area of Interest (AOI)
// Using the existing AOI from mau_forest_aoi.js as a placeholder
// --- Data Ingestion & Preprocessing ---
var aoi = ee.Geometry.Rectangle([35.0, -0.5, 36.0, 0.5]); // Approximate bounds for Mau Forest
Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: '0000FF', fillOpacity: 0}, 'Area of Interest');

// Define time range
var startDate = '2015-01-01';
var endDate = '2020-12-31';

// --- Helper Functions ---

// Cloud masking for Landsat 8
function maskL8sr(image) {
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 5;
  var qa = image.select('pixel_qa');
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask).divide(10000) // Scale factor for SR
      .select("B[0-9]*") // Select all bands
      .copyProperties(image, ["system:time_start"]);
}

// Calculate NDVI for Landsat 8
function addNDVI_L8(image) {
  var ndvi = image.normalizedDifference(['B5', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

// Calculate MNDWI for Landsat 8
// Using Green (B3) and SWIR1 (B6)
function addMNDWI_L8(image) {
  var mndwi = image.normalizedDifference(['B3', 'B6']).rename('MNDWI');
  return image.addBands(mndwi);
}

// MODIS LST processing - Scale factor, select LST_Day_1km
function processModisLST(image) {
  return image.select('LST_Day_1km')
              .multiply(0.02) // Scale factor for LST
              .subtract(273.15) // Convert Kelvin to Celsius
              .rename('LST')
              .copyProperties(image, ["system:time_start"]);
}

// MODIS ET processing - Select ET, apply scale factor
function processModisET(image) {
  return image.select('ET')
              .multiply(0.1) // Scale factor for ET (kg/m^2/8day)
              .rename('ET')
              .copyProperties(image, ["system:time_start"]);
}

// CHIRPS Precipitation - Rename band
function processChirps(image) {
  return image.select('precipitation').rename('P')
              .copyProperties(image, ["system:time_start"]);
}


// --- Data Loading and Initial Processing Functions ---

// Load Landsat 8, apply cloud mask, NDVI, and MNDWI
function loadLandsat8Data(aoi, startDate, endDate) {
  return ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
      .filterBounds(aoi)
      .filterDate(startDate, endDate)
      .map(maskL8sr)
      .map(addNDVI_L8)
      .map(addMNDWI_L8);
}

// Load MODIS LST
function loadModisLSTData(aoi, startDate, endDate) {
  return ee.ImageCollection('MODIS/006/MOD11A1') // Daily 1km LST
      .filterBounds(aoi)
      .filterDate(startDate, endDate)
      .map(processModisLST);
}

// Load MODIS ET
function loadModisETData(aoi, startDate, endDate) {
  return ee.ImageCollection('MODIS/006/MOD16A2') // 8-Day 500m ET
      .filterBounds(aoi)
      .filterDate(startDate, endDate)
      .map(processModisET);
}

// Load CHIRPS Precipitation
function loadChirpsData(aoi, startDate, endDate) {
  return ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
      .filterBounds(aoi)
      .filterDate(startDate, endDate)
      .map(processChirps);
}

// --- Annual Compositing Function ---
function createAnnualMedianComposite(collection, year, bandName, aoi) {
  var yearlyCollection = collection.filter(ee.Filter.calendarRange(year, year, 'year'));
  var medianImage = yearlyCollection.select(bandName).median();
  // Ensure rename is part of the function as per later script versions
  return medianImage.set('year', year).clip(aoi).rename(bandName);
}

function createAnnualSumComposite(collection, year, bandName, aoi) {
  var yearlyCollection = collection.filter(ee.Filter.calendarRange(year, year, 'year'));
  var sumImage = yearlyCollection.select(bandName).sum();
  // Ensure rename is part of the function
  return sumImage.set('year', year).clip(aoi).rename(bandName);
}

// --- Execute Data Loading ---
var landsat8Data = loadLandsat8Data(aoi, startDate, endDate);
var modisLSTData = loadModisLSTData(aoi, startDate, endDate);
var modisETData = loadModisETData(aoi, startDate, endDate);
var chirpsData = loadChirpsData(aoi, startDate, endDate);

print('Landsat 8 data size:', landsat8Data.size());
print('MODIS LST data size:', modisLSTData.size());
print('MODIS ET data size:', modisETData.size());
print('CHIRPS data size:', chirpsData.size());

// --- Generate Annual Composites for each indicator ---
var years = ee.List.sequence(ee.Number.parse(startDate.slice(0,4)), ee.Number.parse(endDate.slice(0,4)));

// --- Generate Annual Composites for each indicator ---
var annualNdvi = ee.ImageCollection.fromImages(
  years.map(function(y) {
    return createAnnualMedianComposite(landsat8Data, y, 'NDVI', aoi);
  })
);
print('Annual NDVI composites:', annualNdvi);

var annualMndwi = ee.ImageCollection.fromImages(
  years.map(function(y) {
    return createAnnualMedianComposite(landsat8Data, y, 'MNDWI', aoi);
  })
);
print('Annual MNDWI composites:', annualMndwi);

var annualLst = ee.ImageCollection.fromImages(
  years.map(function(y) {
    return createAnnualMedianComposite(modisLSTData, y, 'LST', aoi);
  })
);
print('Annual LST composites:', annualLst);

var annualP = ee.ImageCollection.fromImages(
  years.map(function(y) {
    return createAnnualSumComposite(chirpsData, y, 'P', aoi);
  })
);
print('Annual Precipitation (sum) composites:', annualP);

var annualEt = ee.ImageCollection.fromImages(
  years.map(function(y) {
    return createAnnualMedianComposite(modisETData, y, 'ET', aoi);
  })
);
print('Annual ET (median of 8-day values) composites:', annualEt);


// --- Display a sample layer ---
// Check if collections have images before trying to get the first one
// --- Display a sample layer ---
if (annualNdvi.size().getInfo() > 0) {
  Map.addLayer(annualNdvi.first(), {min:0, max:1, palette: ['blue', 'white', 'green']}, 'First Year NDVI');
}
if (annualLst.size().getInfo() > 0) {
  Map.addLayer(annualLst.first(), {min:10, max:40, palette: ['blue', 'yellow', 'red']}, 'First Year LST');
}
if (annualP.size().getInfo() > 0) {
  Map.addLayer(annualP.first(), {min:0, max:2000, palette: ['red', 'yellow', 'blue']}, 'First Year Precipitation Sum');
}

console.log("Data collection and preprocessing subtask initiated.");

// --- Feature Engineering ---

// 1. Combine Annual Composites into Multi-Band Images per Year
var bandNames = ['NDVI', 'MNDWI', 'LST', 'P', 'ET'];

// --- Feature Engineering ---
var annualFeatureImages = ee.ImageCollection.fromImages(
  years.map(function(year_obj) {
    var year = ee.Number(year_obj);

    var ndvi_for_year = annualNdvi.filter(ee.Filter.eq('year', year)).first();
    var mndwi_for_year = annualMndwi.filter(ee.Filter.eq('year', year)).first();
    var lst_for_year = annualLst.filter(ee.Filter.eq('year', year)).first();
    var p_for_year = annualP.filter(ee.Filter.eq('year', year)).first();
    var et_for_year = annualEt.filter(ee.Filter.eq('year', year)).first();

    var combinedImage = ee.Image.cat([
      ndvi_for_year,
      mndwi_for_year,
      lst_for_year,
      p_for_year,
      et_for_year
    ]); // Bands are already named from composite creation

    return combinedImage.set('year', year).set('system:time_start', ee.Date.fromYMD(year, 1, 1).millis());
  })
);

print('Annual Multi-band Feature Images:', annualFeatureImages);

// Display the first year's combined image to verify
var firstYearFeatureImage = annualFeatureImages.first();
if (firstYearFeatureImage && firstYearFeatureImage.bandNames().length().getInfo() > 0) { // Check bandNames length
  Map.addLayer(firstYearFeatureImage.select('NDVI'), {min:0, max:1, palette: ['blue', 'white', 'green']}, 'Combined NDVI (First Year)');
  Map.addLayer(firstYearFeatureImage.select('LST'), {min:10, max:40, palette: ['blue', 'yellow', 'red']}, 'Combined LST (First Year)');
  Map.addLayer(firstYearFeatureImage.select('P'), {min:0, max:2000, palette: ['red', 'yellow', 'blue']}, 'Combined P (First Year)');
}

console.log("The 'annualFeatureImages' ImageCollection is ready for sampling.");
console.log("Each image in this collection has bands: " + bandNames.join(', '));
console.log("Feature engineering subtask: Combined annual composites into multi-band images.");

// --- Machine Learning Model Implementation ---

var classProperty = 'stress_level'; // Property storing the label
var classes = { 'No Stress': 0, 'Mild Stress': 1, 'Severe Stress': 2 }; // Simplified classes
var stressPalette = ['00FF00', 'FFFF00', 'FF0000']; // Green, Yellow, Red for visualization

// 1. Training Data Preparation (DUMMY DATA FOR DEMONSTRATION)
// *******************************************************************************************
// !!! CRITICAL USER ACTION REQUIRED !!!
// THE FOLLOWING 'trainingGeometries' VARIABLE CONTAINS DUMMY DATA FOR DEMONSTRATION ONLY.
// YOU MUST REPLACE THIS WITH YOUR OWN ACCURATE AND REPRESENTATIVE TRAINING DATA (POINTS OR POLYGONS)
// LABELED WITH WATER STRESS CLASSES FOR SPECIFIC YEARS.
// FAILURE TO DO SO WILL RESULT IN MEANINGLESS WATER STRESS MAPS.
//
// Instructions for creating training data:
// 1. Define your water stress classes (e.g., 0: No Stress, 1: Mild, 2: Moderate, 3: Severe).
//    Update the 'classes' variable accordingly if you change them.
// 2. For various locations within your AOI and for different years, identify areas with known
//    water stress conditions (e.g., based on field data, historical drought reports, very high-resolution imagery).
// 3. In GEE, use the geometry drawing tools to create points or polygons over these areas.
// 4. For each geometry, set the following properties:
//    - 'stress_level': The numeric class label (e.g., 0, 1, 2, 3). This MUST match 'classProperty'.
//    - 'year': The year for which this label is valid (e.g., 2015, 2016).
//    - 'type': A string, either 'train' or 'eval', to assign the geometry to the training or validation set.
//      (e.g., typically 70-80% 'train', 20-30% 'eval').
// 5. Combine all your geometries into a single ee.FeatureCollection assigned to 'trainingGeometries'.
//    Example:
//    var myTrainingPoints = ee.FeatureCollection([
//      ee.Feature(ee.Geometry.Point(lon, lat), {stress_level: 0, year: 2015, type: 'train'}),
//      ee.Feature(ee.Geometry.Point(lon, lat), {stress_level: 2, year: 2015, type: 'eval'}),
//      // ... many more features
//    ]);
//    var trainingGeometries = myTrainingPoints; // Replace the dummy data with this line.
// *******************************************************************************************

var trainingGeometries = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point(35.2, -0.2), {stress_level: classes['No Stress'], year: 2015, type: 'train'}),
  ee.Feature(ee.Geometry.Point(35.3, -0.3), {stress_level: classes['Severe Stress'], year: 2015, type: 'train'}),
  ee.Feature(ee.Geometry.Point(35.4, -0.1), {stress_level: classes['Mild Stress'], year: 2015, type: 'eval'}),
  ee.Feature(ee.Geometry.Point(35.25, -0.25), {stress_level: classes['No Stress'], year: 2016, type: 'train'}),
  ee.Feature(ee.Geometry.Point(35.35, -0.35), {stress_level: classes['Severe Stress'], year: 2016, type: 'eval'}),
  ee.Feature(ee.Geometry.Point(35.45, -0.15), {stress_level: classes['Mild Stress'], year: 2016, type: 'train'}),
  ee.Feature(ee.Geometry.Point(35.2, -0.25), {stress_level: classes['No Stress'], year: 2017, type: 'eval'}),
  ee.Feature(ee.Geometry.Point(35.3, -0.35), {stress_level: classes['Severe Stress'], year: 2017, type: 'train'}),
  ee.Feature(ee.Geometry.Point(35.4, -0.15), {stress_level: classes['Mild Stress'], year: 2017, type: 'train'})
]);
print('WARNING: Using DUMMY training data.', trainingGeometries);

// 2. Sample Training Data
var trainingData = annualFeatureImages.map(function(image) {
  var year = image.get('year');
  var pointsForYear = trainingGeometries.filter(ee.Filter.eq('year', year));
  return image.select(bandNames).sampleRegions({
    collection: pointsForYear,
    properties: [classProperty, 'year', 'type'],
    scale: 30
  });
}).flatten();

trainingData = trainingData.filter(ee.Filter.neq(bandNames[0], null)); // Filter out nulls
print('Filtered Sampled Training Data size:', trainingData.size());

// 3. Split data into Training and Evaluation sets
var trainingSet = trainingData.filter(ee.Filter.eq('type', 'train'));
var validationSet = trainingData.filter(ee.Filter.eq('type', 'eval'));
print('Training Set Size:', trainingSet.size());
print('Validation Set Size:', validationSet.size());

// Declare models in a broader scope
var rfModel, svmModel, cartModel;

// Check if training/validation sets are empty
if (trainingSet.size().getInfo() > 0 && validationSet.size().getInfo() > 0) {
  // 4. Machine Learning Model Training and Evaluation
  print("\n--- Random Forest ---");
  rfModel = ee.Classifier.smileRandomForest({numberOfTrees: 50, seed: 0})
    .train({features: trainingSet, classProperty: classProperty, inputProperties: bandNames});
  var rfValidation = validationSet.classify(rfModel);
  var rfErrorMatrix = rfValidation.errorMatrix(classProperty, 'classification');
  print('RF Validation Error Matrix:', rfErrorMatrix);
  print('RF Validation Overall Accuracy:', rfErrorMatrix.accuracy());
  print('RF Validation Kappa:', rfErrorMatrix.kappa());

  print("\n--- Support Vector Machine (SVM) ---");
  svmModel = ee.Classifier.libsvm({svmType: 'C_SVC', kernelType: 'RBF', gamma: 0.5, cost: 10})
    .train({features: trainingSet, classProperty: classProperty, inputProperties: bandNames});
  var svmValidation = validationSet.classify(svmModel);
  var svmErrorMatrix = svmValidation.errorMatrix(classProperty, 'classification');
  print('SVM Validation Error Matrix:', svmErrorMatrix);
  print('SVM Validation Overall Accuracy:', svmErrorMatrix.accuracy());
  print('SVM Validation Kappa:', svmErrorMatrix.kappa());

  print("\n--- CART (as ANN proxy) ---");
  cartModel = ee.Classifier.smileCart()
    .train({features: trainingSet, classProperty: classProperty, inputProperties: bandNames});
  var cartValidation = validationSet.classify(cartModel);
  var cartErrorMatrix = cartValidation.errorMatrix(classProperty, 'classification');
  print('CART Validation Error Matrix:', cartErrorMatrix);
  print('CART Validation Overall Accuracy:', cartErrorMatrix.accuracy());

  print("\nModels trained (RF, SVM, CART).");
} else {
  print("ERROR: Training or validation set is empty. Models not trained. Assigning dummy classifiers for script completion.");
  // Assign dummy classifiers if training failed.
  // Training on an empty collection is not ideal, so train on a minimal dummy feature.
  var dummyFeature = ee.Feature(null, {'NDVI':0, 'MNDWI':0, 'LST':0, 'P':0, 'ET':0, 'stress_level':0});
  var dummyTraining = ee.FeatureCollection([dummyFeature]);
  rfModel = ee.Classifier.smileRandomForest(1).train(dummyTraining, classProperty, bandNames);
  svmModel = ee.Classifier.libsvm().train(dummyTraining, classProperty, bandNames); // Basic SVM
  cartModel = ee.Classifier.smileCart().train(dummyTraining, classProperty, bandNames);
}
console.log("Machine Learning Model Implementation subtask completed.");

// --- Hybrid Model Development (Majority Voting) ---
var hybridAnnualClassification; // Declare in a scope accessible by the next section

// Function to apply all trained models and get a hybrid classification (mode)
function applyHybridModel(image, rfModel, svmModel, cartModel) {
  var rfClassification = image.classify(rfModel).rename('rf_class');
  var svmClassification = image.classify(svmModel).rename('svm_class');
  var cartClassification = image.classify(cartModel).rename('cart_class');

  var combinedClassifications = ee.Image.cat([
    rfClassification,
    svmClassification,
    cartClassification
  ]);
  var hybridClassification = combinedClassifications.reduce(ee.Reducer.mode()).rename('hybrid_class');
  return hybridClassification;
}

var modelsAreLikelyValid = true;
try {
    rfModel.setOutputMode('CLASSIFICATION');
    svmModel.setOutputMode('CLASSIFICATION');
    cartModel.setOutputMode('CLASSIFICATION');
} catch (e) {
    modelsAreLikelyValid = false;
    print("Error during model validity check for hybrid model: " + e.message + ". Hybrid model may not be generated correctly.");
}

if (modelsAreLikelyValid) {
    hybridAnnualClassification = annualFeatureImages.map(function(image) {
      var year = image.get('year');
      var imageToClassify = image.select(bandNames);
      var hybridResult = applyHybridModel(imageToClassify, rfModel, svmModel, cartModel);
      return hybridResult.set('year', year).set('system:time_start', image.get('system:time_start'));
    });
    print('Hybrid Annual Classification (Majority Vote) Collection:', hybridAnnualClassification);

    var firstYearNumber = ee.Number(years.get(0)); // Used for filtering
    var firstYearHybridMap = hybridAnnualClassification.filter(ee.Filter.eq('year', firstYearNumber)).first();

    if (firstYearHybridMap) {
      Map.addLayer(firstYearHybridMap.select('hybrid_class'),
                   {min: 0, max: (Object.keys(classes).length - 1), palette: stressPalette},
                   'Hybrid Water Stress Map ' + firstYearNumber.getInfo()); // Display first year
    } else {
      print("Could not retrieve the first year's hybrid classification for display. Collection might be empty or year filter failed for year: " + firstYearNumber.getInfo());
    }
} else {
    print("Skipping hybrid model application and subsequent analysis due to invalid base models.");
    // Create an empty collection for hybridAnnualClassification so downstream code doesn't break, if necessary
    hybridAnnualClassification = ee.ImageCollection([]);
}
console.log("Hybrid Model Development subtask completed.");

// --- Water Stress Mapping and Analysis ---

print('\n--- Water Stress Mapping and Analysis ---');

// Ensure hybridAnnualClassification is available and has content
if (!hybridAnnualClassification || hybridAnnualClassification.size().getInfo() === 0) {
  print("WARNING: 'hybridAnnualClassification' is empty or not defined. Skipping further analysis.");
} else {
  print('Analyzing Hybrid Annual Water Stress Classification Collection:', hybridAnnualClassification);

  // 1. Visualization of the first year (already done in hybrid step, but can be confirmed)
  var firstYearToDisplay = ee.Number(years.get(0)); // Should be same as firstYearNumber
  var firstYearMapForAnalysis = hybridAnnualClassification
                                .filter(ee.Filter.eq('year', firstYearToDisplay))
                                .first();

  if (firstYearMapForAnalysis) {
     // Already added to map, this confirms it's available for analysis
     print('First year map (' + firstYearToDisplay.getInfo() + ') is available for analysis.');
  } else {
    print('First year map for analysis (' + firstYearToDisplay.getInfo() + ') could not be retrieved.');
  }

  // Instructions for visualizing other years:
  print("\n--- How to Visualize Other Years ---");
  print("To visualize other years, filter 'hybridAnnualClassification' by year and add to map.");
  print("Example for 2016 (if in range):");
  print("var yearToShow = 2016;");
  print("var mapForYear = hybridAnnualClassification.filter(ee.Filter.eq('year', yearToShow)).first();");
  print("if (mapForYear) { Map.addLayer(mapForYear.select('hybrid_class'), {min: 0, max: 2, palette: stressPalette}, 'Hybrid Water Stress ' + yearToShow); }");

  // Loop to print info about each year's map
  hybridAnnualClassification.aggregate_histogram('year').evaluate(function(yearHistogram) {
    if (yearHistogram && Object.keys(yearHistogram).length > 0) {
      print("Available years in hybrid classification: ", Object.keys(yearHistogram));
      Object.keys(yearHistogram).forEach(function(yearStr) {
        var yearNum = parseInt(yearStr);
        var imageForYear = hybridAnnualClassification.filter(ee.Filter.eq('year', yearNum)).first();
        print('Hybrid map object for year ' + yearNum + ' (click to inspect):', imageForYear);
      });
    } else {
      print("No year histogram available for hybrid classification (collection might be empty).");
    }
  });

  print("\n--- Notes for Further Analysis (Code Snippets) ---");

  // a. Calculate Area of Each Water Stress Class Per Year
  print("\na. Area Calculation (Example for first available year):");
  if (firstYearMapForAnalysis) {
    var areaImage = ee.Image.pixelArea().addBands(firstYearMapForAnalysis.select('hybrid_class'));
    var areas = areaImage.reduceRegion({
      reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'stress_class' }),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9
    });
    print('Area (sq meters) by stress class for year ' + firstYearToDisplay.getInfo() + ':', areas);
  } else {
    print("Skipping area calculation example as first year map is not available.");
  }
  print("To calculate for other years, adapt the 'firstYearMapForAnalysis' variable.");

  // b. Create Charts of Water Stress Area Over Time
  print("\nb. Temporal Charts: Iterate years, calculate areas, then use ui.Chart functions.");

  // c. Identify Regions with Persistent or Worsening Water Stress
  print("\nc. Persistence/Trend Analysis: Use temporal aggregation (e.g., mode/mean) or trend analysis.");
  var meanStressOverTime = hybridAnnualClassification.select('hybrid_class').mean();
  Map.addLayer(meanStressOverTime, {min:0, max:2, palette:stressPalette}, 'Mean Stress Level Over Time');


  // d. Calculate Mean Stress Levels for Sub-regions (Zonal Statistics)
  print("\nd. Zonal Statistics: Use feature collection of sub-regions and reduceRegions().");
  print("// var subRegions = ee.FeatureCollection('YOUR_ASSET_PATH');");
  print("// var meanStressByRegion = firstYearMapForAnalysis.reduceRegions({/*...*/});");

  // e. Exporting Maps
  print("\ne. Exporting Maps: Use Export.image.toDrive() or Export.image.toAsset().");
  print("Example for the first year's map (if available):");
  if (firstYearMapForAnalysis) {
    print("Export.image.toDrive({ image: firstYearMapForAnalysis.select('hybrid_class'), description: 'hybrid_water_stress_map_' + firstYearToDisplay.getInfo(), /* ...other params... */ });");
  }
}

console.log("Water Stress Mapping and Analysis subtask: Provided visualization notes and outlined further analysis techniques.");
print("--- FULL SCRIPT FOR WATER STRESS ANALYSIS COMPLETED ---");
