#ifndef SENSOR_SMOKE_H
#define SENSOR_SMOKE_H

#include <Arduino.h>
#include <WiFiUdp.h>
#include <driver/adc.h>

#define SMOKE_PIN        34

extern WiFiUDP udp_smoke;
extern const char* PC_IP;
extern const int SMOKE_UDP_PORT;

void initSmoke() {
  Serial.println("🔧 Configuring Smoke Sensor ADC...");
  adc1_config_width(ADC_WIDTH_BIT_12);
  adc1_config_channel_atten(ADC1_CHANNEL_6, ADC_ATTEN_DB_11); 
}

void smokeTask(void* parameter) {
  Serial.println("🔥 Smoke Task Started on Core 0");
  
  while (true) {
    int smokeValue = adc1_get_raw(ADC1_CHANNEL_6);

    udp_smoke.beginPacket(PC_IP, SMOKE_UDP_PORT);
    udp_smoke.print(smokeValue);
    udp_smoke.endPacket();

    vTaskDelay(pdMS_TO_TICKS(2000)); 
  }
}

#endif
