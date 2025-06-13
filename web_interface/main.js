// Wait for the DOM to be fully loaded before initializing the map
document.addEventListener('DOMContentLoaded', function () {
    let historicalMapLayer; // Variable to store the historical map layer

    // Initialize the OpenLayers map
    const map = new ol.Map({
        target: 'map', // The ID of the div that will contain the map
        layers: [
            // Add a Tile layer with OpenStreetMap source
            new ol.layer.Tile({
                source: new ol.source.OSM() // OpenStreetMap tile source
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([0, 0]), // Center the map (longitude, latitude)
            zoom: 2 // Initial zoom level
        }),
        controls: ol.control.defaults({
            attributionOptions: {
                collapsible: false // Make attribution always visible if desired
            }
        })
    });

    /**
     * Adds a historical map layer from a GeoServer WMS service to the map.
     *
     * @param {string} layerName - The name of the layer as configured in GeoServer
     *                             (e.g., 'workspace:layername').
     * @param {string} geoserverWMSUrl - The base WMS URL of the GeoServer instance
     *                                   (e.g., 'http://localhost:8080/geoserver/workspace/wms').
     * @param {string} layerTitle - A user-friendly title for the layer (optional, for layer switcher etc.).
     * @param {number} initialOpacity - The initial opacity for the layer (0 to 1).
     * @returns {ol.layer.Image | null} The created ImageWMS layer or null if inputs are invalid.
     */
    function addHistoricalLayer(layerName, geoserverWMSUrl, layerTitle, initialOpacity = 0.75) {
        if (!layerName || !geoserverWMSUrl) {
            console.error('Layer name and GeoServer WMS URL are required to add a historical layer.');
            return null;
        }

        const newLayer = new ol.layer.Image({
            title: layerTitle || layerName, // Use provided title or layerName
            source: new ol.source.ImageWMS({
                url: geoserverWMSUrl, // URL of the WMS service
                params: {
                    'LAYERS': layerName, // Name of the layer(s) to display
                    'FORMAT': 'image/png', // Request PNG images
                    'TRANSPARENT': true // Request transparent images if applicable
                    // Other WMS parameters like TILED, VERSION can be added if needed
                },
                serverType: 'geoserver', // Specify server type for potential optimizations
                ratio: 1, // Image ratio. 1 means image size is the same as the map viewport.
                //crossOrigin: 'anonymous' // Uncomment if GeoServer is on a different domain and CORS is configured
            }),
            visible: true, // Set layer visibility
            opacity: initialOpacity // Set initial opacity
        });

        map.addLayer(newLayer);
        console.log(`Attempting to add WMS layer: ${layerName} from ${geoserverWMSUrl} with opacity ${initialOpacity}`);
        console.log(`A 404 or image loading error for '${layerName}' is expected if GeoServer is not running or the layer/WMS URL is a placeholder.`);
        return newLayer;
    }

    // --- Example Usage of addHistoricalLayer ---
    // These are placeholder values.
    // You would replace these with your actual GeoServer WMS URL and layer name.
    const exampleGeoserverWMSUrl = 'http://localhost:8080/geoserver/your_workspace/wms'; // Placeholder GeoServer WMS URL
    const exampleLayerName = 'historical_map_example'; // Placeholder layer name
    const exampleLayerTitle = 'My Example Historical Map';
    const initialOpacitySetting = 0.75; // Use a distinct variable name for clarity

    // Call the function to add the example historical layer and store it
    historicalMapLayer = addHistoricalLayer(exampleLayerName, exampleGeoserverWMSUrl, exampleLayerTitle, initialOpacitySetting);

    // You can add more layers by calling addHistoricalLayer multiple times
    // const anotherLayer = addHistoricalLayer('another_layer', 'http://localhost:8080/geoserver/another_ws/wms', 'Another Map', 0.5);

    // --- Opacity Slider Functionality ---
    const opacitySlider = document.getElementById('opacity-slider');

    if (opacitySlider) {
        // Set slider's initial position to match the layer's initial opacity
        // The slider's default value is already set in HTML, but this ensures sync if changed programmatically
        opacitySlider.value = initialOpacitySetting;

        opacitySlider.addEventListener('input', function () {
            const newOpacity = parseFloat(this.value);
            if (historicalMapLayer) {
                historicalMapLayer.setOpacity(newOpacity);
                // console.log(`Set opacity for ${historicalMapLayer.get('title')} to ${newOpacity}`); // Optional: for debugging
            } else {
                console.warn("Historical layer not available to set opacity.");
            }
        });
    } else {
        console.warn("Opacity slider element ('opacity-slider') not found.");
    }

    // Optional: Add a simple layer switcher or more complex UI controls here
    // For now, layers are added directly.
});
