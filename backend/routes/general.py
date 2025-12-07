from flask import Blueprint, send_from_directory, current_app, request, abort, jsonify
from models import File, Product, Category, Advertisement, Setting
from extensions import db
from utils import get_setting
from datetime import datetime
import os

general_bp = Blueprint('general', __name__)

@general_bp.route('/static/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(os.path.join(current_app.instance_path, '..', 'images'), filename)

@general_bp.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)

@general_bp.route('/files/<int:file_id>/download')
def download_file(file_id):
    file = File.query.get_or_404(file_id)
    if os.path.exists(file.filepath):
        return send_from_directory(os.path.dirname(file.filepath), os.path.basename(file.filepath))
    abort(404)

@general_bp.route('/sitemap.xml')
def sitemap():
    base_url = request.url_root.rstrip('/')
    pages = ['/', '/products', '/login']
    xml = '<?xml version="1.0" encoding="UTF-8"?><urlset>'
    for p in pages: xml += f'<url><loc>{base_url}{p}</loc></url>'
    xml += '</urlset>'
    return current_app.response_class(xml, mimetype='application/xml')

@general_bp.route('/categories', methods=['GET'])
def list_categories():
    cats = Category.query.all()
    return jsonify([c.to_dict() for c in cats])

@general_bp.route('/categories/slug/<slug>', methods=['GET'])
def get_category_by_slug(slug):
    category = Category.query.filter_by(slug=slug).first_or_404()
    return jsonify(category.to_dict())

@general_bp.route('/ads', methods=['GET'])
def get_ads():
    position = request.args.get('position', 'home_banner')
    now = datetime.utcnow()
    query = Advertisement.query.filter_by(is_active=True, position=position)
    query = query.filter(
        db.or_(Advertisement.start_date.is_(None), Advertisement.start_date <= now),
        db.or_(Advertisement.end_date.is_(None), Advertisement.end_date >= now)
    )
    ads = query.order_by(Advertisement.priority.desc()).all()
    for ad in ads:
        ad.views = (ad.views or 0) + 1
    if ads:
        db.session.commit()
    return jsonify([a.to_dict() for a in ads])

@general_bp.route('/ads/<int:ad_id>/click', methods=['POST'])
def click_ad(ad_id):
    ad = Advertisement.query.get_or_404(ad_id)
    ad.clicks = (ad.clicks or 0) + 1
    db.session.commit()
    return jsonify(message="Click recorded", clicks=ad.clicks)

@general_bp.route('/settings/public', methods=['GET'])
def public_settings():
    return jsonify({
        "site_title": get_setting('site_title', 'Tanjore Heritage Arts'),
        "items_per_page": int(get_setting('items_per_page', 12)),
        "category_grid_columns": int(get_setting('category_grid_columns', 4)),
        "site_logo": get_setting('site_logo'),
        "home_banner_image": get_setting('home_banner_image'),
        "home_banner_video": get_setting('home_banner_video'),
        "home_banner_heading": get_setting('home_banner_heading', 'Electronics & More'),
        "home_banner_subheading": get_setting('home_banner_subheading', 'Discover a world of authentic products.'),
        
        "theme_brand_primary": get_setting('theme_brand_primary', '#9c7373'),
        "theme_brand_secondary": get_setting('theme_brand_secondary', '#9c7373'),
        "theme_brand_accent": get_setting('theme_brand_accent', '#9c7373'),
        "theme_brand_background": get_setting('theme_brand_background', '#f5e9d1'),
        "theme_layout_background": get_setting('theme_layout_background', '#fefcfb'),
        "theme_layout_card": get_setting('theme_layout_card', '#ffffff'),
        "theme_layout_sidebar": get_setting('theme_layout_sidebar', '#ffffff'),
        "theme_layout_footer": get_setting('theme_layout_footer', '#f5e9d1'),
        "theme_text_primary": get_setting('theme_text_primary', '#000000'),
        "theme_text_secondary": get_setting('theme_text_secondary', '#0d0d0c'),
        "theme_text_muted": get_setting('theme_text_muted', '#0a0a0a'),
        "theme_text_inverse": get_setting('theme_text_inverse', '#272420'),
        "theme_status_success": get_setting('theme_status_success', '#15e53f'),
        "theme_status_warning": get_setting('theme_status_warning', '#ddeb24'),
        "theme_status_error": get_setting('theme_status_error', '#DC2626'),
        "theme_status_info": get_setting('theme_status_info', '#3B82F6'),
    })