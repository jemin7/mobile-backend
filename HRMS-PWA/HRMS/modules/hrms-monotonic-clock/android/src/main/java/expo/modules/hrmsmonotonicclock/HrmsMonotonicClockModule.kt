package expo.modules.hrmsmonotonicclock

import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HrmsMonotonicClockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HrmsMonotonicClock")

    Function("getMonotonicTimeMs") {
      SystemClock.elapsedRealtime().toDouble()
    }

    Function("getBootCount") {
      val context = appContext.reactContext

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && context != null) {
        Settings.Global.getInt(
          context.contentResolver,
          Settings.Global.BOOT_COUNT,
          -1
        )
      } else {
        -1
      }
    }
  }
}
