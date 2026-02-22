import socket
import struct
import threading
import time
import math
import winsound

# --- CONFIG ---
LISTEN_IP = "0.0.0.0"       # Listen on all interfaces
MIC_PORT = 4444             # Match MIC_UDP_PORT in Arduino
SMOKE_PORT = 6666           # Match SMOKE_UDP_PORT in Arduino
SPK_PORT = 5555             # Port to send speaker data TO the ESP32

print("=== AetherEye WROOM Tester ===")
print(f"Listening for Microphone data on UDP port {MIC_PORT}...")
print(f"Listening for Smoke Sensor data on UDP port {SMOKE_PORT}...")
print(f"Will send Speaker beep tests to UDP port {SPK_PORT}...")

# Set up UDP Sockets
mic_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
mic_socket.bind((LISTEN_IP, MIC_PORT))
mic_socket.settimeout(1.0)

smoke_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
smoke_socket.bind((LISTEN_IP, SMOKE_PORT))
smoke_socket.settimeout(1.0)

# We will grab the ESP32 IP automatically when we receive data
esp32_ip = None

def listen_mic():
    global esp32_ip
    print("🎤 Mic thread started.")
    packet_count = 0
    
    while True:
        try:
            data, addr = mic_socket.recvfrom(2048) # Buffer size
            packet_count += 1
            if esp32_ip is None:
                esp32_ip = addr[0]
                print(f"🔗 Detected WROOM IP: {esp32_ip}")
            
            # Print a status update every 50 packets so we don't spam the console
            if packet_count % 50 == 0:
                print(f"[MIC] Received {packet_count} packets from {addr[0]}... (Data size: {len(data)} bytes)")
                
        except socket.timeout:
            pass
        except Exception as e:
            print(f"Mic error: {e}")

def listen_smoke():
    global esp32_ip
    print("🔥 Smoke thread started.")
    while True:
        try:
            data, addr = smoke_socket.recvfrom(1024)
            if esp32_ip is None:
                esp32_ip = addr[0]
                print(f"🔗 Detected WROOM IP: {esp32_ip}")
                
            # The Arduino sends the smoke value as a string (e.g., "1452")
            smoke_val = data.decode('utf-8').strip()
            print(f"[SMOKE] Reading from {addr[0]}: {smoke_val}")
        except socket.timeout:
            pass
        except Exception as e:
            print(f"Smoke error: {e}")

def test_speaker():
    import math
    print("🔊 Speaker test thread started.")
    spk_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    # Let's synthesize the Mario Theme song! (Frequency in Hz, Duration in seconds)
    mario_theme = [
        (659.25, 0.15), (0, 0.15),      # E5
        (659.25, 0.15), (0, 0.15),      # E5
        (659.25, 0.15), (0, 0.15),      # E5
        (523.25, 0.15), (0, 0.05),      # C5
        (659.25, 0.15), (0, 0.15),      # E5
        (783.99, 0.30), (0, 0.30),      # G5
        (392.00, 0.30), (0, 0.30),      # G4 
    ]
    
    # ----------------------------------------------------
    # PLAY LOCALLY ON PC ONCE FOR REFERENCE
    # ----------------------------------------------------
    print("💻 Playing Mario Theme on your PC locally for reference...")
    for freq, duration in mario_theme:
        if freq == 0:
            time.sleep(duration)
        else:
            winsound.Beep(int(freq), int(duration * 1000))

    
    # Wait until we know the ESP32's IP address (from mic or smoke sensors)
    while esp32_ip is None:
        time.sleep(1)
        
    print(f"🔊 WROOM IP discovered ({esp32_ip}) - Starting audio stream!")
    
    # Audio config matching Wroom.ino
    sample_rate = 42000
    chunk_size = 1024 # ESP32 buffer size
    volume = 12000 # Max is 32767
    
    print(f"🎵 Synthesizing 32kHz Mario Theme song buffers with Anti-Pop Envelopes...")
    
    wave_buffer = bytearray()
    
    # We must track the phase continuously across notes, and fade-in/fade-out each note
    # to prevent harsh Speaker "Pops" and "Cracks" from instantaneous voltage jumps!
    phase = 0.0
    attack_samples = int(sample_rate * 0.015)  # 15ms fade in
    release_samples = int(sample_rate * 0.015) # 15ms fade out
    
    for freq, duration in mario_theme:
        total_samples = int(sample_rate * duration)
        
        for i in range(total_samples):
            if freq == 0:
                val = 0 # Silence
            else:
                # Calculate Anti-Pop Envelope (Fade in and Fade out)
                env = 1.0
                if i < attack_samples:
                    env = i / attack_samples
                elif i > (total_samples - release_samples):
                    env = (total_samples - i) / release_samples
                
                # Generate pristine 16-bit sine wave for the specific note with phase and envelope
                val = int(math.sin(phase) * volume * env)
                phase += 2 * math.pi * freq / sample_rate
                
            # Pack as 32-bit (16-bit L, 16-bit R) to keep the ESP32 DMA I2S clock happy
            wave_buffer.extend(struct.pack('<hh', val, val)) 
            
    # Calculate exact python wait time needed to simulate real-time playback for 1 chunk
    # Since we are sending 16-bit stereo, 1024 bytes = 256 stereo samples (512 16-bit values).
    packet_delay_sec = (chunk_size / 4) / sample_rate

    while True:
        print(f"🎵 [SPK] Playing Mario Theme Song to {esp32_ip}:{SPK_PORT} ...")
        
        # Absolute exact timing pacing: This completely removes the "Cracking"
        # voice issues caused by relative time drift starving the ESP32 DMA buffer!
        start_time = time.perf_counter()
        
        for num_chunk, offset in enumerate(range(0, len(wave_buffer), chunk_size)):
            chunk = wave_buffer[offset : offset+chunk_size]
            spk_socket.sendto(chunk, (esp32_ip, SPK_PORT))
            
            # Target exact absolute time across the ENTIRE audio file
            target_time = start_time + ((num_chunk + 1) * packet_delay_sec)
            
            # Spin precisely until that microsecond arrives
            while time.perf_counter() < target_time:
                pass
            
        time.sleep(3) # Wait 3 seconds before re-playing the song

# Start background threads to listen to both ports simultaneously and test speaker
threading.Thread(target=listen_mic, daemon=True).start()
threading.Thread(target=listen_smoke, daemon=True).start()
threading.Thread(target=test_speaker, daemon=True).start()

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nExiting tester.")
