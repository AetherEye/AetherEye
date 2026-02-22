import cv2
import time
import numpy as np
import face_recognition
from collections import defaultdict
from datetime import datetime

from config import Config
import state
import core.ai as ai
from core.audio import speak
from core.hardware import control_light_hw


class ObjectTracker:
    def __init__(self):
        self.tracked_objects = {}
        self.face_regions = []

    def set_face_regions(self, face_boxes):
        self.face_regions = face_boxes

    def get_centroid(self, box):
        return int((box[0] + box[2]) / 2), int((box[1] + box[3]) / 2)

    def is_in_face_region(self, box):
        if not Config.FACE_PRIORITY or not self.face_regions:
            return False
        x1, y1, x2, y2 = box
        for fx1, fy1, fx2, fy2 in self.face_regions:
            if not (x2 < (fx1 - Config.FACE_REGION_EXPAND) or x1 > (fx2 + Config.FACE_REGION_EXPAND) or y2 < (
                    fy1 - Config.FACE_REGION_EXPAND) or y1 > (fy2 + Config.FACE_REGION_EXPAND)):
                return True
        return False

    def update(self, detections_by_class):
        current_detections = defaultdict(list)
        for cls, boxes in detections_by_class.items():
            if Config.DOG_CLASS_FILTER and cls in Config.ANIMAL_CLASSES:
                boxes = [b for b in boxes if not self.is_in_face_region(b)]
            for box in boxes:
                current_detections[cls].append(self.get_centroid(box))

        new_tracked_objects = defaultdict(list)
        for cls, old_objects in self.tracked_objects.items():
            for old_obj in old_objects:
                matched = False
                if cls in current_detections:
                    for i, new_centroid in enumerate(current_detections[cls]):
                        distance = np.linalg.norm(np.array(old_obj["centroid"]) - np.array(new_centroid))
                        if distance < Config.SPATIAL_CLUSTERING_DISTANCE:
                            old_obj["centroid"] = new_centroid
                            old_obj["count"] += 1
                            old_obj["age"] = 0
                            new_tracked_objects[cls].append(old_obj)
                            current_detections[cls].pop(i)
                            matched = True
                            break
                if not matched:
                    old_obj["age"] += 1
                    if old_obj["age"] < Config.MAX_TRACK_AGE:
                        new_tracked_objects[cls].append(old_obj)
        for cls, new_centroids in current_detections.items():
            for centroid in new_centroids:
                new_tracked_objects[cls].append({"centroid": centroid, "count": 1, "age": 0})
        self.tracked_objects = dict(new_tracked_objects)

    def get_stable(self):
        return {k: [o["centroid"] for o in v if o["count"] >= Config.MIN_FRAMES_STABLE] for k, v in
                self.tracked_objects.items()}


