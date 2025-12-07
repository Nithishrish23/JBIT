import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

# -----------------------------
# ID getters
# -----------------------------

def get_windows_cpu_id():
    if sys.platform != "win32":
        return None
    try:
        output = subprocess.check_output(
            "wmic cpu get processorid",
            shell=True,
            stderr=subprocess.DEVNULL
        ).decode().strip().splitlines()

        for line in output:
            line = line.strip()
            if line and "ProcessorId" not in line:
                return line.upper()
    except:
        return None


def get_linux_cpu_id():
    if not sys.platform.startswith("linux"):
        return None
    try:
        out = subprocess.check_output(
            "dmidecode -t processor | grep ID",
            shell=True,
            stderr=subprocess.DEVNULL
        ).decode().strip()

        first = out.splitlines()[0]
        cpu_id = first.split(":", 1)[1].replace(" ", "").strip().upper()

        if cpu_id == "0000000000000000":
            return None
        return cpu_id
    except:
        return None


def get_linux_machine_id():
    if not sys.platform.startswith("linux"):
        return None
    try:
        with open("/etc/machine-id") as f:
            return f.read().strip()
    except:
        return None


# -----------------------------
# Security validation
# -----------------------------

def validate_system():
    allowed_cpu_id = os.getenv("ALLOWED_CPU_ID")
    allowed_machine_id = os.getenv("ALLOWED_MACHINE_ID")

    system_id = None
    id_type = None

    if sys.platform == "win32":
        system_id = get_windows_cpu_id()
        id_type = "CPU ID (Windows)"
    else:
        cpu_id = get_linux_cpu_id()
        if cpu_id:
            system_id = cpu_id
            id_type = "CPU ID (Linux)"
        else:
            system_id = get_linux_machine_id()
            id_type = "Machine ID (Linux)"

    if not system_id:
        print("❌ SECURITY ERROR: Unable to detect system ID")
        raise SystemExit("❌ Unauthorized system")

    # ✅ Always print detected ID (requested)
    print(f"🔎 Detected {id_type}: {system_id}")

    # ---------- VALIDATION ----------
    if allowed_cpu_id:
        if system_id != allowed_cpu_id:
            print("❌ CPU ID mismatch")
            raise SystemExit("❌ Unauthorized system")

    elif allowed_machine_id:
        if system_id != allowed_machine_id:
            print("❌ Machine ID mismatch")
            raise SystemExit("❌ Unauthorized system")

    else:
        print("❌ No system lock configured")
        raise SystemExit("❌ Unauthorized system")

    print(f"✅ System authorized using {id_type}")
    return True


# Allow manual testing
if __name__ == "__main__":
    validate_system()
