#ifndef AUDIO_MIC_H
#define AUDIO_MIC_H

#include <Arduino.h>
#include <WiFiUdp.h>
#include <driver/i2s.h>

#define I2S_MIC_WS 15
#define I2S_MIC_SD 32
#define I2S_MIC_SCK 14
#define I2S_MIC_NUM I2S_NUM_0
#define BUFFER_LEN 512

extern WiFiUDP udp_mic;
extern const char* PC_IP;
extern const int MIC_UDP_PORT;

void initMic() {
  Serial.println("🔧 Configuring Microphone I2S...");
  i2s_config_t mic_cfg = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 16000, .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT, .communication_format = I2S_COMM_FORMAT_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1, .dma_buf_count = 4, .dma_buf_len = BUFFER_LEN,
    .use_apll = false, .tx_desc_auto_clear = false, .fixed_mclk = 0
  };
  i2s_pin_config_t mic_pins = { .mck_io_num = I2S_PIN_NO_CHANGE, .bck_io_num = I2S_MIC_SCK, .ws_io_num = I2S_MIC_WS, .data_out_num = -1, .data_in_num = I2S_MIC_SD };
  i2s_driver_install(I2S_MIC_NUM, &mic_cfg, 0, NULL);
  i2s_set_pin(I2S_MIC_NUM, &mic_pins);
}

void micTask(void* parameter) {
  Serial.println("🎤 Mic Task Started on Core 0");
  int32_t raw_samples[BUFFER_LEN];
  int16_t tx_samples[BUFFER_LEN];

  while (true) {
    size_t bytes_read = 0;
    esp_err_t result = i2s_read(I2S_MIC_NUM, &raw_samples, sizeof(raw_samples), &bytes_read, 100);
    if (result == ESP_OK && bytes_read > 0) {
      int samples = bytes_read / 4;
      for (int i = 0; i < samples; i++) {
        tx_samples[i] = (raw_samples[i] >> 14);
      }
      udp_mic.beginPacket(PC_IP, MIC_UDP_PORT);
      udp_mic.write((uint8_t*)tx_samples, samples * 2);
      udp_mic.endPacket();
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

#endif
