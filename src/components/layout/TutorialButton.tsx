import React, { useState } from "react";
import {
  TouchableOpacity,
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useTheme } from "../../lib/theme";

interface TutorialButtonProps {
  videoUrl: string;
  label?: string;
}

export const TutorialButton: React.FC<TutorialButtonProps> = ({
  videoUrl,
}) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[
          styles.button,
          {
            borderColor: theme.gold + "99",
            backgroundColor: theme.gold + "1A",
          },
        ]}
        activeOpacity={0.75}
      >
        <Ionicons name="play-circle-outline" size={16} color={theme.gold} />
        {/* <Text style={[styles.buttonText, { color: theme.text }]}>{label}</Text> */}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.7)" barStyle="light-content" />

        {/* Backdrop — tap to close */}
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Video card — sits on top of backdrop */}
        <View style={styles.centeredWrapper} pointerEvents="box-none">
          <View style={styles.card}>
            {/* Close button */}
            <TouchableOpacity
              onPress={() => setOpen(false)}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>

            {/* Video */}
            <WebView
              source={{ uri: videoUrl }}
              style={styles.webview}
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              // Autoplay works on Android; iOS requires user tap due to OS policy
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  centeredWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 700,
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    padding: 4,
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default TutorialButton;