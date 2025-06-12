# This is a Python script that will be executed by the subtask worker
# to refine and document the water_stress_modeling.js file.

import os

js_file_path = 'water_stress_modeling.js'

header_comment = """// --- BEGIN SCRIPT HEADER ---
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

"""

dummy_data_warning = """// *******************************************************************************************
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
"""

try:
    with open(js_file_path, 'r') as f:
        content = f.read()

    # Add header
    if not content.startswith('// --- BEGIN SCRIPT HEADER ---'):
        content = header_comment + '\n\n' + content

    # Enhance dummy data warning
    # Assuming dummy data section starts with a specific comment line
    dummy_data_marker = "// 1. Training Data Preparation (DUMMY DATA FOR DEMONSTRATION)"
    if dummy_data_marker in content:
        # Find the start of the DUMMY trainingGeometries variable assignment
        # To prevent adding multiple times, check if dummy_data_warning is already there
        if dummy_data_warning not in content:
            content = content.replace(dummy_data_marker, dummy_data_marker + '\n' + dummy_data_warning, 1)

    # Add section comments if they don't exist (simple check)
    # More robust would be to check if marker_text is preceded by ANY '--- ... ---' comment
    sections = {
        "// --- Data Ingestion & Preprocessing ---": "var aoi =",
        "// --- Helper Functions ---": "// Cloud masking for Landsat 8",
        "// --- Data Loading and Initial Processing Functions ---": "// Load Landsat 8, apply cloud mask, NDVI, and MNDWI",
        "// --- Annual Compositing Function ---": "function createAnnualMedianComposite(collection, year, bandName, aoi)",
        "// --- Execute Data Loading ---": "var landsat8Data = loadLandsat8Data(aoi, startDate, endDate);",
        "// --- Generate Annual Composites for each indicator ---": "var annualNdvi = ee.ImageCollection.fromImages",
        "// --- Display a sample layer ---": "if (annualNdvi.size().getInfo() > 0)",
        "// --- Feature Engineering ---": "var annualFeatureImages = ee.ImageCollection.fromImages",
        "// --- Machine Learning Model Implementation ---": "var classProperty = 'stress_level';",
        "// --- Hybrid Model Development (Majority Voting) ---": "var hybridAnnualClassification; // Declare in a scope accessible by the next section", # Adjusted marker
        "// --- Water Stress Mapping and Analysis ---": "print('\\n--- Water Stress Mapping and Analysis ---');"
    }

    for section_comment, marker_text in sections.items():
        # Check if marker_text exists and section_comment is not already immediately preceding it (ignoring whitespace)
        marker_pos = content.find(marker_text)
        if marker_pos != -1:
            # Check if the section comment is already there
            # Search in a small window before the marker
            search_window = content[max(0, marker_pos - len(section_comment) - 5) : marker_pos]
            if section_comment not in search_window:
                 content = content.replace(marker_text, section_comment + '\n' + marker_text, 1)

    # Add note about model parameters
    model_training_marker_rf = "// Random Forest" # Adjusted to be more specific for RF
    param_note_rf = """// Note: Adjust Random Forest parameters (numberOfTrees, etc.) as needed for your specific dataset and problem.
// Consult GEE documentation for ee.Classifier.smileRandomForest() for more details.
"""
    if model_training_marker_rf in content and param_note_rf not in content:
        content = content.replace(model_training_marker_rf, param_note_rf + model_training_marker_rf, 1)

    model_training_marker_svm = "// Support Vector Machine (SVM)"
    param_note_svm = """// Note: Adjust SVM parameters (svmType, kernelType, gamma, cost, etc.) as needed.
// Consult GEE documentation for ee.Classifier.libsvm() for more details.
"""
    if model_training_marker_svm in content and param_note_svm not in content:
         content = content.replace(model_training_marker_svm, param_note_svm + model_training_marker_svm, 1)


    with open(js_file_path, 'w') as f:
        f.write(content)

    print(f"Successfully refined and documented {js_file_path}")

except Exception as e:
    print(f"Error processing {js_file_path}: {e}")
