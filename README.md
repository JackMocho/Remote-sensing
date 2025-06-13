# Digital Archive of Historical Maps with Comparison Tools

## Project Overview

This project aims to create a system for digitizing, processing, archiving, and viewing historical maps. It provides tools for preparing map images, a backend for serving these maps as web services, and a web-based frontend for visualization and comparison against contemporary basemaps. The goal is to make historical cartography more accessible and analyzable.

## System Architecture

The system is composed of three main components:

1.  **GeoServer Backend:**
    *   A robust, open-source server that publishes map data in standard OGC formats (like WMS, WFS, WCS).
    *   Used here to serve processed historical maps as WMS layers.
    *   Setup and initial configuration details are outlined in the [GeoServer Setup Guide](geoserver_setup_guide.md) (conceptually, as this file isn't part of the current toolset but was an output of a previous step related to outlining GeoServer setup).

2.  **Python Map Processing Tools (`map_processing_tool/`):**
    *   A suite of command-line Python scripts for preparing raw map images.
    *   Current functionalities include checking for existing georeferencing, converting images to GeoTIFF format, and a placeholder for future georeferencing capabilities.
    *   Detailed information: [`map_processing_tool/README.md`](map_processing_tool/README.md)

3.  **OpenLayers Web Frontend (`web_interface/`):**
    *   A web application built using the OpenLayers library for displaying maps.
    *   Provides a user interface to view historical maps served by GeoServer, overlayed on a modern basemap (OpenStreetMap).
    *   Includes an opacity slider for basic visual comparison between the historical map and the basemap.
    *   Detailed information: [`web_interface/README.md`](web_interface/README.md)

## Overall Workflow

1.  **Map Preparation & Processing:**
    *   Historical maps (e.g., scanned images in PNG, JPG, or TIFF format) are processed using the Python tools in the `map_processing_tool/` directory.
    *   This may involve converting them to GeoTIFF format (`convert` operation).
    *   Ideally, maps would be georeferenced using these tools (currently a placeholder function). If a map is already georeferenced, this can be checked (`check_georef` flag).
    *   The output is typically a GeoTIFF file ready for server deployment.

2.  **Uploading to GeoServer:**
    *   The processed GeoTIFF files are manually uploaded to a GeoServer instance.
    *   This involves creating a new data store in GeoServer, pointing to the GeoTIFF file, and then publishing it as a WMS layer.
    *   Detailed manual steps for this process are outlined in the [`map_processing_tool/README.md`](map_processing_tool/README.md#manual-steps-for-uploading-a-geotiff-to-geoserver).

3.  **Viewing and Comparing Maps:**
    *   Users access the web interface (`web_interface/index.html`) in their browser.
    *   The interface loads the configured historical map layer from GeoServer (via WMS).
    *   Users can then view the historical map overlaid on an OpenStreetMap basemap.
    *   The opacity slider can be used to adjust the transparency of the historical map, allowing for visual comparison with the underlying basemap.

## Future Improvements

This system provides a foundational framework. Key areas for future enhancements include:

*   **GeoServer Enhancements:**
    *   **Security:** Implement robust security measures, including changing default credentials, securing the data directory, configuring service-level access controls, and running GeoServer under a non-root user with HTTPS.
    *   **Performance Tuning:** Optimize JVM settings, leverage GeoWebCache effectively, and consider advanced data formats like Cloud-Optimized GeoTIFFs (COGs) for very large datasets.
    *   **Logging & Monitoring:** Establish comprehensive logging and monitoring practices.
    *   **Backup Strategy:** Implement a regular backup strategy for the GeoServer data directory.

*   **Python Map Processing Tool Enhancements:**
    *   **Full Georeferencing:** Implement actual georeferencing capabilities, potentially using GCPs (Ground Control Points) and `rasterio` or GDAL.
    *   **Reprojection:** Add support for reprojecting maps to different Coordinate Reference Systems (CRS).
    *   **Batch Processing:** Enable processing of multiple map files in a directory.
    *   **Advanced Error Handling:** Improve error reporting for image content issues beyond basic format recognition.
    *   **Metadata Support:** Allow for the creation and editing of metadata within processed files.

*   **Web Interface Enhancements:**
    *   **Visual Feedback for Layer Loading:** Provide clear messages in the UI if WMS layers fail to load or if there are other issues.
    *   **Advanced Comparison Tools:** Implement tools like a swipe control for side-by-side map comparison.
    *   **Dynamic Layer Management:** Allow users to add/configure WMS layers dynamically or select from a pre-configured list.
    *   **Contextual Map View:** Adjust the initial map view based on the extent of loaded historical maps.
    *   **Metadata Display:** Show relevant metadata for the displayed historical maps.
    *   **Improved UI/UX:** Enhance the overall user interface with features like loading indicators and a more polished design.

---
*This README provides a high-level overview. For component-specific details, please refer to the README files within their respective directories.*
