from google import genai
import json
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the client globally or pass it.
_genai_client = None

def configure_genai_client():
    """
    Configures and returns the Gemini API client.
    """
    global _genai_client
    if _genai_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not found in environment variables. AI features will not work.")
            return None
        try:
            _genai_client = genai.Client(api_key=api_key)
        except Exception as e:
            logger.error(f"Error initializing Gemini client: {e}")
            return None
    return _genai_client

def generate_product_suggestions(keyword_or_description):
    """
    Generates a product title, description, and tags based on a keyword or rough description.
    """
    client = configure_genai_client()
    if not client:
        return {"error": "AI service not configured"}

    prompt_content = f"""
    You are an expert E-commerce assistant. 
    Based on the following input: "{keyword_or_description}", 
    generate a catchy product title, a compelling SEO-friendly description, and 5 relevant tags.
    
    Return the response strictly as a valid JSON object with the keys: 'title', 'description', 'tags'.
    Do not include any markdown formatting or code blocks, just the raw JSON string.
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash", 
            contents=prompt_content
        )
        # Clean up potential markdown code blocks if Gemini adds them
        text_response = response.text.strip()
        if text_response.startswith("```json"):
            text_response = text_response[7:]
        if text_response.endswith("```"):
            text_response = text_response[:-3]
        
        text_response = text_response.strip()
            
        return json.loads(text_response)
    except Exception as e:
        logger.error(f"Error generating product suggestions: {e}")
        return {"error": "Failed to generate suggestions"}
