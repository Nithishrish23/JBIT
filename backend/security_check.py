import subprocess
import os
import sys
import hashlib

def get_cpu_id():
    """
    Retrieves the CPU ID of the current machine.
    Works for Windows using wmic.
    """
    try:
        if sys.platform == 'win32':
            command = "wmic cpu get processorid"
            output = subprocess.check_output(command, shell=True).decode().strip()
            # Parse output to get just the ID. Output usually looks like:
            # ProcessorId
            # XXXXXXXX
            lines = output.split('\n')
            for line in lines:
                if line.strip() and "ProcessorId" not in line:
                    return line.strip()
        else:
            # Fallback for Linux/Mac (just an example, user specified win32)
            command = "cat /proc/cpuinfo | grep 'Serial'"
            # Implementation would vary
            return "UNKNOWN"
    except Exception as e:
        print(f"Error getting CPU ID: {e}")
        return None

def validate_system():
    """
    Validates that the current machine's CPU ID matches the allowed ID.
    """
    current_cpu_id = get_cpu_id()
    
    if not current_cpu_id:
        print("CRITICAL: Could not determine CPU ID. Startup aborted.")
        return False

    # In a real scenario, this should be a hashed value in an environment variable or secure config
    # For this implementation, we check against an environment variable 'ALLOWED_CPU_ID'
    allowed_cpu_id = os.getenv("ALLOWED_CPU_ID")

    if not allowed_cpu_id:
        print("WARNING: 'ALLOWED_CPU_ID' environment variable is not set.")
        print(f"Current CPU ID is: {current_cpu_id}")
        print("To secure this backend, set ALLOWED_CPU_ID to this value in your .env file.")
        # For safety/demonstration, we might allow it to run if env var is missing, 
        # OR strictly fail. The prompt says "if validate and correct only enter"
        # Strict interpretation: Fail if not validated.
        
        # However, to avoid locking the user out immediately without them knowing their ID:
        # I will allow it ONLY if the env var is missing BUT print the message.
        # IF the env var IS present, it MUST match.
        
        # Re-reading prompt: "if validate and correct only enter a backend else not to run"
        # This implies strictness. 
        # But if I block it now, they can't see the ID to set it. 
        # I will print the ID and exit if not set, guiding them to set it.
        return False

    if current_cpu_id == allowed_cpu_id:
        print("Security Check: CPU ID Validated. Access Granted.")
        return True
    else:
        print("SECURITY ALERT: CPU ID Mismatch!")
        print(f"Expected: {allowed_cpu_id}")
        print(f"Found:    {current_cpu_id}")
        print("Access Denied.")
        return False

get_cpu_id()
validate_system()