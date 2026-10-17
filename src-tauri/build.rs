fn main() {
    // Force rebuild when dist/ changes
    println!("cargo:rerun-if-changed=../dist");
    tauri_build::build()
}
