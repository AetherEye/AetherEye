import requests
import socket
import time
import state
from config import Config


def control_light_hw(turn_on):
    url = Config.LIGHT_ON_URL if turn_on else Config.LIGHT_OFF_URL
    print(f"🔌 Sending request to ESP32-CAM: {url}")
    try:
        requests.get(url, timeout=2)
        return True
    except requests.ConnectionError:
        print("❌ Light Error: Cannot reach ESP32-CAM (connection refused)")
        return False
    except requests.Timeout:
        print("❌ Light Error: ESP32-CAM request timed out")
        return False
    except Exception as e:
        print(f"❌ Light Error: {e}")
        return False


def udp_smoke_loop():
    # Lazy import to prevent circular dependency
    from core.audio import speak

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind(("0.0.0.0", Config.SMOKE_UDP_PORT))
        print(f"👃 Smoke Listener on {Config.SMOKE_UDP_PORT}")
    except OSError as e:
        print(f"❌ Smoke listener failed to bind: {e}")
        return

    while True:
        try:
            data, _ = sock.recvfrom(1024)
            smoke_value = int(data.decode('utf-8').strip())

            current_time = time.time()
            if current_time - state.last_smoke_alert_time > Config.SMOKE_ALERT_COOLDOWN:
                if smoke_value > Config.SMOKE_DANGER_THRESHOLD:
                    print(f"🚨 HEAVY SMOKE: {smoke_value}")
                    speak("Emergency! Heavy smoke!")
                    state.last_smoke_alert_time = current_time
                elif smoke_value > Config.SMOKE_WARN_THRESHOLD:
                    print(f"⚠️ Light Smoke: {smoke_value}")
                    speak("Caution. Light smoke.")
                    state.last_smoke_alert_time = current_time
        except ValueError:
            print("⚠️ Smoke sensor sent invalid data")
        except Exception as e:
            print(f"❌ Smoke loop error: {e}")
            time.sleep(1)