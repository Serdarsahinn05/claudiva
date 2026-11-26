//! Claudiva masaüstü kabuğu.
//!
//! Kabuk paneli YENİDEN YAZMAZ: npm paketindeki sunucuyu (`bin/claudiva.js`)
//! kullanıcının kendi Node'uyla alt süreç olarak başlatır ve pencereyi o
//! sunucunun adresine götürür. Panel, CLI ile açılan panelin birebir aynısıdır.
//!
//! Akış: açılış ekranı (`desktop/launcher`) → proje klasörü seçilir →
//! `open_project` boş bir port bulur, sunucuyu başlatır, port dinlemeye
//! açılınca pencereyi `http://localhost:<port>/`a yönlendirir. Panelin üst
//! çubuğundaki "Proje değiştir" (`switch_project`) sunucuyu kapatıp açılış
//! ekranına döner.
//!
//! Pencerede Windows başlık çubuğu YOK (`decorations: false`): sürükleme ve
//! küçült/büyüt/kapat açılış ekranında `launcher/index.html`, panelde
//! `web/src/desktop.ts` + `WindowControls.tsx`. Panel localhost'tan geldiği
//! için yalnız `capabilities/panel.json`daki dar izinleri alır.
//!
//! Sunucu kapanışı stdin borusuyla yapılır: Windows'ta bir alt sürece SIGINT
//! gönderilemiyor, `kill` ise tamponlanmış yazımları (tasks.json, döküm)
//! kaybettirir. Boru kapanınca `bin/claudiva.js` sunucunun kendi düzgün
//! kapanışını tetikler. Kabuk çökerse de boru kapanır, sunucu öksüz kalmaz.

use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::{AppHandle, Manager, RunEvent, Url};

/// CLI'ın varsayılan portu; doluysa sıradaki denenir.
const FIRST_PORT: u16 = 4600;
const PORT_RANGE: u16 = 100;
const MAX_RECENT: usize = 8;
/// İlk açılışta sunucu ajan tanımlarını taşıyıp tohumlayabiliyor; cömert tut.
const START_TIMEOUT: Duration = Duration::from_secs(45);
/// Sunucunun kendi kapanışı en fazla 3 sn bekliyor (`server/src/index.ts`).
const STOP_TIMEOUT: Duration = Duration::from_secs(6);

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Default)]
struct Shell {
    server: Option<Child>,
    /// Açılış ekranının adresi (Windows'ta `http://tauri.localhost/`); geri
    /// dönüşte buraya gidilir.
    launcher: Option<Url>,
}

#[derive(Default)]
struct ShellState(Mutex<Shell>);

/// Sunucu dosyalarının kökü (içinde `bin/`, `server/dist`, `web/dist` var).
///
/// Geliştirmede deponun kendisi: `npm run build` sonrası CLI ile aynı dosyalar.
/// Paketlenmiş uygulamada kaynak klasöründeki `app/` (`scripts/prepare-app.mjs`).
fn claudiva_root(app: &AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
        return manifest
            .parent()
            .and_then(Path::parent)
            .map(Path::to_path_buf)
            .ok_or_else(|| "not_built".to_string());
    }
    let res = app.path().resource_dir().map_err(|e| e.to_string())?;
    Ok(plain_path(res.join("app")))
}

/// Windows'un `\\?\` önekini atar; Node betik yolunda bunu her yerde
/// sevmiyor ve günlükte okunmuyor.
fn plain_path(p: PathBuf) -> PathBuf {
    let s = p.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC") => PathBuf::from(rest),
        _ => p,
    }
}

