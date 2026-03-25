<p align="center">
  <img src="https://img.shields.io/badge/Status-Active_Development-green" alt="status" />
</p>

<h1 align="center">Aether Eye</h1>

<p align="center">
  <strong>Hybrid-Edge Multi-Modal IoT Surveillance System</strong>
</p>

<p align="center">
  <img src="https://github.com/AryanSingh64/Aether-Eye/blob/main/look.jpg" alt="Aether Eye hero" width="500" />
</p>

---

## ✨ What is Aether Eye

Aether Eye is a next-generation hybrid-edge surveillance system built to cut latency and protect privacy. It splits sensing and inference across tiny edge devices and an on-premise server, delivering real-time, context-aware alerts for visual, audio, and environmental threats without sending sensitive data to the cloud.

## 🚀 Key Features

* **Hybrid-Edge Architecture** - lightweight ESP32 sensors for data capture, powerful local server for AI processing.
* **Multi-Modal Fusion** - combines Visual, Audio, and Environmental signals for richer alerts.
* **Real-Time Alerts** - push notifications via a bi-directional WebSocket backbone.
* **Offline Voice Control** - local speech commands that work without internet.
* **Dual-Purpose AI** - single YOLO model for urgent threats (knives, fire) and safety compliance (helmets).

## 🧩 Quick Demo

* Video stream with YOLO bounding boxes in app
* Voice command flow: "System Status" triggers TTS reply
* Environmental trigger: MQ-2 sensor raises Fire/Smoke alert

## 🛠 Hardware Architecture

Aether Eye uses a split microcontroller design to overcome GPIO limits and keep roles clear.

| Component      | Role                                 | Specs                     |
| -------------- | ------------------------------------ | ------------------------- |
| ESP32-CAM      | Visual sensor - video streaming      | OV2640 camera, WiFi       |
| ESP32-WROOM    | Sensor hub - audio, MQ-2, comms      | Dual-core 240MHz, WiFi/BT |
| I2S Microphone | Audio input                          | INMP441 / MSM261S4030H0   |
| MAX98357A      | Audio output - TTS speaker           | 3W Class-D amp            |
| MQ-2 Sensor    | Env sensor - smoke, LPG, methane, CO | Analog/Digital output     |

## 💻 Tech Stack

**Backend**

* Framework: FastAPI (async Python)
* Object detection: Ultralytics YOLO (custom weights)
* Face recognition: dlib + face_recognition (pickle embeddings)
* Speech recognition: Vosk (offline STT)
* Audio utils: pydub, pyttsx3 or Edge-TTS
* Communication: WebSockets (Starlette)

**Mobile**

* React Native (Expo recommended)
* WebSocket client for realtime alerts

**Firmware**

* Arduino IDE (C++)
* esp_camera, driver/i2s, WiFi, ArduinoWebsockets

## 📥 Download Models

Place the custom model files into `backend/models/` after extracting.

[Download models (Google Drive)](https://drive.google.com/file/d/1bwsLlvbblcr_xil-wx2oVdKg4sHrJhDt/view?usp=drive_link)

Make sure `best.pt` and `encodings.pickle` are present in `backend/models/`.

## ⚙️ Installation & Setup

Open a terminal and follow these steps.

### 1) Clone the repo

```bash
git clone https://github.com/your-username/aether-eye.git
cd aether-eye
```

### 2) Backend - the Brain

Prereqs: Python 3.9+, (GPU optional but recommended). Example for Linux / macOS:

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Ensure ffmpeg and portaudio are installed on Linux/Mac for audio
# sudo apt-get install ffmpeg portaudio19-dev
```

Place model files into `backend/models/` and confirm `best.pt` and `encodings.pickle` exist.

### 3) Firmware - the Edge

Prereqs: Arduino IDE with ESP32 support installed.

**ESP32-CAM** (visual streamer)

* Open `firmware/esp32_cam_stream/esp32_cam_stream.ino`
* Edit `ssid` and `password` variables
* Select board: AI Thinker ESP32-CAM
* Flash and note IP from Serial Monitor

**ESP32-WROOM** (sensor hub)

* Open `firmware/esp32_wroom_hub/esp32_wroom_hub.ino`
* Edit `ssid`, `password`, and `server_ip`
* Select board: DOIT ESP32 DEVKIT V1
* Flash and reboot

### 4) Mobile app - the Interface

Prereqs: Node.js, npm, Expo Go on phone

```bash
cd mobile-app
npm install
npx expo start
```

Scan the QR code with Expo Go to launch the app on your phone.

## ▶️ How to Run

Start the backend server and make sure all devices are on the same WiFi network.

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Power the ESP32 modules. The camera streams, the sensor hub connects to the WebSocket server, and the mobile app will show live alerts.

## 📂 Project Structure

```
aether-eye/
├── backend/
│   ├── main.py            # FastAPI entrypoint and WebSocket manager
│   ├── models/            # YOLO weights, face encodings, Vosk model
│   ├── routers/           # API routes (video, audio, sensors)
│   └── services/          # YOLO, face rec, speech services
├── firmware/
│   ├── esp32_cam_stream/
│   └── esp32_wroom_hub/
└── mobile-app/
    ├── src/
    └── App.js
```

## 🔒 Privacy & Safety

* No data leaves the local network unless you add that behavior.
* Face embeddings are stored locally as pickle files. Protect `backend/models/encodings.pickle` like any sensitive file.

## 🧪 Testing Tips

* Use a second phone to confirm video stream rendering in the app.
* For MQ-2 triggers, use a controlled test source like a lighter flame at a safe distance to observe alerts.
* Disable internet on one test device to verify offline voice commands still work.

## 🤝 Contributing

Thanks for your interest in contributing. Quick workflow:

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/AmazingFeature`
3. Commit: `git commit -m "Add AmazingFeature"`
4. Push: `git push origin feature/AmazingFeature`
5. Open a Pull Request and describe your changes

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

## 👥 Contributors

| Name | GitHub |
| ---- | ------ |
| Aryan Pratap Singh | [@AryanSingh64](https://github.com/AryanSingh64) |
| Karan Pratap Singh | [@KaranPratapSingh](https://github.com/KaranPratapSingh) |
| Aryan Kumar | [@AryanKumar](https://github.com/AryanKumar) |
| Aman Gupta | [@AmanGupta](https://github.com/AmanGupta) |

## 📞 Contact

Feel free to reach out to any of the contributors:

**Aryan Pratap Singh** — GitHub: [AryanSingh64](https://github.com/AryanSingh64)
<br>
**Karan Pratap Singh** — GitHub: [KaranPratapSingh](https://github.com/SypherKx)
<br>
**Aryan Kumar** — GitHub: [AryanKumar](https://github.com/aryankumarx)
<br>
**Aman Gupta** — GitHub: [AmanGupta](https://github.com/AmanGupta)

---

> Built with passion by Aryan Pratap Singh, Karan Pratap Singh, Aryan Kumar & Aman Gupta — focused on privacy and real-time safety.
