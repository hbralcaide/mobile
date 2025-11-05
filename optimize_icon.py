from PIL import Image, ImageDraw
import os

# Open the source image
source_image = r"C:\Users\Hannah\Desktop\mobile\new_icon.png"
img = Image.open(source_image)

# Convert to RGBA if not already
if img.mode != 'RGBA':
    img = img.convert('RGBA')

# Get the bounding box of the non-transparent content
bbox = img.getbbox()
print(f"Original size: {img.size}")
print(f"Content bounding box: {bbox}")

# Crop to content
cropped = img.crop(bbox)
print(f"Cropped size: {cropped.size}")

# Calculate the size for the final square image with minimal padding
content_size = max(cropped.size)
# No padding
padding_percent = 0.0
final_size = int(content_size * (1 + padding_percent * 2))

# Create a new square image with transparent background
final_img = Image.new('RGBA', (final_size, final_size), (255, 255, 255, 0))

# Calculate position to center the cropped content
x_offset = (final_size - cropped.size[0]) // 2
y_offset = (final_size - cropped.size[1]) // 2

# Paste the cropped content onto the final image
final_img.paste(cropped, (x_offset, y_offset), cropped)

print(f"Final image size: {final_img.size}")

# Define the sizes for each density
sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
}

# Base path for resources
res_path = r"C:\Users\Hannah\Desktop\mobile\android\app\src\main\res"

# Resize and save for each density
for folder, size in sizes.items():
    # Resize using high-quality resampling
    resized = final_img.resize((size, size), Image.Resampling.LANCZOS)
    
    # Save both ic_launcher.png and ic_launcher_round.png
    output_dir = os.path.join(res_path, folder)
    
    # Save regular icon
    output_path = os.path.join(output_dir, 'ic_launcher.png')
    resized.save(output_path, 'PNG')
    print(f"Created {folder}/ic_launcher.png ({size}x{size})")
    
    # Save round icon (same image)
    output_path_round = os.path.join(output_dir, 'ic_launcher_round.png')
    resized.save(output_path_round, 'PNG')
    print(f"Created {folder}/ic_launcher_round.png ({size}x{size})")

print("\nAll optimized icons created successfully!")
