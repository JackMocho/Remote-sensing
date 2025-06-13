# OpenLayers Web Interface for Historical Maps

This project displays a basic web map using OpenLayers, featuring an OpenStreetMap basemap and a placeholder for displaying historical map layers from a GeoServer instance.

## Files

-   `index.html`: The main HTML file that structures the web page and includes the map container.
-   `main.js`: The JavaScript file that contains the OpenLayers map initialization and layer logic.

## How to Use

1.  **No server needed for basic functionality:** Simply open the `index.html` file directly in a modern web browser (e.g., Firefox, Chrome, Edge).
2.  **What to expect:**
    *   You should see a world map (OpenStreetMap) displayed on the page.
    *   Below the map, there is an "Historical Layer Opacity" slider. This slider controls the transparency of the example historical map layer.
    *   The JavaScript console in your browser's developer tools will likely show an error related to fetching the example historical map layer (e.g., `historical_map_example`). This is **expected** because the GeoServer WMS URL and layer are placeholders and require a running GeoServer instance with that specific layer published.
    *   The code for adding the historical layer (`addHistoricalLayer` function in `main.js`) serves as a template for how one would integrate WMS layers from GeoServer. The historical layer is added with an initial opacity (e.g., 75%), and the slider is initialized to this value.

## Opacity Slider

-   The slider located below the map allows you to adjust the opacity of the topmost historical layer (the one added as `historical_map_example` in the code).
-   Moving the slider will change the transparency of this layer, allowing you to visually compare it with the OpenStreetMap basemap underneath.
-   If no historical layer is loaded (due to placeholder URLs or GeoServer issues), the slider will still be present but won't visually affect any layer.

## OpenLayers Version

This example uses OpenLayers v9.1.0 (latest stable as of creation) via CDN.
To use a different version, update the CDN links in `index.html`.

## GeoServer Integration (Placeholder)

The `addHistoricalLayer` function in `main.js` is designed to add an ImageWMS layer from a GeoServer instance. To make this work:
1.  You need a running GeoServer instance.
2.  The GeoServer instance must have the specified layer (e.g., `historical_map_example`) published as a WMS service.
3.  You would update the `geoserverWMSUrl` and `layerName` parameters in the `main.js` file to point to your actual GeoServer service and layer.
    For example:
    ```javascript
    // Example for a local GeoServer
    const geoserverInstanceUrl = 'http://localhost:8080/geoserver/workspace_name/wms';
    const exampleLayerName = 'your_published_layer_name';
    const exampleTitle = 'My Custom Historical Layer'; // Optional title
    addHistoricalLayer(exampleLayerName, geoserverInstanceUrl, exampleTitle);
    // To specify opacity, add it as the fourth argument, e.g.:
    // addHistoricalLayer(exampleLayerName, geoserverInstanceUrl, exampleTitle, 0.5);
    ```
