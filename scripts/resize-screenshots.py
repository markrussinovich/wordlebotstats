#!/usr/bin/env python3
"""
Screenshot resizer for Chrome Web Store submission
Resizes images to 1280x800 or 640x400 with proper padding/letterboxing
"""

import os
import sys
from PIL import Image, ImageOps
import argparse

def resize_image_with_padding(input_path, output_path, target_size=(1280, 800), background_color=(255, 255, 255)):
    """
    Resize image to target size, adding padding as needed to maintain aspect ratio
    
    Args:
        input_path: Path to input image
        output_path: Path to save resized image
        target_size: Tuple of (width, height) for target dimensions
        background_color: RGB tuple for background/padding color
    """
    try:
        # Open the original image
        with Image.open(input_path) as img:
            print(f"Processing {input_path}")
            print(f"  Original size: {img.size}")
            
            # Convert to RGB if necessary (handles RGBA, grayscale, etc.)
            if img.mode != 'RGB':
                # If image has transparency, composite it over the background color
                if img.mode in ('RGBA', 'LA'):
                    background = Image.new('RGB', img.size, background_color)
                    if img.mode == 'RGBA':
                        background.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
                    else:
                        background.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
                    img = background
                else:
                    img = img.convert('RGB')
            
            # Calculate scaling to fit within target size while maintaining aspect ratio
            img_ratio = img.width / img.height
            target_ratio = target_size[0] / target_size[1]
            
            if img_ratio > target_ratio:
                # Image is wider than target ratio - fit to width
                new_width = target_size[0]
                new_height = int(target_size[0] / img_ratio)
            else:
                # Image is taller than target ratio - fit to height
                new_height = target_size[1]
                new_width = int(target_size[1] * img_ratio)
            
            # Resize the image maintaining aspect ratio
            img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"  Resized to: {img_resized.size}")
            
            # Create new image with target size and background color
            result = Image.new('RGB', target_size, background_color)
            
            # Calculate position to center the resized image
            paste_x = (target_size[0] - new_width) // 2
            paste_y = (target_size[1] - new_height) // 2
            
            # Paste the resized image onto the background
            result.paste(img_resized, (paste_x, paste_y))
            
            # Save the result
            result.save(output_path, 'PNG', quality=95, optimize=True)
            print(f"  Saved to: {output_path}")
            print(f"  Final size: {result.size}")
            print()
            
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False
    
    return True

def detect_background_color(image_path):
    """
    Detect if image has light or dark background to choose appropriate padding color
    """
    try:
        with Image.open(image_path) as img:
            # Convert to RGB and get colors from corners
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Sample corner pixels
            corners = [
                img.getpixel((0, 0)),
                img.getpixel((img.width-1, 0)),
                img.getpixel((0, img.height-1)),
                img.getpixel((img.width-1, img.height-1))
            ]
            
            # Calculate average brightness of corners
            avg_brightness = sum(sum(pixel) for pixel in corners) / (len(corners) * 3)
            
            # Return dark background for dark images, light for light images
            if avg_brightness < 128:
                return (30, 30, 30)  # Dark grey
            else:
                return (255, 255, 255)  # White
                
    except Exception:
        return (255, 255, 255)  # Default to white

def main():
    parser = argparse.ArgumentParser(description='Resize screenshots for Chrome Web Store')
    parser.add_argument('--input-dir', default='../listing/assets', 
                       help='Directory containing input images (default: ../listing/assets)')
    parser.add_argument('--output-dir', default='../listing/assets/resized', 
                       help='Directory to save resized images (default: ../listing/assets/resized)')
    parser.add_argument('--size', choices=['large', 'small'], default='large',
                       help='Target size: large (1280x800) or small (640x400)')
    parser.add_argument('--background', choices=['white', 'dark', 'auto'], default='auto',
                       help='Background color: white, dark, or auto-detect')
    
    args = parser.parse_args()
    
    # Set target size based on argument
    target_size = (1280, 800) if args.size == 'large' else (640, 400)
    
    # Get absolute paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.normpath(os.path.join(script_dir, args.input_dir))
    output_dir = os.path.normpath(os.path.join(script_dir, args.output_dir))
    
    print(f"Chrome Web Store Screenshot Resizer")
    print(f"Target size: {target_size[0]}x{target_size[1]}")
    print(f"Input directory: {input_dir}")
    print(f"Output directory: {output_dir}")
    print()
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all image files in input directory
    image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'}
    image_files = []
    
    if not os.path.exists(input_dir):
        print(f"Error: Input directory '{input_dir}' does not exist")
        return 1
    
    for filename in os.listdir(input_dir):
        if any(filename.lower().endswith(ext) for ext in image_extensions):
            # Skip README and other non-screenshot files
            if not filename.lower().startswith('readme'):
                image_files.append(filename)
    
    if not image_files:
        print(f"No image files found in {input_dir}")
        return 1
    
    print(f"Found {len(image_files)} image files to process:")
    for filename in image_files:
        print(f"  - {filename}")
    print()
    
    # Process each image
    success_count = 0
    for filename in image_files:
        input_path = os.path.join(input_dir, filename)
        
        # Generate output filename
        name, ext = os.path.splitext(filename)
        output_filename = f"{name}_resized{ext}"
        output_path = os.path.join(output_dir, output_filename)
        
        # Determine background color
        if args.background == 'white':
            bg_color = (255, 255, 255)
        elif args.background == 'dark':
            bg_color = (30, 30, 30)
        else:  # auto
            bg_color = detect_background_color(input_path)
        
        # Resize the image
        if resize_image_with_padding(input_path, output_path, target_size, bg_color):
            success_count += 1
    
    print(f"Successfully processed {success_count}/{len(image_files)} images")
    print(f"Resized images saved to: {output_dir}")
    
    if success_count > 0:
        print("\nNext steps:")
        print("1. Review the resized images to ensure they look correct")
        print("2. Replace the original files in listing/assets/ with the resized versions")
        print("3. Update the status in listing/asset-plan.md")
    
    return 0 if success_count == len(image_files) else 1

if __name__ == '__main__':
    sys.exit(main())