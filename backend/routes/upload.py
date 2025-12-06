from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import File
from werkzeug.utils import secure_filename
from uuid import uuid4
import os
from flask import current_app

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('', methods=['POST'])
@jwt_required()
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        filename = secure_filename(file.filename)
        unique_name = f"{uuid4().hex}_{filename}"
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
        file.save(save_path)
        size = os.path.getsize(save_path)
        
        file_record = File(
            owner_id=get_jwt_identity(),
            filename=filename,
            stored_filename=unique_name,
            filepath=save_path,
            size=size,
            status='active'
        )
        db.session.add(file_record)
        db.session.commit()
        
        return jsonify({
            "message": "File uploaded successfully",
            "id": file_record.id,
            "url": f"/api/files/{file_record.id}/download"
        }), 201
