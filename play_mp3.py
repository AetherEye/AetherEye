import socket
import time
import os
import io
import struct
import math
from pydub import AudioSegment

# --- CONFIG ---
SPK_PORT = 5555             
ESP32_IP = "10.116.61.196" # Replace with your WROOM IP if it changes
CHUNK_SIZE = 1024 # ESP32 UDP buffer size
TARGET_SAMPLE_RATE = 32000 # Must match Wroom.ino i2s_config_t
TARGET_VOLUME_PERCENT = 10 # Volume from 0 to 100%

def play_mp3(file_path):
    if not os.path.exists(file_path):
        print(f"❌ Error: File '{file_path}' not found!")
        return

    print(f"🎵 Loading and Decoding MP3: {file_path}")
    print("⏳ This may take a few seconds...")
    
    # 1. Load the MP3 and convert it to match the ESP32's exact hardware format
    # The ESP32 I2S is currently configured for:
    # 16kHz, 16-bit, Stereo (I2S_CHANNEL_FMT_RIGHT_LEFT) for high stability
    audio = AudioSegment.from_file(file_path)
    audio = audio.set_frame_rate(TARGET_SAMPLE_RATE)
    audio = audio.set_sample_width(2) # 16-bit
    audio = audio.set_channels(2)     # Stereo! Highly required for ESP32 I2S DMA Alignment

    # --- APPLY VOLUME ---
    print(f"🔈 Adjusting Volume to {TARGET_VOLUME_PERCENT}% ...")
    if TARGET_VOLUME_PERCENT <= 0:
        audio = audio - 100 # Completely mute (-100 dB)
    elif TARGET_VOLUME_PERCENT < 100:
        # Human ears hear logarithmically, not linearly!
        # Normal 10% voltage drop still sounds incredibly loud (only -20dB).
        # By cubing the ratio, 10% maps to an aggressive -60dB which sounds beautifully quiet.
        ratio = (TARGET_VOLUME_PERCENT / 100.0) ** 3 
        db_drop = 20 * math.log10(ratio)
        audio = audio + db_drop 
        print(f"🔈 Applied Acoustic Gain: {db_drop:.1f} dB")
        
    # Convert the decoded audio directly into a raw bytearray for network transport
    raw_bytes = audio.raw_data
    total_bytes = len(raw_bytes)
    duration_sec = total_bytes / (TARGET_SAMPLE_RATE * 4) # 4 bytes per stereo sample
    
    print(f"✅ Decoding Complete!")
    print(f"⏱️ Audio Duration: {duration_sec:.2f} seconds")
    print(f"📦 Total Bytes: {total_bytes}")
    
    # 2. Setup UDP Socket
    spk_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    # Calculate exact python wait time needed to simulate real-time playback for 1 chunk
    # Since we are sending 16-bit stereo, 1024 bytes = 256 samples
    packet_delay_sec = (CHUNK_SIZE / 4) / TARGET_SAMPLE_RATE

    print(f"🚀 Streaming Audio to {ESP32_IP}:{SPK_PORT} ...")
    
    try:
        # We start the song at num_chunk = 15 to pre-fill the ESP32's internal I2S DMA 
        # buffer completely without delay! This completely absorbs Wi-Fi router jitter!
        prefill_chunks = 15
        start_time = time.perf_counter()

        for num_chunk, offset in enumerate(range(0, total_bytes, CHUNK_SIZE)):
            chunk = raw_bytes[offset : offset+CHUNK_SIZE]
            
            # Send the chunk of audio to the ESP32 UDP port
            spk_socket.sendto(chunk, (ESP32_IP, SPK_PORT))
            
            if num_chunk < prefill_chunks:
                # Pre-fill the ESP32 memory buffers rapidly
                start_time = time.perf_counter() 
                continue
            
            # Target exact absolute time across the ENTIRE audio file
            target_time = start_time + ((num_chunk - prefill_chunks) * packet_delay_sec)
            
            # Spin precisely until that microsecond arrives to pace the audio perfectly
            while time.perf_counter() < target_time:
                pass
                
            # Print a progress bar occasionally
            if num_chunk % 500 == 0:
                progress = (offset / total_bytes) * 100
                print(f"Streaming... {progress:.1f}%")

    except KeyboardInterrupt:
        print("\n🛑 Playback stopped by user.")
    finally:
        spk_socket.close()

    print("🎉 Playback Complete!")

if __name__ == "__main__":
    print("=== AetherEye WROOM MP3 Streamer ===")
    
    # Provide the path to the MP3 file you want to play
    # custom_song = "1.mp3"
    custom_song = "WishYouWereHere.mp3"
    
    # Optional: We create a dummy mp3 if none exists so you can test it immediately
    if not os.path.exists(custom_song):
        print("⚠️ No 'song.mp3' found! Creating a quick 3-second test tone named 'song.mp3' instead...")
        # create a quick 3-second beep and save it as an MP3 using pydub
        from pydub.generators import Sine
        test_tone = Sine(440).to_audio_segment(duration=3000)
        test_tone.export(custom_song, format="mp3")
        
    play_mp3(custom_song)
