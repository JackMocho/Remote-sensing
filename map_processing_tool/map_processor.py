#!/usr/bin/env python3

"""
Map Processing Tool
-------------------
A command-line tool for performing various map processing operations.

Key Libraries:
- rasterio: For reading, writing, and manipulating raster geospatial data.
- argparse: For parsing command-line arguments.
- os: For interacting with the operating system (e.g., file paths).
"""

import argparse
import os
import rasterio
from rasterio.crs import CRS

def is_georeferenced(file_path):
    """
    Checks if a raster file has Coordinate Reference System (CRS) information.

    Args:
        file_path (str): Path to the raster file.

    Returns:
        bool: True if the file has CRS information, False otherwise.
    """
    try:
        with rasterio.open(file_path) as src:
            if src.crs:
                print(f"Map '{file_path}' is georeferenced. CRS: {src.crs}")
                return True
            else:
                print(f"Map '{file_path}' is not georeferenced (no CRS information found).")
                return False
    except rasterio.errors.RasterioIOError:
        print(f"Error: Could not open or read '{file_path}'. It might not be a valid raster format.")
        return False
    except Exception as e:
        print(f"An unexpected error occurred while checking georeferencing for '{file_path}': {e}")
        return False

def convert_to_geotiff(input_path, output_path):
    """
    Converts an image file (e.g., PNG, JPG) to GeoTIFF format.
    The output GeoTIFF will not be georeferenced unless the input already has CRS info
    and rasterio can preserve it (which is unlikely for plain images).
    This function primarily handles format conversion.

    Args:
        input_path (str): Path to the input image file.
        output_path (str): Path to save the output GeoTIFF file.
    """
    try:
        with rasterio.open(input_path) as src:
            profile = src.profile
            # Ensure driver is GeoTIFF for output
            profile['driver'] = 'GTiff'
            # If input is, for example, a 3-band PNG, it might not have a nodata value defined
            # Or if it has an alpha band, rasterio handles it.
            # We write it as is, focusing on format conversion.

            # If the source was a simple image format like PNG/JPEG, it won't have CRS.
            # If it was already a GeoTIFF or similar with CRS, it would be preserved.
            if not src.crs:
                print(f"Warning: Input file '{input_path}' has no CRS. Output GeoTIFF will also lack CRS.")

            with rasterio.open(output_path, 'w', **profile) as dst:
                dst.write(src.read())
            print(f"Successfully converted '{input_path}' to GeoTIFF: '{output_path}'")

            # Verify if output has CRS (it would if input did)
            is_georeferenced(output_path)

    except rasterio.errors.RasterioIOError as e:
        print(f"Error: Could not open or read input file '{input_path}'. Ensure it's a valid image format. Details: {e}")
    except Exception as e:
        print(f"An error occurred during conversion of '{input_path}' to '{output_path}': {e}")

def georeference_map(input_path, output_path, control_points_file):
    """
    Placeholder for georeferencing a map using control points.
    Actual georeferencing is complex and often requires manual GCP selection
    or more sophisticated algorithms (e.g., GDAL's tools with GCPs).

    Args:
        input_path (str): Path to the input map file.
        output_path (str): Path to save the georeferenced output GeoTIFF file.
        control_points_file (str): Path to the file containing control points.
    """
    print(f"Placeholder: Georeferencing '{input_path}' using '{control_points_file}'.")
    print(f"Output would be saved to '{output_path}'.")
    # In a real implementation, this would involve:
    # 1. Reading control points (e.g., from CSV: image_x, image_y, geo_x, geo_y, epsg_code)
    # 2. Using rasterio/GDAL to apply a transformation (e.g., polynomial) based on GCPs.
    # 3. Writing the output with the new CRS and geotransform.
    # For now, we can simulate by copying the input to output and trying to assign a dummy CRS if needed.

    # Simulate by copying and attempting to add a dummy CRS for demonstration if no GCPs provided
    # This is NOT real georeferencing.
    try:
        with rasterio.open(input_path) as src:
            profile = src.profile
            profile['driver'] = 'GTiff' # Ensure output is GeoTIFF

            # If control_points_file is just a placeholder, we can't do real georef.
            # A real version would use GCPs to calculate transform and CRS.
            # For this placeholder, we'll just note it.
            print("Note: This is a placeholder. Actual georeferencing requires processing GCPs.")

            # If we had GCPs, we'd calculate transform and CRS here.
            # For example, setting a dummy CRS if none exists:
            if not profile.get('crs'):
                 profile['crs'] = CRS.from_epsg(4326) # Dummy CRS: WGS84
                 profile['transform'] = rasterio.Affine.identity() # Dummy transform
                 print(f"Placeholder: Assigning dummy CRS (EPSG:4326) and identity transform to '{output_path}'.")


            with rasterio.open(output_path, 'w', **profile) as dst:
                dst.write(src.read())
            print(f"Placeholder georeferencing complete. Output saved to '{output_path}'.")
            is_georeferenced(output_path)

    except Exception as e:
        print(f"Error during placeholder georeferencing for '{input_path}': {e}")


