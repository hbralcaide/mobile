from PIL import Image
import os

# Source image path - the new icon you provided
source_image = r"C:\Users\Hannah\Desktop\mobile\new_icon.png"

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

# Open the source image
img = Image.open(source_image)

# Convert to RGBA if not already
if img.mode != 'RGBA':
    img = img.convert('RGBA')

# Resize and save for each density
for folder, size in sizes.items():
    # Resize the image using high-quality resampling
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    
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

print("\nAll icons created successfully!")
