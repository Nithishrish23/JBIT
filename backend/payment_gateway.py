import razorpay
import stripe
import os
from utils import get_setting

razorpay_client = None
stripe_api_key = None

def init_payment_clients():
    global razorpay_client, stripe_api_key
    
    # Load from Env
    rp_id = os.getenv("RAZORPAY_KEY_ID")
    rp_secret = os.getenv("RAZORPAY_KEY_SECRET")
    stripe_key = os.getenv("STRIPE_SECRET_KEY")

    # Override from DB Settings if available
    try:
        rp_id = get_setting('razorpay_key_id', rp_id)
        rp_secret = get_setting('razorpay_key_secret', rp_secret)
        stripe_key = get_setting('stripe_secret_key', stripe_key)
    except: pass

    if rp_id and rp_secret:
        try:
            razorpay_client = razorpay.Client(auth=(rp_id, rp_secret))
        except:
            razorpay_client = None
    
    if stripe_key:
        stripe.api_key = stripe_key
        stripe_api_key = stripe_key

def get_razorpay_client():
    if not razorpay_client:
        init_payment_clients()
    return razorpay_client

def get_stripe_client():
    if not stripe_api_key:
        init_payment_clients()
    return stripe
