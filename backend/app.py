import os
import zipfile
import json
import tempfile
import shutil
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
from PIL import Image
import io

app = Flask(__name__)
# Allow CORS from any origin (for production, restrict to your frontend domain)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def extract_images_from_zip(zip_path):
    """Extract images from ZIP file and return sorted list of image paths."""
    images = []
    temp_dir = tempfile.mkdtemp()
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
        
        # Get all image files and sort them
        image_extensions = ('.jpg', '.jpeg', '.png', '.bmp')
        for root, dirs, files in os.walk(temp_dir):
            for file in sorted(files):
                if file.lower().endswith(image_extensions):
                    images.append(os.path.join(root, file))
    
    return images, temp_dir

def cylindrical_warp(img, fov=90):
    """
    Apply cylindrical projection to an image.
    fov: field of view in degrees
    """
    h, w = img.shape[:2]
    f = w / (2 * np.tan(np.radians(fov / 2)))
    
    # Create output image (same height, wider for cylindrical projection)
    out_h = h
    out_w = int(2 * f * np.tan(np.radians(fov / 2)))
    
    # Create coordinate maps
    map_x = np.zeros((out_h, out_w), dtype=np.float32)
    map_y = np.zeros((out_h, out_w), dtype=np.float32)
    
    center_x = w / 2
    center_y = h / 2
    
    for y in range(out_h):
        for x in range(out_w):
            # Convert to cylindrical coordinates
            theta = (x - out_w / 2) / f
            h_cyl = (y - out_h / 2) / f
            
            # Convert back to image coordinates
            src_x = f * np.tan(theta) + center_x
            src_y = f * h_cyl / np.cos(theta) + center_y
            
            map_x[y, x] = src_x
            map_y[y, x] = src_y
    
    # Remap image
    warped = cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return warped

def stitch_images_sift(images, output_path, debug_path=None):
    """
    Stitch images using SIFT feature detection and cylindrical warping.
    Returns success status and debug visualization if requested.
    """
    if len(images) < 2:
        return False, None, "Need at least 2 images to stitch"
    
    # Read images
    imgs = []
    for img_path in images:
        img = cv2.imread(img_path)
        if img is None:
            continue
        imgs.append(img)
    
    if len(imgs) < 2:
        return False, None, "Could not read enough images"
    
    # Apply cylindrical warping to all images
    warped_imgs = []
    for img in imgs:
        warped = cylindrical_warp(img, fov=90)
        warped_imgs.append(warped)
    
    # Initialize SIFT detector
    sift = cv2.SIFT_create()
    
    # Detect keypoints and descriptors for all images
    keypoints = []
    descriptors = []
    for img in warped_imgs:
        kp, desc = sift.detectAndCompute(img, None)
        keypoints.append(kp)
        descriptors.append(desc)
    
    # Match features between consecutive images
    matcher = cv2.BFMatcher(cv2.NORM_L2, crossCheck=False)
    matches_list = []
    
    for i in range(len(warped_imgs) - 1):
        if descriptors[i] is None or descriptors[i+1] is None:
            continue
        
        matches = matcher.knnMatch(descriptors[i], descriptors[i+1], k=2)
        # Apply Lowe's ratio test
        good_matches = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < 0.75 * n.distance:
                    good_matches.append(m)
        
        matches_list.append(good_matches)
    
    # Create debug visualization if requested
    debug_img = None
    if debug_path:
        debug_imgs = []
        for i in range(len(warped_imgs) - 1):
            if i < len(matches_list) and len(matches_list[i]) > 10:
                img_match = cv2.drawMatches(
                    warped_imgs[i], keypoints[i],
                    warped_imgs[i+1], keypoints[i+1],
                    matches_list[i][:50],  # Show first 50 matches
                    None,
                    flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS
                )
                debug_imgs.append(img_match)
        
        if debug_imgs:
            # Stack debug images vertically
            debug_img = np.vstack(debug_imgs)
            cv2.imwrite(debug_path, debug_img)
    
    # Calculate homographies and stitch images
    try:
        # Use OpenCV's built-in stitcher for robust stitching
        stitcher = cv2.Stitcher.create()
        status, panorama = stitcher.stitch(warped_imgs)
        
        if status == cv2.Stitcher_OK:
            cv2.imwrite(output_path, panorama)
            return True, debug_img, "Stitching successful"
        else:
            # Fallback: try manual stitching with homography
            return stitch_manual_homography(warped_imgs, keypoints, matches_list, output_path, debug_path)
    except Exception as e:
        # Fallback to manual stitching
        return stitch_manual_homography(warped_imgs, keypoints, matches_list, output_path, debug_path)