def process_map(input_file, output_dir, operations, gcp_file=None):
    """
    Main orchestrator function to process the map based on specified operations.

    Args:
        input_file (str): Path to the input map file.
        output_dir (str): Directory to save processed files.
        operations (list): A list of operations to perform (e.g., ['convert', 'georeference']).
        gcp_file (str, optional): Path to the control points file for georeferencing.
    """
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        return

    if output_dir and not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir)
            print(f"Created output directory: '{output_dir}'")
        except OSError as e:
            print(f"Error: Could not create output directory '{output_dir}': {e}")
            return

    current_input_path = input_file
    base_filename = os.path.splitext(os.path.basename(input_file))[0]

    for op_index, operation in enumerate(operations):
        print(f"\nProcessing operation: {operation.upper()}")

        # Determine output path for this operation
        # If it's not the first operation, the input is the output of the previous one.
        if op_index > 0 and 'last_output_path' in locals():
            current_input_path = locals()['last_output_path']

        output_filename_suffix = f"_{operation}"
        # For multi-step operations, chain filenames or use a consistent intermediate naming scheme
        # For simplicity, each operation creates a new file based on original + suffix
        # A more robust solution might use temporary files for intermediate steps if not explicitly saved.

        # For now, operations that produce output will use the output_dir
        if operation in ["convert", "georeference"]:
            if not output_dir:
                print(f"Error: --output_dir is required for operation '{operation}'.")
                continue

            # If it's an intermediate step in a chain, adjust input for next operation
            # This simple example always bases output on the original filename + suffix
            # A more complex chain would use output of previous step as input to next.
            # current_output_path = os.path.join(output_dir, f"{base_filename}{output_filename_suffix}.tif")

            # Let's make intermediate files if multiple operations
            if len(operations) > 1 and op_index < len(operations) -1 : # it's an intermediate step
                 # use a temp-like name for intermediate, or pass to next step directly
                 # for now, each op saves its own output clearly named
                 intermediate_base = os.path.splitext(os.path.basename(current_input_path))[0]
                 current_output_path = os.path.join(output_dir, f"{intermediate_base}_{operation}.tif")

            else: # final operation or only operation
                 current_output_path = os.path.join(output_dir, f"{base_filename}_{operation}.tif")


            if operation == "convert":
                convert_to_geotiff(current_input_path, current_output_path)
                locals()['last_output_path'] = current_output_path # for chaining
            elif operation == "georeference":
                if not gcp_file:
                    print("Error: Georeferencing operation requires a control points file (--gcp_file).")
                    continue
                if not os.path.exists(gcp_file):
                    print(f"Error: Control points file '{gcp_file}' not found.")
                    continue
                georeference_map(current_input_path, current_output_path, gcp_file)
                locals()['last_output_path'] = current_output_path # for chaining

        elif operation == "check_georef": # 'check_georef' is not a standard operation in the list
            # This is handled by the --check_georef flag separately for the main input
            # or could be called on current_input_path if part of a chain
            print(f"Checking georeferencing status for: {current_input_path}")
            is_georeferenced(current_input_path)
        else:
            print(f"Warning: Unknown operation '{operation}'. Skipping.")

    print("\nAll specified operations complete.")

def main():
    parser = argparse.ArgumentParser(description="Map Processing Tool")
    parser.add_argument("--input_file", "-i", required=True, help="Path to the input map file.")
    parser.add_argument("--output_dir", "-o", help="Directory to save processed output files.")

    parser.add_argument("--operations", "-op", nargs='+',
                        choices=['convert', 'georeference', 'check_georef'], # 'check_georef' here for direct op list
                        help="List of operations to perform (e.g., convert georeference).")

    parser.add_argument("--gcp_file", "-gcp", help="Path to the Ground Control Points (GCP) file (e.g., for georeferencing).")

    # Dedicated flag for checking georeferencing of the input file
    parser.add_argument("--check_georef", action='store_true',
                        help="Check if the input map is georeferenced (reports CRS if available).")

    args = parser.parse_args()

    if not args.operations and not args.check_georef:
        parser.print_help()
        print("\nError: No operation specified. Please use --operations or --check_georef.")
        return

    if args.check_georef:
        print(f"Checking georeferencing for input file: {args.input_file}")
        is_georeferenced(args.input_file)
        # If only check_georef is specified, and no other operations, exit after checking.
        if not args.operations:
            return

    # Ensure output_dir is provided if operations require it
    if args.operations:
        requires_output = any(op in ['convert', 'georeference'] for op in args.operations)
        if requires_output and not args.output_dir:
            parser.error("--output_dir is required for 'convert' or 'georeference' operations.")
            return # Redundant due to parser.error, but good for clarity

        process_map(args.input_file, args.output_dir, args.operations, args.gcp_file)

if __name__ == "__main__":
    main()