def draw_label(frame, label, box, color):
    text_y = max(int(box[1]) - 10, 20)
    cv2.rectangle(frame, (int(box[0]), int(box[1])), (int(box[2]), int(box[3])), color, 2)
    (text_width, text_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.rectangle(frame, (int(box[0]), text_y - text_height - 5), (int(box[0]) + text_width, text_y + 5), color, -1)
    cv2.putText(frame, label, (int(box[0]), text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)


def recognize_face(frame, box):
    if not ai.KNOWN_FACES['encodings']:
        return "Unknown"
    x1, y1, x2, y2 = map(int, box)
    height, width, _ = frame.shape
    person_crop = frame[max(0, y1):min(height, y2), max(0, x1):min(width, x2)]
    if person_crop.size == 0:
        return "Unknown"
    try:
        rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb, model="hog")
        if not face_locations:
            return "Unknown"
        encodings = face_recognition.face_encodings(rgb, known_face_locations=face_locations)
        if encodings:
            matches = face_recognition.compare_faces(ai.KNOWN_FACES['encodings'], encodings[0],
                                                     tolerance=Config.FACE_CONF)
            if True in matches:
                return ai.KNOWN_FACES['names'][matches.index(True)]
    except Exception as e:
        print(f"⚠️ Face recognition error: {e}")
    return "Unknown"


def generate_summary(people_list, stable_objects, light_on, all_hazards=None, full=False):
    known_people = [person for person in people_list if person != "Unknown"]
    unknown_count = people_list.count("Unknown")
    object_counts = {k: len(v) for k, v in stable_objects.items() if v}
    critical_stable = {obj_name for obj_name in object_counts if obj_name in Config.HAZARD_LIST}
    critical_all = all_hazards or set()
    all_critical = critical_stable.union(critical_all)

    phrases = []
    if all_critical:
        phrases.append(f"ALERT! I see {' and '.join(all_critical)}.")
    if unknown_count:
        phrases.append(f"Warning, {unknown_count} unknown person.")

    if full:
        if known_people:
            phrases.append(f"I see {' and '.join(known_people)}.")
        if object_counts:
            descriptions = [f"{len(v)} {k}{'s' if len(v) > 1 else ''}" for k, v in stable_objects.items() if
                 v and k not in Config.PERSON_ALIASES and k not in all_critical]
            if descriptions:
                phrases.append(f"Objects: {', '.join(descriptions[:5])}.")
        if not (all_critical or unknown_count or known_people or object_counts):
            phrases.append("Room is empty.")
        phrases.append(f"Light is {'on' if light_on else 'off'}.")
    elif not all_critical and unknown_count == 0 and [person for person in known_people if person not in state.prev_memory["people"]]:
        phrases.append(f"{' and '.join(known_people)} arrived.")

    state.prev_memory["people"] = known_people
    return " ".join(phrases)


def scan_logic(is_auto=False):
    cap = cv2.VideoCapture(Config.CAM_SOURCE)
    if not cap.isOpened():
        print("❌ Cam offline")
        if not is_auto:
            speak("Camera offline.")
        return

    print(f"👀 Scanning...")
    tracker = ObjectTracker()
    person_ids = {}
    frame_count = 0
    start_time = time.time()
    all_hazards_seen = set()

    try:
        while time.time() - start_time < Config.SCAN_DURATION:
            success, frame = cap.read()
            if not success:
                time.sleep(0.1)
                continue
            frame_count += 1

            if Config.BRIGHTNESS_BOOST:
                frame = cv2.convertScaleAbs(frame, alpha=Config.BRIGHTNESS_ALPHA, beta=Config.BRIGHTNESS_BETA)

            # Light Logic
            needs_light = np.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)[:, :, 2]) < Config.LIGHT_THRESHOLD
            if state.auto_light_active and needs_light != state.is_light_on and (
                    time.time() - state.last_light_switch_time > Config.LIGHT_SWITCH_COOLDOWN):
                control_light_hw(needs_light)
                state.is_light_on = needs_light
                state.last_light_switch_time = time.time()
            if state.is_light_on is None:
                state.is_light_on = needs_light

            detections = defaultdict(list)
            face_boxes = []

            # Standard Model
            if ai.yolo_std:
                results = ai.yolo_std.track(frame, persist=True, classes=ai.STD_CLASSES_ID, conf=Config.STD_CONF,
                                            verbose=False)
                for box_data in results[0].boxes:
                    class_name = ai.yolo_std.names[int(box_data.cls[0])]
                    box_coords = box_data.xyxy[0].cpu().numpy().tolist()
                    if class_name in Config.PERSON_ALIASES and box_data.id is not None:
                        track_id = int(box_data.id[0])
                        if track_id not in person_ids or frame_count % 15 == 0:
                            person_name = recognize_face(frame, box_coords)
                            person_ids[track_id] = person_name
                            if person_name != "Unknown":
                                face_boxes.append(box_coords)
                        draw_label(frame, person_ids[track_id], box_coords, (0, 255, 0))
                    else:
                        detections[class_name].append(box_coords)
                        draw_label(frame, class_name, box_coords, (255, 0, 0))

            # Custom Model
            if ai.yolo_custom:
                results = ai.yolo_custom.track(frame, persist=True, conf=Config.CUSTOM_CONF, verbose=False)
                for box_data in results[0].boxes:
                    class_name = ai.yolo_custom.names[int(box_data.cls[0])]
                    box_coords = box_data.xyxy[0].cpu().numpy().tolist()
                    detections[class_name].append(box_coords)
                    draw_label(frame, class_name, box_coords, (0, 0, 255))

            current_hazards = {name for name in detections if name in Config.HAZARD_LIST}
            if current_hazards:
                all_hazards_seen.update(current_hazards)
                if time.time() - state.last_hazard_alert_time > Config.HAZARD_ALERT_COOLDOWN:
                    alert_text = f"ALERT! I see {' and '.join(current_hazards)}."
                    print(f"🚨 {alert_text}")
                    speak(alert_text)
                    state.last_hazard_alert_time = time.time()

            tracker.set_face_regions(face_boxes)
            tracker.update(detections)
            cv2.imshow("AetherEye", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    stable_objects = tracker.get_stable()
    summary = generate_summary(
        list(set(person_ids.values())), stable_objects,
        not state.is_light_on, all_hazards_seen, full=not is_auto
    )

    if summary:
        state.latest_result = {
            "text": summary,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "light": "on" if not state.is_light_on else "off"
        }
        print(f"📝 {summary}")
        speak(summary)