import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, StatusBar, useColorScheme } from 'react-native';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// --- THEME CONFIG ---
const Colors = {
    light: { bg: '#F8F9FA', card: '#FFFFFF', text: '#2D3436', subText: '#636E72', border: '#EEEEEE', inputBg: '#F0F2F5', modalOverlay: 'rgba(0,0,0,0.5)', bar: 'dark-content' },
    dark: { bg: '#121212', card: '#1E1E1E', text: '#E0E0E0', subText: '#AAAAAA', border: '#333333', inputBg: '#2C2C2C', modalOverlay: 'rgba(255,255,255,0.15)', bar: 'light-content' }
};
const Accents = { primary: '#A8E6CF', accent: '#FFD3B6', danger: '#FFAAA5', highlight: '#DCD3FF' };

export default function App() {
    const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
    const [serverIP, setServerIP] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ text: "Ready.", timestamp: "" });
    const [sentryMode, setSentryMode] = useState(false);
    const [autoLight, setAutoLight] = useState(true);
    const [tab, setTab] = useState('dashboard');
    const [faces, setFaces] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');

    useEffect(() => { AsyncStorage.getItem('serverIP').then(ip => { if (ip) setServerIP(ip); }); }, []);

    const apiUrl = (path) => `http://${serverIP}${path}`;
    const speak = (text) => Speech.speak(text, { rate: 1.0 });

    const fetchAPI = async (path, method = 'GET', body = null) => {
        if (!isConnected && path !== '/') return null;
        try {
            const res = await fetch(apiUrl(path), { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : null });
            return res.ok ? await res.json() : null;
        } catch (e) { setIsConnected(false); return null; }
    };

    const testConnection = async () => {
        if (!serverIP) { Alert.alert("Wait", "Enter PC IP first."); return; }
        setIsLoading(true);
        const res = await fetchAPI('/');
        setIsLoading(false);
        if (res && res.status === 'online') {
            setIsConnected(true); AsyncStorage.setItem('serverIP', serverIP); refreshStatus();
        } else {
            Alert.alert("Failed", "Cannot reach AetherEye server.");
        }
    };

    const refreshStatus = async () => {
        const data = await fetchAPI('/status');
        if (data?.latest) {
            if (data.latest.text !== status.text && data.latest.text !== "System ready.") speak(data.latest.text);
            setStatus(data.latest); setSentryMode(data.sentry); setAutoLight(data.auto_light);
        }
    };

    // --- FIXED ACTION FUNCTIONS WITH FEEDBACK ---
    const doScan = async () => {
        speak("Starting scan.");
        const res = await fetchAPI('/scan');
        if (!res) Alert.alert("Error", "Scan failed to start. Check server console.");
        else { setTimeout(refreshStatus, 5000); setTimeout(refreshStatus, 15000); }
    };

    const toggleLight = async (state) => {
        const res = await fetchAPI(`/light/${state ? 'on' : 'off'}`, 'POST');
        if (!res || res.status === 'err') Alert.alert("Light Error", "Failed to control light. Is ESP32-CAM online?");
        else speak(`Light ${state ? 'on' : 'off'}`);
    }

    // --- FACE FUNCTIONS ---
    const loadFaces = async () => {
        const data = await fetchAPI('/faces');
        setFaces(Array.isArray(data) ? data : []);
    };

    const pickAndUpload = async (name) => {
        let res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8 });
        if (!res.canceled) {
            const fd = new FormData();
            res.assets.forEach((a, i) => fd.append('files', { uri: a.uri, name: `p_${Date.now()}_${i}.jpg`, type: 'image/jpeg' }));
            try {
                await fetch(apiUrl(`/faces/${name}`), { method: 'POST', body: fd, headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert("Uploaded", "Tap 'TRAIN MODEL' to finish."); if (isConnected) loadFaces();
            } catch (e) { Alert.alert("Error", "Upload failed."); }
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.c, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.bar} />
            {/* HEADER */}
            <View style={[styles.h, { backgroundColor: theme.card }]}>
                <View><Text style={[styles.ht, { color: theme.text }]}>AetherEye</Text><Text style={[styles.hst, { color: theme.subText }]}>{isConnected ? "🟢 Online" : "🔴 Offline"}</Text></View>
                {!isConnected && <TouchableOpacity style={[styles.cb, { backgroundColor: Accents.primary }]} onPress={testConnection} disabled={isLoading}>{isLoading ? <ActivityIndicator color="#333" /> : <Text style={styles.cbt}>CONNECT</Text>}</TouchableOpacity>}
            </View>

            {!isConnected ? (
                <View style={styles.cc}><Text style={[styles.l, { color: theme.text }]}>PC IP Address:</Text><TextInput style={[styles.ti, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]} value={serverIP} onChangeText={setServerIP} placeholder="e.g. 192.168.1.5:5000" placeholderTextColor={theme.subText} keyboardType="url" autoCapitalize="none" /></View>
            ) : (
                <>
                    {/* TABS */}
                    <View style={styles.tb}>
                        <TouchableOpacity onPress={() => setTab('dash')} style={[styles.t, { backgroundColor: theme.card, borderColor: tab === 'dash' ? Accents.primary : theme.border }]}><Text style={[styles.tt, { color: theme.text }]}>🛡️ Dashboard</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { setTab('faces'); loadFaces(); }} style={[styles.t, { backgroundColor: theme.card, borderColor: tab === 'faces' ? Accents.primary : theme.border }]}><Text style={[styles.tt, { color: theme.text }]}>👥 People</Text></TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.sc}>
                        {tab === 'dash' ? (
                            <>
                                {/* STATUS CARD */}
                                <View style={[styles.stc, { backgroundColor: theme.card }]}>
                                    <Text style={[styles.stl, { color: theme.subText }]}>LATEST REPORT</Text>
                                    <Text style={[styles.sttxt, { color: theme.text }]}>"{status.text}"</Text>
                                    <View style={styles.stf}><Text style={{ color: theme.subText }}>{status.timestamp}</Text><TouchableOpacity onPress={() => speak(status.text)}><Ionicons name="volume-high" size={24} color={theme.text} /></TouchableOpacity></View>
                                </View>

                                {/* CONTROLS */}
                                <Text style={[styles.sect, { color: theme.text }]}>CONTROLS</Text>
                                <View style={styles.g}>
                                    <TouchableOpacity style={[styles.cbtn, { backgroundColor: Accents.accent }]} onPress={doScan}><Ionicons name="scan" size={32} color="#333" /><Text style={styles.cbtnt}>Quick Scan</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.cbtn, { backgroundColor: sentryMode ? Accents.danger : Accents.primary }]} onPress={() => fetchAPI(`/sentry/${sentryMode ? 'off' : 'on'}`, 'POST').then(refreshStatus)}><Ionicons name={sentryMode ? "shield-checkmark" : "shield-outline"} size={32} color="#333" /><Text style={styles.cbtnt}>Sentry: {sentryMode ? "ON" : "OFF"}</Text></TouchableOpacity>
                                </View>
                                <TouchableOpacity style={[styles.abtn, { backgroundColor: autoLight ? Accents.highlight : theme.inputBg }]} onPress={() => fetchAPI(`/autolight/${autoLight ? 'off' : 'on'}`, 'POST').then(refreshStatus)}><Text style={[styles.btnt, { color: theme.text }]}>🤖 AUTO LIGHT: {autoLight ? "ON" : "OFF"}</Text></TouchableOpacity>
                                <View style={styles.r}>
                                    <TouchableOpacity style={[styles.pbtn, { backgroundColor: theme.inputBg, borderColor: Accents.primary }]} onPress={() => toggleLight(true)}><Text style={[styles.pt, { color: theme.text }]}>💡 Light ON</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.pbtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => toggleLight(false)}><Text style={[styles.pt, { color: theme.subText }]}>🌑 Light OFF</Text></TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <>
                                {/* FACES */}
                                <TouchableOpacity style={[styles.trb, { backgroundColor: Accents.highlight }]} onPress={async () => { speak("Training started."); const res = await fetchAPI('/train', 'POST'); if (res) Alert.alert("Done", `${res.count} people enrolled.`); }}><Text style={styles.trt}>⚡ TRAIN MODEL ⚡</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.apb, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setModalVisible(true)}><Text style={{ color: theme.subText, fontWeight: '700' }}>+ New Profile</Text></TouchableOpacity>
                                {faces.map(p => (
                                    <View key={p.name} style={[styles.pr, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <View style={[styles.av, { backgroundColor: theme.inputBg }]}><Text style={{ fontSize: 20, fontWeight: '700', color: theme.subText }}>{p.name[0]}</Text></View>
                                        <View style={{ flex: 1 }}><Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>{p.name}</Text><Text style={{ color: theme.subText }}>{p.photos} photos</Text></View>
                                        <TouchableOpacity style={{ padding: 8 }} onPress={() => pickAndUpload(p.name)}><Ionicons name="add-circle" size={28} color={Accents.primary} /></TouchableOpacity>
                                        <TouchableOpacity style={{ padding: 8 }} onPress={() => Alert.alert("Delete?", `Remove ${p.name}?`, [{ text: "Cancel" }, { text: "Delete", style: 'destructive', onPress: () => fetchAPI(`/faces/${p.name}`, 'DELETE').then(loadFaces) }])}><Ionicons name="trash" size={24} color={Accents.danger} /></TouchableOpacity>
                                    </View>
                                ))}
                            </>
                        )}
                    </ScrollView>
                </>
            )}

            {/* MODAL */}
            <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={[styles.mv, { backgroundColor: theme.modalOverlay }]}>
                    <View style={[styles.mc, { backgroundColor: theme.card }]}>
                        <Text style={[styles.mt, { color: theme.text }]}>New Member</Text>
                        <TextInput style={[styles.mi, { backgroundColor: theme.inputBg, color: theme.text }]} placeholder="Enter Name" placeholderTextColor={theme.subText} value={newPersonName} onChangeText={setNewPersonName} />
                        <View style={styles.ma}>
                            <TouchableOpacity style={[styles.mb, { backgroundColor: theme.inputBg }]} onPress={() => setModalVisible(false)}><Text style={{ color: theme.subText, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.mb, { backgroundColor: Accents.primary }]} onPress={() => { if (newPersonName.trim()) { setModalVisible(false); setTimeout(() => pickAndUpload(newPersonName.trim()), 500); setNewPersonName(''); } }}><Text style={{ color: '#333', fontWeight: '700' }}>Create</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    c: { flex: 1, paddingTop: 40 },
    h: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } },
    ht: { fontSize: 26, fontWeight: '800' }, hst: { fontSize: 13, fontWeight: '600' },
    cb: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 }, cbt: { fontWeight: '700', fontSize: 12, color: '#333' },
    cc: { flex: 1, justifyContent: 'center', padding: 40 }, l: { fontSize: 16, marginBottom: 15, fontWeight: '600', textAlign: 'center' },
    ti: { padding: 15, borderRadius: 15, fontSize: 20, borderWidth: 2, textAlign: 'center', fontWeight: 'bold' },
    tb: { flexDirection: 'row', padding: 15 }, t: { flex: 1, padding: 10, alignItems: 'center', marginHorizontal: 5, borderRadius: 12, borderWidth: 2 }, tt: { fontWeight: '700' },
    sc: { paddingHorizontal: 25, paddingBottom: 40 },
    stc: { padding: 25, borderRadius: 25, marginBottom: 30, elevation: 3, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 } },
    stl: { fontWeight: '700', fontSize: 12, marginBottom: 10, letterSpacing: 1 }, sttxt: { fontSize: 22, fontWeight: '600', lineHeight: 32 },
    stf: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    sect: { fontSize: 18, fontWeight: '800', marginBottom: 15 }, g: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    cbtn: { flex: 0.48, aspectRatio: 1.1, borderRadius: 25, padding: 20, justifyContent: 'space-between', elevation: 2 }, cbtnt: { fontSize: 17, fontWeight: '800', color: '#333' },
    abtn: { padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 15 }, btnt: { fontWeight: '800' },
    r: { flexDirection: 'row', justifyContent: 'space-between' }, pbtn: { flex: 0.48, padding: 18, borderRadius: 18, alignItems: 'center', borderWidth: 2 }, pt: { fontWeight: '800', fontSize: 16 },
    trb: { padding: 18, borderRadius: 18, marginBottom: 20, alignItems: 'center' }, trt: { fontWeight: '900', color: '#6C5CE7', letterSpacing: 1.5 },
    apb: { padding: 15, borderRadius: 15, marginBottom: 20, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
    pr: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 10, borderWidth: 1 }, av: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    mv: { flex: 1, justifyContent: 'center', padding: 20 }, mc: { borderRadius: 30, padding: 30, alignItems: 'center', elevation: 5 },
    mt: { fontSize: 22, fontWeight: '800', marginBottom: 25 }, mi: { width: '100%', padding: 18, borderRadius: 18, fontSize: 20, marginBottom: 25, textAlign: 'center', fontWeight: '600' },
    ma: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' }, mb: { flex: 0.48, padding: 15, borderRadius: 15, alignItems: 'center' }
});