import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Accents } from '../config/theme';
import { apiUrl } from '../utils/api';

export default function FaceManager({ theme, faces, serverIP, isConnected, onFetchAPI, onLoadFaces, onSpeak }) {
    const [modalVisible, setModalVisible] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');

    const pickAndUpload = async (name) => {
        let res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8
        });
        if (!res.canceled) {
            const fd = new FormData();
            res.assets.forEach((asset, i) =>
                fd.append('files', { uri: asset.uri, name: `p_${Date.now()}_${i}.jpg`, type: 'image/jpeg' })
            );
            try {
                await fetch(apiUrl(serverIP, `/faces/${name}`), {
                    method: 'POST',
                    body: fd,
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                Alert.alert("Uploaded", "Tap 'TRAIN MODEL' to finish.");
                if (isConnected) onLoadFaces();
            } catch (e) {
                Alert.alert("Error", "Upload failed.");
            }
        }
    };

    return (
        <>
            {/* TRAIN BUTTON */}
            <TouchableOpacity
                style={[styles.trainBtn, { backgroundColor: Accents.highlight }]}
                onPress={async () => {
                    onSpeak("Training started.");
                    const res = await onFetchAPI('/train', 'POST');
                    if (res) Alert.alert("Done", `${res.count} people enrolled.`);
                }}
            >
                <Text style={styles.trainBtnText}>⚡ TRAIN MODEL ⚡</Text>
            </TouchableOpacity>

            {/* ADD NEW PROFILE */}
            <TouchableOpacity
                style={[styles.addProfileBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={{ color: theme.subText, fontWeight: '700' }}>+ New Profile</Text>
            </TouchableOpacity>

            {/* FACE LIST */}
            {faces.map(person => (
                <View key={person.name} style={[styles.profileRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={[styles.avatar, { backgroundColor: theme.inputBg }]}>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: theme.subText }}>{person.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>{person.name}</Text>
                        <Text style={{ color: theme.subText }}>{person.photos} photos</Text>
                    </View>
                    <TouchableOpacity style={{ padding: 8 }} onPress={() => pickAndUpload(person.name)}>
                        <Ionicons name="add-circle" size={28} color={Accents.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => Alert.alert("Delete?", `Remove ${person.name}?`, [
                            { text: "Cancel" },
                            { text: "Delete", style: 'destructive', onPress: () => onFetchAPI(`/faces/${person.name}`, 'DELETE').then(onLoadFaces) }
                        ])}
                    >
                        <Ionicons name="trash" size={24} color={Accents.danger} />
                    </TouchableOpacity>
                </View>
            ))}

            {/* NEW PERSON MODAL */}
            <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>New Member</Text>
                        <TextInput
                            style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text }]}
                            placeholder="Enter Name"
                            placeholderTextColor={theme.subText}
                            value={newPersonName}
                            onChangeText={setNewPersonName}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.inputBg }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={{ color: theme.subText, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: Accents.primary }]}
                                onPress={() => {
                                    if (newPersonName.trim()) {
                                        setModalVisible(false);
                                        setTimeout(() => pickAndUpload(newPersonName.trim()), 500);
                                        setNewPersonName('');
                                    }
                                }}
                            >
                                <Text style={{ color: '#333', fontWeight: '700' }}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    trainBtn: { padding: 18, borderRadius: 18, marginBottom: 20, alignItems: 'center' },
    trainBtnText: { fontWeight: '900', color: '#6C5CE7', letterSpacing: 1.5 },
    addProfileBtn: { padding: 15, borderRadius: 15, marginBottom: 20, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
    profileRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 10, borderWidth: 1 },
    avatar: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
    modalContent: { borderRadius: 30, padding: 30, alignItems: 'center', elevation: 5 },
    modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 25 },
    modalInput: { width: '100%', padding: 18, borderRadius: 18, fontSize: 20, marginBottom: 25, textAlign: 'center', fontWeight: '600' },
    modalActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
    modalBtn: { flex: 0.48, padding: 15, borderRadius: 15, alignItems: 'center' },
});
