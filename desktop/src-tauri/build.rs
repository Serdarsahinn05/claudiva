fn main() {
    // Uygulama komutları için izin üretilir (`allow-<komut>`). Liste verilince
    // komutlar artık varsayılan olarak AÇIK değildir; her biri bir yetenek
    // dosyasında açıkça verilmeli. Böylece localhost'taki panel yalnız
    // `switch_project`i çağırabilir, sunucu başlatan komutları çağıramaz.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "node_version",
            "recent_projects",
            "forget_project",
            "open_project",
            "switch_project",
        ]),
    ))
    .expect("failed to run tauri-build");
}
