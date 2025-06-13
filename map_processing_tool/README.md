# Map Processing Tool

This tool provides functionalities for basic map processing operations.

## Directory Structure

```
map_processing_tool/
├── map_processor.py       # Main script
├── data/
│   ├── input/
│   │   └── example_map.png  # Example input map (e.g., a simple PNG or JPG)
│   └── control_points/
│       └── example_map_gcp.csv # Example control points file
└── output/                  # Directory for processed maps
```

## Setup

1.  **Install Libraries:**
    ```bash
    pip install rasterio argparse
    ```

## Usage

The script `map_processor.py` is used to perform operations.

**Examples:**

1.  **Check if a map is georeferenced:**
    ```bash
    python map_processor.py --input_file data/input/example_map.png --check_georef
    ```

2.  **Convert a map to GeoTIFF:**
    ```bash
    python map_processor.py --input_file data/input/example_map.png --output_dir output/ --operations convert
    ```

3.  **Georeference a map (placeholder operation):**
    ```bash
    python map_processor.py --input_file data/input/example_map.png --output_dir output/ --operations georeference --gcp_file data/control_points/example_map_gcp.csv
    ```

4.  **Perform multiple operations (e.g., convert then check georeferencing - conceptually):**
    ```bash
    python map_processor.py --input_file data/input/example_map.png --output_dir output/ --operations convert check_georef
    ```
    (Note: The `check_georef` operation in a sequence would apply to the *output* of the previous step if designed that way, or the input. Current design is simpler: `check_georef` is a standalone flag for the input file).

## Simulating Data Loading and GeoServer Upload

1.  **Running the script for conversion:**

    The `example_map.png` in `data/input/` is a text file placeholder. Running the script on it will show `rasterio` failing to open it, which is expected. If it were a real PNG, the conversion would proceed.

    ```bash
    # First, install dependencies if you haven't already:
    # pip install rasterio argparse

    # Check georeferencing (will fail for the text-based placeholder PNG)
    python map_processor.py --input_file data/input/example_map.png --check_georef
    # Expected output:
    # Checking georeferencing for input file: data/input/example_map.png
    # Error: Could not open or read 'data/input/example_map.png'. It might not be a valid raster format.

    # Convert to GeoTIFF (will also fail for the text-based placeholder PNG)
    python map_processor.py --input_file data/input/example_map.png --output_dir output/ --operations convert
    # Expected output:
    # Processing operation: CONVERT
    # Error: Could not open or read input file 'data/input/example_map.png'. Ensure it's a valid image format. Details: 'data/input/example_map.png' not recognized as being in a supported file format.
    # All specified operations complete.
    ```
    If `data/input/example_map.png` were a valid image file, the convert operation would produce `output/example_map_convert.tif`.

2.  **Manual Steps for Uploading a GeoTIFF to GeoServer:**

    Assuming you have a valid GeoTIFF file (e.g., `output/example_map_convert.tif` generated from a real image):

    a.  **Navigate to GeoServer:** Open your GeoServer instance in a web browser (e.g., `http://localhost:8080/geoserver`).
    b.  **Log in:** Log in with your admin credentials.
    c.  **Create a Workspace (if needed):**
        *   Go to `Data` > `Workspaces`.
        *   Click `Add new workspace`.
        *   Fill in `Name` (e.g., `my_historical_maps`) and `Namespace URI` (e.g., `http://example.com/my_historical_maps`).
        *   Click `Submit`.
    d.  **Create a New Store:**
        *   Go to `Data` > `Stores`.
        *   Click `Add new Store`.
        *   Under `Raster Data Sources`, select `GeoTIFF`.
        *   **Workspace:** Choose your workspace (e.g., `my_historical_maps`).
        *   **Data Source Name:** Give your store a name (e.g., `example_map_store`).
        *   **Connection Parameters:** For `URL`, provide the path to your GeoTIFF file. This can be:
            *   A local file path accessible to the GeoServer process (e.g., `file:/path/to/your/map_processing_tool/output/example_map_convert.tif` or `file:data/my_geotiffs/example_map_convert.tif` if placed in GeoServer's data directory).
            *   A URL if the GeoTIFF is hosted elsewhere (less common for initial upload).
        *   Click `Save`.
    e.  **Publish the Layer:**
        *   After saving the store, GeoServer should redirect you to a `New Layer` page, or you can find your new store and click `Publish` next to the layer name (which usually defaults to the filename, e.g., `example_map_convert`).
        *   **Name:** This will be the layer name used in WMS requests (e.g., `example_map_convert`). You can edit it.
        *   **Coordinate Reference Systems:**
            *   `Native CRS`: Should be detected from the GeoTIFF if it's properly georeferenced.
            *   `Declared CRS`: Should match the Native CRS.
        *   **Bounding Boxes:** Click `Compute from data` and then `Compute from native bounds`.
        *   **HTTP Settings / Caching (Optional):** Configure as needed.
        *   Go to the `Publishing` tab at the top.
        *   **Layer Settings / WMS Settings:** Adjust settings like `Default Style` if you have custom styles.
        *   Click `Save`.
    f.  **Preview the Layer:**
        *   Go to `Data` > `Layer Preview`.
        *   Find your layer (e.g., `my_historical_maps:example_map_convert`).
        *   Click the `OpenLayers` link in a common format (e.g., PNG) to preview it.

    This layer would then be accessible via WMS, for example, through the OpenLayers interface by configuring `main.js` with the correct GeoServer WMS URL and layer name.
