from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from ai_service import generate_product_suggestions, configure_genai_client
import json
from PIL import Image
import io
from google.genai.errors import ClientError

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
        
        try:
            # Using gemini-2.0-flash
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[pil_image, prompt]
            )
        except ClientError as e:
            if e.code == 429:
                current_app.logger.warning("Gemini 2.0 Flash rate limited. Retrying with gemini-2.0-flash-lite.")
                response = client.models.generate_content(
                    model="gemini-2.0-flash-lite",
                    contents=[pil_image, prompt]
                )
            else:
                raise e
        
        text_response = response.text.strip()
        # Robust JSON extraction
        if text_response.startswith("```json"): 
            text_response = text_response[7:]
        if text_response.endswith("```"):
            text_response = text_response[:-3]
        text_response = text_response.strip()

        return jsonify(json.loads(text_response))
    except ClientError as e:
        error_msg = str(e)
        status_code = 500
        if e.code == 429:
            status_code = 429
            error_msg = "AI service is currently busy (Rate Limit). Please try again later."
        
        current_app.logger.error(f"AI ClientError generate_from_image: {str(e)}")
        return jsonify({"error": error_msg}), status_code

    except Exception as e:
        import traceback
        current_app.logger.error(f"AI Error generate_from_image: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 500

@ai_bp.route('/generate-from-text', methods=['POST'])
@jwt_required()
def generate_from_text():
    data = request.json or {}
    text = data.get('input') or data.get('description') # Handle 'input' or 'description'
    if not text: return jsonify({"error": "Input text required"}), 400
    
    result = generate_product_suggestions(text)
    
    if "error" in result: 
        return jsonify(result), 500
    return jsonify(result)
