#!/bin/bash
# Icon Generation Script (Legacy - Now automated)
# 
# Icon conversion is now automated during the build process!
# The build script automatically converts SVG icons to PNG using the sharp library.
#
# To manually convert icons, run:
#   npm run build:icons
#
# The automated conversion happens during:
#   npm run build:quick
#
# This generates high-quality PNG files at the correct sizes:
# - icon-16.png: 16x16 pixels
# - icon-32.png: 32x32 pixels
# - icon-48.png: 48x48 pixels
# - icon-128.png: 128x128 pixels
#
# If you need to manually convert (e.g., for debugging), you can use ImageMagick:
#   magick convert icon-16.svg -density 96 icon-16.png
#   magick convert icon-32.svg -density 96 icon-32.png
#   magick convert icon-48.svg -density 96 icon-48.png
#   magick convert icon-128.svg -density 96 icon-128.png

echo "✓ Icon conversion is automated during build process"
echo "Run 'npm run build:icons' to convert SVG icons to PNG"