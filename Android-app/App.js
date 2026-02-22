import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, KeyboardAvoidingView, Platform, StatusBar, useColorScheme } from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Accents } from './config/theme';
import { fetchAPI } from './utils/api';
import ConnectionScreen from './components/ConnectionScreen';
import Dashboard from './components/Dashboard';
import FaceManager from './components/FaceManager';

export default function App() {
    const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
    const [serverIP, setServerIP] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ text: "Ready.", timestamp: "" });
    const [sentryMode, setSentryMode] = useState(false);
    const [autoLight, setAutoLight] = useState(true);
    const [tab, setTab] = useState('dash');
    const [faces, setFaces] = useState([]);

    useEffect(() => {
        AsyncStorage.getItem('serverIP').then(ip => { if (ip) setServerIP(ip); });
    }, []);

    const speak = (text) => Speech.speak(text, { rate: 1.0 });

    // Wrapper that auto-disconnects on network failure
    const callAPI = async (path, method = 'GET', body = null) => {
        const result = await fetchAPI(serverIP, isConnected, path, method, body);
        if (result === null && path !== '/') setIsConnected(false);
        return result;
    };

    const testConnection = async () => {
        if (!serverIP) { Alert.alert("Wait", "Enter PC IP first."); return; }
        setIsLoading(true);
        const res = await fetchAPI(serverIP, true, '/');
        setIsLoading(false);
        if (res && res.status === 'online') {
            setIsConnected(true);
            AsyncStorage.setItem('serverIP', serverIP);
            refreshStatus();
        } else {
            Alert.alert("Failed", "Cannot reach AetherEye server.");
        }
    };

    const refreshStatus = async () => {
        const data = await callAPI('/status');
        if (data?.latest) {
            if (data.latest.text !== status.text && data.latest.text !== "System ready.") speak(data.latest.text);
            setStatus(data.latest);
            setSentryMode(data.sentry);
            setAutoLight(data.auto_light);
        }
    };

    const doScan = async () => {
        speak("Starting scan.");
        const res = await callAPI('/scan');
        if (!res) Alert.alert("Error", "Scan failed to start. Check server console.");
        else { setTimeout(refreshStatus, 5000); setTimeout(refreshStatus, 15000); }
    };

    const toggleLight = async (turnOn) => {
        const res = await callAPI(`/light/${turnOn ? 'on' : 'off'}`, 'POST');
        if (!res || res.status === 'err') Alert.alert("Light Error", "Failed to control light. Is ESP32-CAM online?");
        else speak(`Light ${turnOn ? 'on' : 'off'}`);
    };

    const loadFaces = async () => {
        const data = await callAPI('/faces');
        setFaces(Array.isArray(data) ? data : []);
    };

    // ========== RENDER ==========
    if (!isConnected) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.container, { backgroundColor: theme.bg }]}>
                <StatusBar barStyle={theme.bar} />
                <ConnectionScreen
                    theme={theme}
                    serverIP={serverIP}
                    setServerIP={setServerIP}
                    isLoading={isLoading}
                    onConnect={testConnection}
                />
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.bar} />

            {/* HEADER */}
            <View style={[styles.header, { backgroundColor: theme.card }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>AetherEye</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.subText }]}>🟢 Online</Text>
                </View>
            </View>

            {/* TABS */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    onPress={() => setTab('dash')}
                    style={[styles.tab, { backgroundColor: theme.card, borderColor: tab === 'dash' ? Accents.primary : theme.border }]}
                >
                    <Text style={[styles.tabText, { color: theme.text }]}>🛡️ Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { setTab('faces'); loadFaces(); }}
                    style={[styles.tab, { backgroundColor: theme.card, borderColor: tab === 'faces' ? Accents.primary : theme.border }]}
                >
                    <Text style={[styles.tabText, { color: theme.text }]}>👥 People</Text>
                </TouchableOpacity>
            </View>

            {/* CONTENT */}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {tab === 'dash' ? (
                    <Dashboard
                        theme={theme}
                        status={status}
                        sentryMode={sentryMode}
                        autoLight={autoLight}
                        onScan={doScan}
                        onToggleSentry={() => callAPI(`/sentry/${sentryMode ? 'off' : 'on'}`, 'POST').then(refreshStatus)}
                        onToggleAutoLight={() => callAPI(`/autolight/${autoLight ? 'off' : 'on'}`, 'POST').then(refreshStatus)}
                        onLightOn={() => toggleLight(true)}
                        onLightOff={() => toggleLight(false)}
                        onSpeak={speak}
                    />
                ) : (
                    <FaceManager
                        theme={theme}
                        faces={faces}
                        serverIP={serverIP}
                        isConnected={isConnected}
                        onFetchAPI={callAPI}
                        onLoadFaces={loadFaces}
                        onSpeak={speak}
                    />
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 40 },
    header: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 4,
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 }
    },
    headerTitle: { fontSize: 26, fontWeight: '800' },
    headerSubtitle: { fontSize: 13, fontWeight: '600' },
    tabBar: { flexDirection: 'row', padding: 15 },
    tab: { flex: 1, padding: 10, alignItems: 'center', marginHorizontal: 5, borderRadius: 12, borderWidth: 2 },
    tabText: { fontWeight: '700' },
    scrollContent: { paddingHorizontal: 25, paddingBottom: 40 },
});