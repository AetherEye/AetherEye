#include <WiFi.h>
#include <WiFiUdp.h>
#include <HTTPClient.h>

#include "wifi_provision.h"  // WiFi provisioning via captive portal

// --- CONFIG ---
const int PC_API_PORT      = 5000;
const int MIC_UDP_PORT     = 4444;
const int SPK_UDP_PORT     = 5555;
const int SMOKE_UDP_PORT   = 6666;

// Server IP is set dynamically via provisioning
const char* PC_IP = "";

WiFiUDP udp_mic;
WiFiUDP udp_spk;
WiFiUDP udp_smoke;

// --- MODULES ---
#include "audio_mic.h"
#include "audio_spk.h"
#include "sensor_smoke.h"

void setup() {
  #include "soc/soc.h"
  #include "soc/rtc_cntl_reg.h"
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n🔄 --- SYSTEM BOOT START ---");

  // --- WiFi Provisioning ---
  // On first boot: creates "AetherEye-Setup" hotspot for configuration
  // On subsequent boots: auto-connects to saved WiFi
  // Returns the server IP that the user entered during setup
  PC_IP = provisionWiFi();
  
  Serial.println("📡 Server IP: " + String(PC_IP));

  // Initialize modular peripherals
  initMic();
  initSpk();
  initSmoke();

  // Start Tasks
  Serial.println("🚀 Starting RTOS Tasks...");
  xTaskCreatePinnedToCore(micTask, "MicTask", 8000, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(smokeTask, "SmokeTask", 4000, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(spkTask, "SpkTask", 8000, NULL, 1, NULL, 1);
  
  Serial.println("✨ SYSTEM BOOT COMPLETE ✨");
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}