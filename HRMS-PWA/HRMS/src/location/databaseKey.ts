import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const DATABASE_KEY_STORAGE_NAME = "hrms_location_database_key_v1";

const DATABASE_KEY_INITIALIZED_STORAGE_NAME =
  "hrms_location_database_key_initialized_v1";

const DATABASE_KEY_GUARD_STORAGE_NAME = "hrms_location_database_key_guard_v1";

const DATABASE_KEY_BYTES = 32;
let databaseKeyPromise: Promise<string> | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isValidDatabaseKey(key: string): boolean {
  return /^[0-9a-f]{64}$/i.test(key);
}

export async function getOrCreateLocationDatabaseKey(): Promise<string> {
  if (!databaseKeyPromise) {
    databaseKeyPromise = (async () => {
      const [existingKey, keyWasInitialized, keyGuard] = await Promise.all([
        SecureStore.getItemAsync(DATABASE_KEY_STORAGE_NAME),
        SecureStore.getItemAsync(DATABASE_KEY_INITIALIZED_STORAGE_NAME),
        AsyncStorage.getItem(DATABASE_KEY_GUARD_STORAGE_NAME),
      ]);
      if (existingKey !== null) {
        if (!isValidDatabaseKey(existingKey)) {
          throw new Error(
            "The stored database encryption key is invalid. Existing data must be protected.",
          );
        }

        if (keyWasInitialized !== "true") {
          await SecureStore.setItemAsync(
            DATABASE_KEY_INITIALIZED_STORAGE_NAME,
            "true",
          );
        }

        if (keyGuard !== "true") {
          await AsyncStorage.setItem(DATABASE_KEY_GUARD_STORAGE_NAME, "true");
        }

        return existingKey.toLowerCase();
      }

      if (keyWasInitialized === "true" || keyGuard === "true") {
        throw new Error(
          "The database encryption key is missing. Refusing to generate a replacement because existing encrypted data may be inaccessible.",
        );
      }

      const randomBytes = await Crypto.getRandomBytesAsync(DATABASE_KEY_BYTES);
      if (randomBytes.length !== DATABASE_KEY_BYTES) {
        throw new Error("Could not generate a valid database encryption key.");
      }

      const newKey = bytesToHex(randomBytes);

      await SecureStore.setItemAsync(DATABASE_KEY_STORAGE_NAME, newKey, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });

      const savedKey = await SecureStore.getItemAsync(
        DATABASE_KEY_STORAGE_NAME,
      );

      if (savedKey !== newKey) {
        throw new Error("Could not verify the saved database encryption key.");
      }

      // Mark initialization only after the key has been saved and verified.
      await AsyncStorage.setItem(DATABASE_KEY_GUARD_STORAGE_NAME, "true");

      await SecureStore.setItemAsync(
        DATABASE_KEY_INITIALIZED_STORAGE_NAME,
        "true",
      );

      return newKey;
    })().catch((error: unknown) => {
      databaseKeyPromise = null;
      throw error;
    });
  }

  return databaseKeyPromise;
}
