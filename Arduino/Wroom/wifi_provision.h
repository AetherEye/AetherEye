/*
 * wifi_provision.h — WiFi Provisioning via Captive Portal
 * 
 * HOW IT WORKS:
 * 1. On first boot, ESP32 has no saved WiFi credentials.
 * 2. It starts as an Access Point named "AetherEye-Setup".
 * 3. Connect to it from your phone → a setup page opens automatically.
 * 4. Enter your WiFi name, password, and PC server IP.
 * 5. ESP32 saves them to flash (NVS) and reboots.
 * 6. From now on, it auto-connects to your WiFi on every boot.
 * 7. If connection fails (wrong password, new network), it falls back to AP setup mode.
 *
 * TO RESET: Call clearSavedCredentials() or hold GPIO0 (BOOT button) during startup.
 */

#ifndef WIFI_PROVISION_H
#define WIFI_PROVISION_H

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

// --- Settings ---
#define AP_NAME        "AetherEye-Setup"
#define AP_PASSWORD    ""                // Open network (no password for easy setup)
#define WIFI_TIMEOUT   15               // Seconds to wait for WiFi connection
#define RESET_PIN      0                // GPIO0 = BOOT button on most ESP32 boards

// --- Globals ---
Preferences prefs;
WebServer   setupServer(80);
String      savedSSID     = "";
String      savedPassword = "";
String      savedServerIP = "";

// --- HTML Page for the captive portal ---
const char SETUP_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AetherEye Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e0e0e0;
           display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #1a1a1a; border-radius: 20px; padding: 40px 30px; width: 90%; max-width: 380px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
    h1 { text-align: center; font-size: 24px; margin-bottom: 8px; color: #A8E6CF; }
    p  { text-align: center; font-size: 13px; color: #888; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #aaa; }
    input { width: 100%; padding: 14px; border-radius: 12px; border: 2px solid #333;
            background: #111; color: #fff; font-size: 16px; margin-bottom: 18px; outline: none; }
    input:focus { border-color: #A8E6CF; }
    button { width: 100%; padding: 16px; border-radius: 14px; border: none; cursor: pointer;
             background: #A8E6CF; color: #111; font-size: 16px; font-weight: 800; letter-spacing: 1px; }
    button:active { opacity: 0.8; }
    .footer { text-align: center; font-size: 11px; color: #555; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>&#x1F441; AetherEye</h1>
    <p>Enter your WiFi details to connect this device to your network.</p>
    <form action="/save" method="POST">
      <label>WiFi Name (SSID)</label>
      <input type="text" name="ssid" placeholder="Your WiFi name" required>
      <label>WiFi Password</label>
      <input type="password" name="pass" placeholder="Your WiFi password" required>
      <label>Server IP (your PC)</label>
      <input type="text" name="ip" placeholder="e.g. 192.168.1.5" required>
      <button type="submit">SAVE &amp; CONNECT</button>
    </form>
    <div class="footer">Credentials are saved on-device. No cloud involved.</div>
  </div>
</body>
</html>
)rawliteral";

const char SUCCESS_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AetherEye - Saved</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e0e0e0;
           display: flex; justify-content: center; align-items: center; min-height: 100vh; text-align: center; }
    h1 { color: #A8E6CF; margin-bottom: 10px; }
    p  { color: #888; }
  </style>
</head>
<body>
  <div>
    <h1>&#x2705; Saved!</h1>
    <p>Device is rebooting and connecting to your WiFi.<br>You can close this page.</p>
  </div>
</body>
</html>
)rawliteral";


// --- Load saved credentials from NVS flash ---
bool loadCredentials() {
    prefs.begin("aethereye", true);  // read-only
    savedSSID     = prefs.getString("ssid", "");
    savedPassword = prefs.getString("pass", "");
    savedServerIP = prefs.getString("ip",   "");
    prefs.end();
    return (savedSSID.length() > 0);
}

// --- Save new credentials to NVS flash ---
void saveCredentials(String ssid, String pass, String ip) {
    prefs.begin("aethereye", false);  // read-write
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    prefs.putString("ip",   ip);
    prefs.end();
}

// --- Clear all saved credentials ---
void clearSavedCredentials() {
    prefs.begin("aethereye", false);
    prefs.clear();
    prefs.end();
    Serial.println("🗑️ Credentials cleared!");
}

// --- Web server handlers ---
void handleSetupRoot() {
    setupServer.send(200, "text/html", SETUP_PAGE);
}

void handleSave() {
    String newSSID = setupServer.arg("ssid");
    String newPass = setupServer.arg("pass");
    String newIP   = setupServer.arg("ip");

    if (newSSID.length() > 0 && newPass.length() > 0 && newIP.length() > 0) {
        saveCredentials(newSSID, newPass, newIP);
        setupServer.send(200, "text/html", SUCCESS_PAGE);
        Serial.println("✅ Credentials saved! Rebooting in 2 seconds...");
        delay(2000);
        ESP.restart();
    } else {
        setupServer.send(400, "text/plain", "All fields are required.");
    }
}

// Redirect any unknown URL to the setup page (captive portal behavior)
void handleNotFound() {
    setupServer.sendHeader("Location", "/", true);
    setupServer.send(302, "text/plain", "");
}

// --- Start AP mode with captive portal ---
void startSetupMode() {
    Serial.println("📡 Starting Setup Mode...");
    Serial.println("📡 Connect to WiFi: " AP_NAME);

    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_NAME, AP_PASSWORD);

    Serial.print("📡 Setup portal at: http://");
    Serial.println(WiFi.softAPIP());

    setupServer.on("/",      handleSetupRoot);
    setupServer.on("/save",  HTTP_POST, handleSave);
    setupServer.onNotFound(handleNotFound);
    setupServer.begin();

    // Stay in setup mode forever until user submits credentials
    while (true) {
        setupServer.handleClient();
        delay(2);
    }
}

// --- Main provisioning function ---
// Call this from setup(). Returns the Server IP as a C string.
// If WiFi fails, it enters AP setup mode and never returns (reboots after save).
const char* provisionWiFi() {
    pinMode(RESET_PIN, INPUT_PULLUP);
    delay(100);
    // [FIX] Disabled because programmer shields hold GPIO0 low automatically
    /*
    if (digitalRead(RESET_PIN) == LOW) {
        Serial.println("🔘 BOOT button held — entering setup mode...");
        clearSavedCredentials();
        startSetupMode();  // never returns
    }
    */

    // Try to load saved credentials
    if (!loadCredentials()) {
        Serial.println("⚠️ No saved credentials found.");
        startSetupMode();  // never returns
    }

    // Try connecting to saved WiFi
    Serial.printf("📶 Connecting to: %s\n", savedSSID.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.begin(savedSSID.c_str(), savedPassword.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < WIFI_TIMEOUT * 2) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\n❌ WiFi connection failed! Entering setup mode...");
        startSetupMode();  // never returns
    }

    Serial.println("\n✅ WiFi Connected: " + WiFi.localIP().toString());
    Serial.println("📡 Server IP: " + savedServerIP);

    return savedServerIP.c_str();
}

#endif
