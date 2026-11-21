package expo.modules.hrmsdownloadmanager

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HrmsDownloadManagerModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("HrmsDownloadManager")

    AsyncFunction("downloadPdf") {
      url: String,
      fileName: String,
      token: String ->

      val uri = Uri.parse(url)

      require(uri.scheme == "https" || uri.scheme == "http") {
        "Invalid download URL."
      }

      require(!uri.host.isNullOrBlank()) {
        "Invalid download host."
      }

      require(fileName.matches(Regex("[A-Za-z0-9._-]+\\.pdf", RegexOption.IGNORE_CASE))) {
        "Invalid PDF filename."
      }

      require(token.isNotBlank()) {
        "Authentication is required."
      }

      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable.")

      val downloadManager = context.getSystemService(
        Context.DOWNLOAD_SERVICE
      ) as? DownloadManager
        ?: throw IllegalStateException("Android Download Manager is unavailable.")

      val request = DownloadManager.Request(uri).apply {
        setTitle(fileName)
        setDescription("Downloading your EN-Time HR payslip")
        setMimeType("application/pdf")

        setNotificationVisibility(
          DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
        )

        setAllowedOverMetered(true)
        setAllowedOverRoaming(false)

        addRequestHeader("Accept", "application/pdf")
        addRequestHeader("Authorization", "Bearer $token")

        setDestinationInExternalPublicDir(
          Environment.DIRECTORY_DOWNLOADS,
          fileName
        )
      }

      downloadManager.enqueue(request).toString()
    }
  }
}