# Icon Generation Script
# This script converts SVG icons to PNG format for browser extension

# Instructions:
# 1. Install ImageMagick or use an online SVG to PNG converter
# 2. Convert each SVG icon to PNG format with the following commands:
#    
#    magick convert icon-16.svg -density 96 icon-16.png
#    magick convert icon-32.svg -density 96 icon-32.png  
#    magick convert icon-48.svg -density 96 icon-48.png
#    magick convert icon-128.svg -density 96 icon-128.png
#
# 3. Or use online converters:
#    - https://convertio.co/svg-png/
#    - https://cloudconvert.com/svg-to-png
#    - https://svgtopng.com/
#
# 4. Ensure PNG files are optimized for size:
#    - Use PNG-8 for smaller file sizes where possible
#    - Optimize with tools like TinyPNG or pngquant

echo "Extension icon files created as SVG format"
echo "Convert to PNG using ImageMagick or online tools as described above"
echo ""
echo "Target sizes:"
echo "- icon-16.png: 16x16 pixels"  
echo "- icon-32.png: 32x32 pixels"
echo "- icon-48.png: 48x48 pixels"
echo "- icon-128.png: 128x128 pixels"