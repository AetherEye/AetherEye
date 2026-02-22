import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Accents } from '../config/theme';

export default function ConnectionScreen({ theme, serverIP, setServerIP, isLoading, onConnect }) {
    return (
        <>
            {/* HEADER */}
            <View style={[styles.header, { backgroundColor: theme.card }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>AetherEye</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.subText }]}>🔴 Offline</Text>
                </View>
                <TouchableOpacity
                    style={[styles.connectBtn, { backgroundColor: Accents.primary }]}
                    onPress={onConnect}
                    disabled={isLoading}
                >
                    {isLoading
                        ? <ActivityIndicator color="#333" />
                        : <Text style={styles.connectBtnText}>CONNECT</Text>
                    }
                </TouchableOpacity>
            </View>

            {/* IP INPUT */}
            <View style={styles.centerContent}>
                <Text style={[styles.label, { color: theme.text }]}>PC IP Address:</Text>
                <TextInput
                    style={[styles.textInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                    value={serverIP}
                    onChangeText={setServerIP}
                    placeholder="e.g. 192.168.1.5:5000"
                    placeholderTextColor={theme.subText}
                    keyboardType="url"
                    autoCapitalize="none"
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
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
    connectBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
    connectBtnText: { fontWeight: '700', fontSize: 12, color: '#333' },
    centerContent: { flex: 1, justifyContent: 'center', padding: 40 },
    label: { fontSize: 16, marginBottom: 15, fontWeight: '600', textAlign: 'center' },
    textInput: { padding: 15, borderRadius: 15, fontSize: 20, borderWidth: 2, textAlign: 'center', fontWeight: 'bold' },
});
