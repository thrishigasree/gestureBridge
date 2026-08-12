import cv2
import mediapipe as mp

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Open laptop webcam
cap = cv2.VideoCapture(0)

while True:

    success, frame = cap.read()

    if not success:
        print("Could not access camera")
        break

    # OpenCV: BGR
    # MediaPipe: RGB
    rgb_frame = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    # Detect hands
    results = hands.process(rgb_frame)

    # If hand detected
    if results.multi_hand_landmarks:

        print("✋ HAND DETECTED")

        for hand_landmarks in results.multi_hand_landmarks:

            # Draw 21 hand landmarks
            mp_draw.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS
            )

    else:

        print("Searching for hand...")

    # Display camera
    cv2.imshow(
        "GestureBridge - Hand Detection",
        frame
    )

    # Press Q to quit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


cap.release()
cv2.destroyAllWindows()