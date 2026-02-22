import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Accents } from '../config/theme';

export default function Dashboard({ theme, status, sentryMode, autoLight, onScan, onToggleSentry, onToggleAutoLight, onLightOn, onLightOff, onSpeak }) {
    return (
        <>
            {/* STATUS CARD */}
            <View style={[styles.statusCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.statusLabel, { color: theme.subText }]}>LATEST REPORT</Text>
                <Text style={[styles.statusText, { color: theme.text }]}>"{status.text}"</Text>
                <View style={styles.statusFooter}>
                    <Text style={{ color: theme.subText }}>{status.timestamp}</Text>
                    <TouchableOpacity onPress={() => onSpeak(status.text)}>
                        <Ionicons name="volume-high" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* CONTROLS */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>CONTROLS</Text>
            <View style={styles.grid}>
                <TouchableOpacity style={[styles.controlBtn, { backgroundColor: Accents.accent }]} onPress={onScan}>
                    <Ionicons name="scan" size={32} color="#333" />
                    <Text style={styles.controlBtnText}>Quick Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.controlBtn, { backgroundColor: sentryMode ? Accents.danger : Accents.primary }]}
                    onPress={onToggleSentry}
                >
                    <Ionicons name={sentryMode ? "shield-checkmark" : "shield-outline"} size={32} color="#333" />
                    <Text style={styles.controlBtnText}>Sentry: {sentryMode ? "ON" : "OFF"}</Text>
                </TouchableOpacity>
            </View>

            {/* AUTO LIGHT */}
            <TouchableOpacity
                style={[styles.autoLightBtn, { backgroundColor: autoLight ? Accents.highlight : theme.inputBg }]}
                onPress={onToggleAutoLight}
            >
                <Text style={[styles.autoLightText, { color: theme.text }]}>🤖 AUTO LIGHT: {autoLight ? "ON" : "OFF"}</Text>
            </TouchableOpacity>

            {/* MANUAL LIGHT */}
            <View style={styles.row}>
                <TouchableOpacity style={[styles.lightBtn, { backgroundColor: theme.inputBg, borderColor: Accents.primary }]} onPress={onLightOn}>
                    <Text style={[styles.lightText, { color: theme.text }]}>💡 Light ON</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.lightBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={onLightOff}>
                    <Text style={[styles.lightText, { color: theme.subText }]}>🌑 Light OFF</Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    statusCard: { padding: 25, borderRadius: 25, marginBottom: 30, elevation: 3, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 } },
    statusLabel: { fontWeight: '700', fontSize: 12, marginBottom: 10, letterSpacing: 1 },
    statusText: { fontSize: 22, fontWeight: '600', lineHeight: 32 },
    statusFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
    grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    controlBtn: { flex: 0.48, aspectRatio: 1.1, borderRadius: 25, padding: 20, justifyContent: 'space-between', elevation: 2 },
    controlBtnText: { fontSize: 17, fontWeight: '800', color: '#333' },
    autoLightBtn: { padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 15 },
    autoLightText: { fontWeight: '800' },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    lightBtn: { flex: 0.48, padding: 18, borderRadius: 18, alignItems: 'center', borderWidth: 2 },
    lightText: { fontWeight: '800', fontSize: 16 },
});