fn node_command() -> Command {
    let mut cmd = Command::new("node");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Sistemdeki Node sürümü. Hata kodları açılış ekranında çevrilir:
/// `node_missing`, `node_old:<sürüm>`.
#[tauri::command]
fn node_version() -> Result<String, String> {
    let out = node_command()
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .map_err(|_| "node_missing".to_string())?;
    let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let major: u32 = version
        .trim_start_matches('v')
        .split('.')
        .next()
        .and_then(|m| m.parse().ok())
        .unwrap_or(0);
    // package.json `engines.node` ile aynı sınır.
    if major < 20 {
        return Err(format!("node_old:{version}"));
    }
    Ok(version)
}

fn recent_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("recent.json"))
}

fn read_recent(app: &AppHandle) -> Vec<String> {
    recent_file(app)
        .and_then(|f| fs::read_to_string(f).ok())
        // Elle (ör. PowerShell 5 ile) düzenlenmiş dosya BOM taşır; serde onu
        // reddedip listeyi sessizce boşaltıyordu (ölçüldü).
        .and_then(|s| serde_json::from_str::<Vec<String>>(s.trim_start_matches('\u{feff}')).ok())
        .unwrap_or_default()
}

fn write_recent(app: &AppHandle, list: &[String]) {
    if let Some(f) = recent_file(app) {
        if let Some(dir) = f.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(json) = serde_json::to_string_pretty(list) {
            let _ = fs::write(f, json);
        }
    }
}

/// Son açılan projeler; artık var olmayan klasörler listeden düşer.
#[tauri::command]
fn recent_projects(app: AppHandle) -> Vec<String> {
    read_recent(&app)
        .into_iter()
        .filter(|d| Path::new(d).is_dir())
        .collect()
}

#[tauri::command]
fn forget_project(app: AppHandle, dir: String) {
    let list: Vec<String> = read_recent(&app).into_iter().filter(|d| *d != dir).collect();
    write_recent(&app, &list);
}

fn remember(app: &AppHandle, dir: &str) {
    let mut list: Vec<String> = read_recent(app)
        .into_iter()
        .filter(|d| !d.eq_ignore_ascii_case(dir))
        .collect();
    list.insert(0, dir.to_string());
    list.truncate(MAX_RECENT);
    write_recent(app, &list);
}

/// Port boş mu? Sunucu `listen(port)` ile çift yığın dinliyor; IPv4 ve IPv6
/// ayrı ayrı denenir (yalnız birine bakmak, CLI'daki ölçülmüş hatanın aynısı:
/// IPv6'da tutulan port boş görünüyordu).
fn port_free(port: u16) -> bool {
    if TcpListener::bind(("0.0.0.0", port)).is_err() {
        return false;
    }
    if TcpListener::bind(("::", port)).is_err() {
        return false;
    }
    true
}

fn free_port() -> Option<u16> {
    (FIRST_PORT..FIRST_PORT + PORT_RANGE).find(|p| port_free(*p))
}

fn log_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("server.log"))
}

/// Günlüğün son kısmı: sunucu açılamazsa açılış ekranında gösterilir.
fn log_tail(path: &Path) -> String {
    let Ok(mut f) = File::open(path) else {
        return String::new();
    };
    let len = f.metadata().map(|m| m.len()).unwrap_or(0);
    let _ = f.seek(SeekFrom::Start(len.saturating_sub(2000)));
    let mut buf = Vec::new();
    let _ = f.read_to_end(&mut buf);
    String::from_utf8_lossy(&buf).trim().to_string()
}

