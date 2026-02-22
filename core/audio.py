import os
import time
import json
import socket
import threading
import asyncio
import tempfile
import edge_tts
import pyttsx3
from vosk import KaldiRecognizer
from fuzzywuzzy import process, fuzz
from pydub import AudioSegment
from pydub.scipy_effects import low_pass_filter, high_pass_filter
from pydub.effects import normalize

from config import Config
import state
from core.ai import vosk_model
from core.hardware import control_light_hw


def stream_to_esp32(filename):
    try:
        audio = AudioSegment.from_file(filename)
        audio = normalize(audio)
        audio = low_pass_filter(audio, 3500)
        audio = high_pass_filter(audio, 150)
        audio = normalize(audio)
        audio = audio + Config.MASTER_VOLUME_DB

        raw_data = audio.set_frame_rate(Config.SPK_SAMPLE_RATE).set_channels(1).set_sample_width(2).raw_data
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        bytes_per_second = Config.SPK_SAMPLE_RATE * 2
        chunk_play_duration = Config.SPK_CHUNK_SIZE / bytes_per_second
        sleep_time = max(0.005, chunk_play_duration * 0.8)

        for i in range(0, len(raw_data), Config.SPK_CHUNK_SIZE):
            if not Config.ESP32_WROOM_IP:
                break
            sock.sendto(raw_data[i:i + Config.SPK_CHUNK_SIZE], (Config.ESP32_WROOM_IP, Config.SPK_UDP_PORT))
            time.sleep(sleep_time)
        sock.close()
    except Exception as e:
        print(f"❌ Stream Error: {e}")


def speak(text):
    if not text.strip():
        return
    print(f"🤖 Speaking: {text}")

    def _speak_thread():
        with state.speaking_lock:
            state.is_speaking = True

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        temp_file.close()
        try:
            asyncio.run(edge_tts.Communicate(text, Config.EDGE_VOICE, rate="+10%").save(temp_file.name))
            stream_to_esp32(temp_file.name)
        except Exception as e:
            print(f"⚠️ Edge TTS failed, falling back to pyttsx3: {e}")
            try:
                engine = pyttsx3.init()
                wav_path = temp_file.name + ".wav"
                engine.save_to_file(text, wav_path)
                engine.runAndWait()
                stream_to_esp32(wav_path)
                os.remove(wav_path)
            except Exception as e2:
                print(f"❌ pyttsx3 fallback also failed: {e2}")
        finally:
            try:
                os.remove(temp_file.name)
            except OSError:
                pass
            time.sleep(0.5)
            with state.speaking_lock:
                state.is_speaking = False

    threading.Thread(target=_speak_thread, daemon=True).start()


def handle_voice(text):
    # Lazy import to avoid circular dependency
    from core.vision import scan_logic

    if not text:
        return
    try:
        scan_score = process.extractOne(text, Config.SCAN_TRIGGERS, scorer=fuzz.token_set_ratio)[1]
        light_on_score = process.extractOne(text, Config.LIGHT_ON_TRIGGERS, scorer=fuzz.token_set_ratio)[1]
        light_off_score = process.extractOne(text, Config.LIGHT_OFF_TRIGGERS, scorer=fuzz.token_set_ratio)[1]
        scores = {"scan": scan_score, "on": light_on_score, "off": light_off_score}
        best_match = max(scores, key=scores.get)

        if scores[best_match] > 65:
            print(f"🧠 Intent: {best_match} (Score: {scores[best_match]})")
            if best_match == "scan":
                threading.Thread(target=scan_logic, kwargs={'is_auto': False}, daemon=True).start()
            elif best_match == "on":
                control_light_hw(True)
                speak("Light on.")
            elif best_match == "off":
                control_light_hw(False)
                speak("Light off.")
    except Exception as e:
        print(f"❌ Error in handle_voice: {e}")


def udp_mic_loop():
    if not vosk_model:
        return
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", Config.MIC_UDP_PORT))
    recognizer = KaldiRecognizer(vosk_model, 16000)
    print(f"👂 Mic Listener on {Config.MIC_UDP_PORT}")

    while True:
        try:
            data, _ = sock.recvfrom(4096)
            is_final = recognizer.AcceptWaveform(data)

            is_currently_speaking = False
            with state.speaking_lock:
                is_currently_speaking = state.is_speaking

            if is_final:
                if is_currently_speaking:
                    recognizer.Result()  # Flush buffer
                else:
                    recognized_text = json.loads(recognizer.Result()).get('text', '').strip()
                    if recognized_text:
                        print(f"🗣️ Voice: {recognized_text}")
                        handle_voice(recognized_text)
        except Exception as e:
            print(f"❌ Mic loop error: {e}")
            time.sleep(1)