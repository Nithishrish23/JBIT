from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from ai_service import generate_product_suggestions, configure_genai_client
import json
from PIL import Image
import io

ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/generate-from-image', methods=['POST'])
@jwt_required()
def generate_from_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    image = request.files['image']
    image_data = image.read()
    
    client = configure_genai_client()
    if not client:
        return jsonify({"error": "AI service not configured"}), 500

    try:
        pil_image = Image.open(io.BytesIO(image_data))
        prompt = "Analyze this product image. Provide a JSON response with: 'title', 'description', and 'category_hint'."
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, pil_image]
        )
        text_response = response.text.strip()
        if text_response.startswith("```json"): text_response = text_response[7:-3]
        return jsonify(json.loads(text_response))
    except Exception as e:
        current_app.logger.error(f"AI Error: {e}")
        return jsonify({"error": "Failed"}), 500

@ai_bp.route('/suggest-product', methods=['POST'])
@jwt_required()
def suggest_product():
    data = request.json or {}
    text = data.get('input')
    if not text: return jsonify({"error": "Input required"}), 400
    result = generate_product_suggestions(text)
    if "error" in result: return jsonify(result), 500
    return jsonify(result)