fn kill_tree(child: &mut Child) {
    // Sunucunun açtığı ajan süreçleri (Claude Code) de ağacın içinde.
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

/// Önce düzgün kapanış (stdin kapanır), süre dolarsa ağacı öldür.
fn stop_server(mut child: Child) {
    drop(child.stdin.take());
    let deadline = Instant::now() + STOP_TIMEOUT;
    while Instant::now() < deadline {
        if let Ok(Some(_)) = child.try_wait() {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
    kill_tree(&mut child);
}

fn take_server(app: &AppHandle) -> Option<Child> {
    app.state::<ShellState>().0.lock().ok()?.server.take()
}

fn start_server(app: &AppHandle, dir: &str) -> Result<(), String> {
    let project = Path::new(dir);
    if !project.is_dir() {
        return Err("missing_dir".into());
    }
    let root = claudiva_root(app)?;
    let entry = root.join("bin").join("claudiva.js");
    if !entry.is_file() || !root.join("server").join("dist").join("index.js").is_file() {
        return Err("not_built".into());
    }

    if let Some(old) = take_server(app) {
        stop_server(old);
    }

    let port = free_port().ok_or_else(|| "no_port".to_string())?;
    let log = log_path(app)?;
    let out = File::create(&log).map_err(|e| e.to_string())?;
    let err = out.try_clone().map_err(|e| e.to_string())?;

    let mut child = node_command()
        .arg(&entry)
        .args(["--dir", dir, "--port", &port.to_string(), "--no-open"])
        .current_dir(project)
        .env("CLAUDIVA_DESKTOP", "1")
        .stdin(Stdio::piped())
        .stdout(out)
        .stderr(err)
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "node_missing".to_string()
            } else {
                format!("spawn:{e}")
            }
        })?;

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let deadline = Instant::now() + START_TIMEOUT;
    loop {
        if let Ok(Some(_)) = child.try_wait() {
            return Err(format!("exited:{}", log_tail(&log)));
        }
        if TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok() {
            break;
        }
        if Instant::now() > deadline {
            stop_server(child);
            return Err(format!("timeout:{}", log_tail(&log)));
        }
        thread::sleep(Duration::from_millis(150));
    }

    remember(app, dir);
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "no_window".to_string())?;
    if let Ok(mut s) = app.state::<ShellState>().0.lock() {
        s.server = Some(child);
        // Adres BURADA okunur: komutu açılış ekranı çağırdığına göre sayfa
        // kesin yüklü. `setup` anında okumak boş adres veriyordu ve "Proje
        // değiştir" sessizce hiçbir şey yapmıyordu (ölçüldü).
        if s.launcher.is_none() {
            s.launcher = window.url().ok();
        }
    }
    let name = project
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir.to_string());
    let _ = window.set_title(&format!("{name} · Claudiva"));
    let url = Url::parse(&format!("http://localhost:{port}/")).map_err(|e| e.to_string())?;
    window.navigate(url).map_err(|e| e.to_string())
}

/// Bekleme süresince (sunucu açılırken) açılış ekranı donmasın diye ayrı iş
/// parçacığında çalışır.
#[tauri::command]
async fn open_project(app: AppHandle, dir: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || start_server(&app, &dir))
        .await
        .map_err(|e| e.to_string())?
}

/// Sunucuyu kapatıp açılış ekranına döner.
fn back_to_launcher(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        let launcher = app
            .state::<ShellState>()
            .0
            .lock()
            .ok()
            .and_then(|s| s.launcher.clone());
        let Some(launcher) = launcher else { return };
        // Sayfa önce ayrılsın: sunucu kapanırken panel "bağlantı koptu" ekranına düşmesin.
        let _ = window.navigate(launcher);
        let _ = window.set_title("Claudiva");
        if let Some(child) = take_server(&app) {
            stop_server(child);
        }
    });
}

/// Panelin üst çubuğundaki "Proje değiştir" (web/src/desktop.ts). Pencerenin
/// yerel menüsü yok: Windows başlık çubuğu kaldırıldı (`decorations: false`),
/// menü kısayolları da panel odaktayken zaten hiç çalışmıyordu (ölçüldü:
/// klavye WebView2'nin kendi sürecine gidiyor).
#[tauri::command]
fn switch_project(app: AppHandle) {
    back_to_launcher(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ShellState::default())
        .invoke_handler(tauri::generate_handler![
            node_version,
            recent_projects,
            forget_project,
            open_project,
            switch_project
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            if let Some(child) = take_server(app) {
                stop_server(child);
            }
        }
    });
}
