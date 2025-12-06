
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
import os
import json
from werkzeug.utils import secure_filename
from uuid import uuid4
from ai_service import generate_product_suggestions, _genai_client, configure_genai_client

ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/generate-from-image', methods=['POST'])
@jwt_required()
def generate_from_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
        
    image = request.files['image']
    if image.filename == '':
        return jsonify({"error": "No image selected"}), 400

    # We need to read the image data to send to Gemini
    # Gemini API supports passing image bytes directly or via File API. 
    # For simplicity, let's read bytes.
    image_data = image.read()
    
    client = configure_genai_client()
    if not client:
        return jsonify({"error": "AI service not configured"}), 500

    try:
        from google import genai
        from google.genai import types
        from PIL import Image
        import io

        # Validate image
        try:
            pil_image = Image.open(io.BytesIO(image_data))
        except Exception:
             return jsonify({"error": "Invalid image file"}), 400

        prompt = "Analyze this product image. Provide a JSON response with: 'title' (a short catchy product title), 'description' (a detailed SEO description), and 'category_hint' (a suggested category name)."

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, pil_image]
        )
        
        text_response = response.text.strip()
        # Cleanup markdown
        if text_response.startswith("```json"):
            text_response = text_response[7:]
        if text_response.endswith("```"):
            text_response = text_response[:-3]
            
        return jsonify(json.loads(text_response))

    except Exception as e:
        current_app.logger.error(f"AI Image Gen Error: {e}")
        return jsonify({"error": "Failed to analyze image"}), 500

@ai_bp.route('/generate-from-text', methods=['POST'])
@jwt_required()
def generate_from_text():
    data = request.json or {}
    text = data.get('text')
    if not text:
        return jsonify({"error": "Text input required"}), 400
        
    result = generate_product_suggestions(text)
    if "error" in result:
        return jsonify(result), 500
        
    return jsonify(result)
