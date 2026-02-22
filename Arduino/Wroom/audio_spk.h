#ifndef AUDIO_SPK_H
#define AUDIO_SPK_H

#include <Arduino.h>
#include <WiFiUdp.h>
#include <driver/i2s.h>

#define I2S_SPK_BCLK 26
#define I2S_SPK_LRC 25
#define I2S_SPK_DIN 22
#define I2S_SPK_NUM I2S_NUM_1

extern WiFiUDP udp_spk;
extern const int SPK_UDP_PORT;

// --- CONFIG ---
float volumeMultiplier = 0.2; // Set volume here on ESP32 (0.0 to 1.0 = Half Volume)

void initSpk() {
  Serial.println("🔧 Configuring Speaker I2S...");
  i2s_config_t spk_cfg = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = 32000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT, // Stereo DMA format handles word alignment better for MAX98357A
    .communication_format = I2S_COMM_FORMAT_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 10,
    .dma_buf_len = 1024,
    .use_apll = true, // APLL can conflict with WiFi RF
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };
  
  i2s_pin_config_t spk_pins = { .mck_io_num = I2S_PIN_NO_CHANGE, .bck_io_num = I2S_SPK_BCLK, .ws_io_num = I2S_SPK_LRC, .data_out_num = I2S_SPK_DIN, .data_in_num = -1 };
  i2s_driver_install(I2S_SPK_NUM, &spk_cfg, 0, NULL);
  i2s_set_pin(I2S_SPK_NUM, &spk_pins);
  i2s_zero_dma_buffer(I2S_SPK_NUM); // Clear any initial static
}

void spkTask(void* parameter) {
  Serial.println("🔊 Speaker Task Started on Core 1");
  if(udp_spk.begin(SPK_UDP_PORT)) {
       Serial.println("✅ UDP Listener started on port " + String(SPK_UDP_PORT));
  } else {
       Serial.println("❌ UDP Listener FAILED!");
  }
  
  uint8_t rx_buffer[1024];

  while (true) {
    int packetSize = udp_spk.parsePacket();
    if (packetSize > 0) {
      int len = udp_spk.read(rx_buffer, sizeof(rx_buffer));
      if (len > 0) {
        
        // --- NATIVE ESP32 VOLUME CONTROL ---
        // Treat the 8-bit array as an array of 16-bit Signed PCM Audio Samples
        int16_t* samples = (int16_t*)rx_buffer;
        int num_samples = len / 2; // 2 bytes per 16-bit sample
        
        for (int i = 0; i < num_samples; i++) {
           // Multiply mathematical wave amplitude to decrease acoustic volume natively
           samples[i] = (int16_t)(samples[i] * volumeMultiplier); 
        }
        
        size_t written;
        // i2s_write blocks properly up to portMAX_DELAY if I2S buffer is full
        i2s_write(I2S_SPK_NUM, rx_buffer, len, &written, portMAX_DELAY);
      }
    }
    
    // Always afford the watchdog some breath!
    vTaskDelay(pdMS_TO_TICKS(1)); 
  }
}

#endif