def stitch_manual_homography(imgs, keypoints, matches_list, output_path, debug_path):
    """Fallback manual stitching using homography estimation."""
    try:
        if len(imgs) < 2:
            return False, None, "Need at least 2 images"
        
        # Start with first image
        panorama = imgs[0].copy()
        current_x = imgs[0].shape[1]
        
        for i in range(len(imgs) - 1):
            if i >= len(matches_list) or len(matches_list[i]) < 4:
                # Not enough matches, simple concatenation
                h = max(panorama.shape[0], imgs[i+1].shape[0])
                w = current_x + imgs[i+1].shape[1]
                new_panorama = np.zeros((h, w, 3), dtype=np.uint8)
                new_panorama[:panorama.shape[0], :current_x] = panorama
                new_panorama[:imgs[i+1].shape[0], current_x:] = imgs[i+1]
                panorama = new_panorama
                current_x += imgs[i+1].shape[1]
                continue
            
            # Extract matched points
            src_pts = np.float32([keypoints[i][m.queryIdx].pt for m in matches_list[i]]).reshape(-1, 1, 2)
            dst_pts = np.float32([keypoints[i+1][m.trainIdx].pt for m in matches_list[i]]).reshape(-1, 1, 2)
            
            # Find homography
            H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)
            
            if H is None:
                # Fallback to simple concatenation
                h = max(panorama.shape[0], imgs[i+1].shape[0])
                w = current_x + imgs[i+1].shape[1]
                new_panorama = np.zeros((h, w, 3), dtype=np.uint8)
                new_panorama[:panorama.shape[0], :current_x] = panorama
                new_panorama[:imgs[i+1].shape[0], current_x:] = imgs[i+1]
                panorama = new_panorama
                current_x += imgs[i+1].shape[1]
                continue
            
            # Warp second image
            h2, w2 = imgs[i+1].shape[:2]
            corners = np.float32([[0, 0], [w2, 0], [w2, h2], [0, h2]]).reshape(-1, 1, 2)
            warped_corners = cv2.perspectiveTransform(corners, H)
            
            # Calculate output size
            all_corners = np.concatenate([
                np.float32([[0, 0], [panorama.shape[1], 0], 
                           [panorama.shape[1], panorama.shape[0]], [0, panorama.shape[0]]]),
                warped_corners.reshape(-1, 2)
            ], axis=0)
            
            [x_min, y_min] = np.int32(all_corners.min(axis=0).ravel() - 0.5)
            [x_max, y_max] = np.int32(all_corners.max(axis=0).ravel() + 0.5)
            
            # Translation to fit
            translation_dist = [-x_min, -y_min]
            H_translation = np.array([[1, 0, translation_dist[0]], 
                                     [0, 1, translation_dist[1]], 
                                     [0, 0, 1]], dtype=np.float32)
            H = H_translation @ H
            
            # Warp and blend
            output_width = x_max - x_min
            output_height = y_max - y_min
            
            warped_img2 = cv2.warpPerspective(imgs[i+1], H, (output_width, output_height))
            
            # Create mask for blending
            mask1 = np.zeros((output_height, output_width), dtype=np.uint8)
            mask1[translation_dist[1]:translation_dist[1]+panorama.shape[0],
                  translation_dist[0]:translation_dist[0]+panorama.shape[1]] = 255
            
            mask2 = (warped_img2.sum(axis=2) > 0).astype(np.uint8) * 255
            
            # Resize panorama to match output size
            new_panorama = np.zeros((output_height, output_width, 3), dtype=np.uint8)
            new_panorama[translation_dist[1]:translation_dist[1]+panorama.shape[0],
                        translation_dist[0]:translation_dist[0]+panorama.shape[1]] = panorama
            
            # Blend images
            mask_overlap = cv2.bitwise_and(mask1, mask2)
            mask1_only = cv2.bitwise_and(mask1, cv2.bitwise_not(mask_overlap))
            mask2_only = cv2.bitwise_and(mask2, cv2.bitwise_not(mask_overlap))
            
            result = new_panorama.copy()
            result[mask2_only > 0] = warped_img2[mask2_only > 0]
            
            # Blend overlap region
            overlap_y, overlap_x = np.where(mask_overlap > 0)
            if len(overlap_y) > 0:
                blend_alpha = 0.5
                result[overlap_y, overlap_x] = (
                    blend_alpha * new_panorama[overlap_y, overlap_x].astype(float) +
                    (1 - blend_alpha) * warped_img2[overlap_y, overlap_x].astype(float)
                ).astype(np.uint8)
            
            panorama = result
            current_x = output_width
        
        # Crop to actual content
        non_zero = np.where(panorama.sum(axis=2) > 0)
        if len(non_zero[0]) > 0:
            min_y, max_y = non_zero[0].min(), non_zero[0].max()
            min_x, max_x = non_zero[1].min(), non_zero[1].max()
            panorama = panorama[min_y:max_y+1, min_x:max_x+1]
        
        cv2.imwrite(output_path, panorama)
        return True, None, "Manual stitching successful"
    except Exception as e:
        return False, None, f"Stitching failed: {str(e)}"

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/stitch', methods=['POST'])
def stitch():
    try:
        # Check if files are present
        if 'images' not in request.files:
            return jsonify({'error': 'No images file provided'}), 400
        
        if 'metadata' not in request.form:
            return jsonify({'error': 'No metadata provided'}), 400
        
        images_file = request.files['images']
        metadata_str = request.form['metadata']
        
        # Parse metadata
        try:
            metadata = json.loads(metadata_str)
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid metadata JSON'}), 400
        
        # Save uploaded ZIP
        zip_path = os.path.join(UPLOAD_FOLDER, f"upload_{tempfile.mkstemp()[1].split('/')[-1]}.zip")
        images_file.save(zip_path)
        
        # Extract images
        images, temp_dir = extract_images_from_zip(zip_path)
        
        if len(images) < 2:
            shutil.rmtree(temp_dir, ignore_errors=True)
            os.remove(zip_path)
            return jsonify({'error': 'Need at least 2 images to stitch'}), 400
        
        # Generate output paths
        output_id = os.path.basename(zip_path).replace('.zip', '')
        output_path = os.path.join(OUTPUT_FOLDER, f"{output_id}_panorama.jpg")
        debug_path = os.path.join(OUTPUT_FOLDER, f"{output_id}_debug.jpg")
        
        # Stitch images
        success, debug_img, message = stitch_images_sift(images, output_path, debug_path)
        
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)
        os.remove(zip_path)
        
        if not success:
            return jsonify({'error': message}), 500
        
        # Return success with paths
        debug_exists = os.path.exists(debug_path) if debug_path else False
        return jsonify({
            'success': True,
            'message': message,
            'panorama_url': f'/output/{output_id}_panorama.jpg',
            'debug_url': f'/output/{output_id}_debug.jpg' if debug_exists else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/output/<filename>', methods=['GET'])
def get_output(filename):
    """Serve output images."""
    file_path = os.path.join(OUTPUT_FOLDER, filename)
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='image/jpeg')
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=True, host='0.0.0.0', port=port)

