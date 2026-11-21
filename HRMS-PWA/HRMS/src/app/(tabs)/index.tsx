import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HomeHeader from "../../components/HomeHeader";
import AttendanceHero from "../../components/AttendanceHero";

import DashboardNotifications from "../../components/DashboardNotifications";
import MyTeamSection from "../../components/MyTeamSection";
import MyReporteesSection from "../../components/MyReporteesSection";
import type { HomeSection } from "../../components/HomeSectionMenu";
import { getEmployeePhotoUri } from "../../api/profile";
import { useAuth } from "../../auth/AuthProvider";
import { useEmployeeProfile } from "../../hooks/useEmployeeProfile";
import { useTheme } from "../../theme/ThemeProvider";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { ParamListBase } from "@react-navigation/native";

function getDisplayName(profile: any, authUser: any) {
  const firstName =
    profile?.employeeFirstName ??
    profile?.firstName ??
    authUser?.employee?.firstName ??
    "";

  return firstName.trim() || authUser?.username || "Employee";
}
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "E";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { profile } = useEmployeeProfile();

  const [activeSection, setActiveSection] = useState<HomeSection>("dashboard");
  const resetDashboardOnReturn = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (resetDashboardOnReturn.current) {
        resetDashboardOnReturn.current = false;
        setActiveSection("dashboard");
      }
    }, []),
  );

  const navigation =
    useNavigation<BottomTabNavigationProp<ParamListBase>>("/(tabs)");

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", () => {
      setActiveSection("dashboard");
    });

    return unsubscribe;
  }, [navigation]);
  const [dashboardUpperHeight, setDashboardUpperHeight] = useState(0);
  const displayName = getDisplayName(profile, user);
  const initials = getInitials(displayName);c
  const photoUri = getEmployeePhotoUri(profile?.employeePhotoUrl);
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerContainer}>
        <HomeHeader
          userName={displayName}
          initials={initials}
          photoUri={photoUri}
          activeSection={activeSection}
          onProfilePress={() => router.push("/profile")}
          onCalendarPress={() => router.navigate("/calendar")}
          onSectionSelect={setActiveSection}
          onDrawerNavigate={() => {
            resetDashboardOnReturn.current = true;
          }}
        />
      </View>

      <View style={styles.sectionContent}>
        {activeSection === "dashboard" && (
          <View style={styles.dashboardScroll}>
            <View
              onLayout={(event) =>
                setDashboardUpperHeight(event.nativeEvent.layout.height)
              }
            >
              <AttendanceHero />
            </View>
            <DashboardNotifications />
          </View>
        )}
        {activeSection === "team" && (
          <MyTeamSection reservedHeight={dashboardUpperHeight} />
        )}
        {activeSection === "reportees" && (
          <MyReporteesSection reservedHeight={dashboardUpperHeight} />
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: { background: string }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    headerContainer: {
      paddingHorizontal: 12,
      paddingTop: 10,
    },

    sectionContent: {
      flex: 1,
      minHeight: 0,
    },

    dashboardScroll: {
      flex: 1,
      paddingHorizontal: 20,
      minHeight: 0,
    },
  });
}
