from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Notification
from extensions import db

notification_bp = Blueprint('notification', __name__)

@notification_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    # Order by newest first
    notifs = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notifs])

@notification_bp.route('/<int:id>/read', methods=['PUT'])
@jwt_required()
def mark_read(id):
    user_id = get_jwt_identity()
    notif = Notification.query.filter_by(id=id, user_id=user_id).first_or_404()
    notif.is_read = True
    db.session.commit()
    return jsonify(notif.to_dict())
