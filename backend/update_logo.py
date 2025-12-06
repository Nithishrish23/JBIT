from app import app, db, Setting



def update_logo():
    with app.app_context():
        # Check if setting exists
        logo_setting = Setting.query.filter_by(key='site_logo').first()
        new_logo_url = '/api/static/images/JB_mart.svg'
        
        if logo_setting:
            logo_setting.value = new_logo_url
            print(f"Updated site_logo to {new_logo_url}")
        else:
            logo_setting = Setting(key='site_logo', value=new_logo_url)
            db.session.add(logo_setting)
            print(f"Created site_logo with value {new_logo_url}")
        
        db.session.commit()

if __name__ == "__main__":
    update_logo()
