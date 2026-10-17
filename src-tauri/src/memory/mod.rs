use std::ffi::c_void;
use std::mem;
use windows::Win32::Foundation::*;
use windows::Win32::System::Diagnostics::Debug::*;
use windows::Win32::System::Diagnostics::ToolHelp::*;
use windows::Win32::System::Memory::*;
use windows::Win32::System::Threading::*;
use windows::Win32::UI::WindowsAndMessaging::*;

pub struct ProcessHandle {
    pub handle: HANDLE,
    pub pid: u32,
    pub base_address: usize,
    pub module_size: usize,
    pub window_title: String,
    pub game_plugin_base: usize,
    pub game_plugin_size: usize,
}

impl Drop for ProcessHandle {
    fn drop(&mut self) {
        if !self.handle.is_invalid() {
            unsafe { let _ = CloseHandle(self.handle); }
        }
    }
}

unsafe impl Send for ProcessHandle {}
unsafe impl Sync for ProcessHandle {}

struct EnumState {
    pid: u32,
    title: String,
    found: bool,
}

pub fn find_fm_process() -> std::result::Result<(u32, String), String> {
    let mut state = EnumState { pid: 0, title: String::new(), found: false };

    unsafe {
        let _ = EnumWindows(
            Some(enum_window_callback),
            LPARAM(&mut state as *mut EnumState as isize),
        );
    }

    if state.found {
        Ok((state.pid, state.title))
    } else {
        Err("Football Manager process not found. Is FM26 running?".into())
    }
}

unsafe extern "system" fn enum_window_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let mut title_buf = [0u16; 512];
    let len = GetWindowTextW(hwnd, &mut title_buf);
    if len > 0 {
        let title = String::from_utf16_lossy(&title_buf[..len as usize]);
        if title.contains("Football Manager") && !title.contains("Scout") && !title.contains("Editor") {
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid != 0 {
                let state = &mut *(lparam.0 as *mut EnumState);
                state.pid = pid;
                state.title = title;
                state.found = true;
                return BOOL(0);
            }
        }
    }
    BOOL(1)
}

pub fn open_process(pid: u32) -> std::result::Result<HANDLE, String> {
    let flags = PROCESS_VM_READ | PROCESS_QUERY_INFORMATION;
    match unsafe { OpenProcess(flags, false, pid) } {
        Ok(h) => {
            log::info!("OpenProcess succeeded with VM_READ | QUERY_INFO");
            Ok(h)
        }
        Err(e) => {
            log::warn!("OpenProcess with QUERY_INFO failed: {}, trying VM_READ only", e);
            match unsafe { OpenProcess(PROCESS_VM_READ, false, pid) } {
                Ok(h) => {
                    log::info!("OpenProcess succeeded with VM_READ only");
                    Ok(h)
                }
                Err(e2) => {
                    Err(format!(
                        "Cannot open FM process (PID {}). Try running as Administrator. Error: {}",
                        pid, e2
                    ))
                }
            }
        }
    }
}

pub fn find_module_by_name(pid: u32, target_name: &str) -> std::result::Result<(usize, usize), String> {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid)
            .map_err(|e| format!("CreateToolhelp32Snapshot failed: {}", e))?;

        let mut entry = MODULEENTRY32W {
            dwSize: mem::size_of::<MODULEENTRY32W>() as u32,
            ..Default::default()
        };

        if Module32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let module_name = String::from_utf16_lossy(
                    &entry.szModule[..entry.szModule.iter().position(|&c| c == 0).unwrap_or(0)]
                );
                if module_name.eq_ignore_ascii_case(target_name) {
                    log::info!(
                        "Found module: {} at 0x{:X}, size: {} MB",
                        module_name,
                        entry.modBaseAddr as usize,
                        entry.modBaseSize / (1024 * 1024)
                    );
                    let _ = CloseHandle(snapshot);
                    return Ok((entry.modBaseAddr as usize, entry.modBaseSize as usize));
                }
                if Module32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
        Err(format!("Module '{}' not found in process {}", target_name, pid))
    }
}

pub fn get_module_base(pid: u32) -> std::result::Result<(usize, usize), String> {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid)
            .map_err(|e| format!("CreateToolhelp32Snapshot failed: {}", e))?;

        let mut entry = MODULEENTRY32W {
            dwSize: mem::size_of::<MODULEENTRY32W>() as u32,
            ..Default::default()
        };

        if Module32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let module_name = String::from_utf16_lossy(
                    &entry.szModule[..entry.szModule.iter().position(|&c| c == 0).unwrap_or(0)]
                );
                let name_lower = module_name.to_lowercase();
                if (name_lower.starts_with("fm") || name_lower.contains("football"))
                    && name_lower.ends_with(".exe")
                {
                    log::info!(
                        "Found FM module: {} at 0x{:X}, size: {} MB",
                        module_name,
                        entry.modBaseAddr as usize,
                        entry.modBaseSize / (1024 * 1024)
                    );
                    let _ = CloseHandle(snapshot);
                    return Ok((entry.modBaseAddr as usize, entry.modBaseSize as usize));
                }
                if Module32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
        Err("Could not find FM module base address".into())
    }
}

pub fn attach_to_fm() -> std::result::Result<ProcessHandle, String> {
    log::info!("Searching for Football Manager process...");
    let (pid, title) = find_fm_process()?;
    log::info!("Found FM: PID={}, Title=\"{}\"", pid, title);

    let handle = open_process(pid)?;
    log::info!("Process opened successfully");

    let (base, size) = get_module_base(pid).unwrap_or_else(|e| {
        log::warn!("Module base not found: {} — will scan without base offset", e);
        (0, 0)
    });

    let (gp_base, gp_size) = find_module_by_name(pid, "game_plugin.dll").unwrap_or_else(|e| {
        log::warn!("game_plugin.dll not found: {} — signature scan unavailable", e);
        (0, 0)
    });

    if gp_base > 0 {
        log::info!("game_plugin.dll at 0x{:X}, size: {} MB", gp_base, gp_size / (1024 * 1024));
    }

    Ok(ProcessHandle {
        handle,
        pid,
        base_address: base,
        module_size: size,
        window_title: title,
        game_plugin_base: gp_base,
        game_plugin_size: gp_size,
    })
}

// --- Memory reading primitives ---

pub fn read_memory(handle: HANDLE, address: usize, size: usize) -> std::result::Result<Vec<u8>, String> {
    let mut buffer = vec![0u8; size];
    let mut bytes_read = 0usize;
    unsafe {
        ReadProcessMemory(
            handle,
            address as *const c_void,
            buffer.as_mut_ptr() as *mut c_void,
            size,
            Some(&mut bytes_read),
        ).map_err(|e| format!("ReadProcessMemory at 0x{:X}: {}", address, e))?;
    }
    buffer.truncate(bytes_read);
    Ok(buffer)
}

pub fn read_u8(handle: HANDLE, address: usize) -> std::result::Result<u8, String> {
    let buf = read_memory(handle, address, 1)?;
    if buf.is_empty() { return Err("Empty read".into()); }
    Ok(buf[0])
}

pub fn read_i16(handle: HANDLE, address: usize) -> std::result::Result<i16, String> {
    let buf = read_memory(handle, address, 2)?;
    if buf.len() < 2 { return Err("Short read".into()); }
    Ok(i16::from_le_bytes([buf[0], buf[1]]))
}

pub fn read_u16(handle: HANDLE, address: usize) -> std::result::Result<u16, String> {
    let buf = read_memory(handle, address, 2)?;
    if buf.len() < 2 { return Err("Short read".into()); }
    Ok(u16::from_le_bytes([buf[0], buf[1]]))
}

pub fn read_i32(handle: HANDLE, address: usize) -> std::result::Result<i32, String> {
    let buf = read_memory(handle, address, 4)?;
    if buf.len() < 4 { return Err("Short read".into()); }
    Ok(i32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]))
}

pub fn read_u32(handle: HANDLE, address: usize) -> std::result::Result<u32, String> {
    let buf = read_memory(handle, address, 4)?;
    if buf.len() < 4 { return Err("Short read".into()); }
    Ok(u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]))
}

pub fn read_u64(handle: HANDLE, address: usize) -> std::result::Result<u64, String> {
    let buf = read_memory(handle, address, 8)?;
    if buf.len() < 8 { return Err("Short read".into()); }
    Ok(u64::from_le_bytes([buf[0], buf[1], buf[2], buf[3], buf[4], buf[5], buf[6], buf[7]]))
}

pub fn read_f32(handle: HANDLE, address: usize) -> std::result::Result<f32, String> {
    let buf = read_memory(handle, address, 4)?;
    if buf.len() < 4 { return Err("Short read".into()); }
    Ok(f32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]))
}

pub fn read_ptr(handle: HANDLE, address: usize) -> std::result::Result<usize, String> {
    let val = read_u64(handle, address)?;
    Ok(val as usize)
}

/// Read FM26 length-prefixed string: [u32 length][UTF-8 bytes]
pub fn read_length_prefixed_string(handle: HANDLE, address: usize) -> String {
    if address < 0x10000 { return String::new(); }
    let length = match read_u32(handle, address) {
        Ok(n) if n > 0 && n <= 192 => n as usize,
        _ => return String::new(),
    };
    let bytes = match read_memory(handle, address + 4, length) {
        Ok(b) => b,
        Err(_) => return String::new(),
    };
    match String::from_utf8(bytes) {
        Ok(s) if !s.chars().any(char::is_control) => s,
        _ => String::new(),
    }
}

/// Dereference a pointer then read the length-prefixed string at the target
pub fn read_fm_string(handle: HANDLE, ptr_address: usize) -> String {
    let str_addr = match read_ptr(handle, ptr_address) {
        Ok(p) if p > 0x10000 => p,
        _ => return String::new(),
    };
    // Try direct length-prefixed string first
    let direct = read_length_prefixed_string(handle, str_addr);
    if !direct.is_empty() && direct.len() >= 2 { return direct; }
    // FM26 IL2CPP build: double indirection — ptr_address → container → string_ptr → string
    let actual_str = match read_ptr(handle, str_addr) {
        Ok(p) if p > 0x10000 => p,
        _ => return direct,
    };
    read_length_prefixed_string(handle, actual_str)
}

pub fn read_string_at(handle: HANDLE, address: usize, max_len: usize) -> String {
    let buf = match read_memory(handle, address, max_len) {
        Ok(b) => b,
        Err(_) => return String::new(),
    };
    let end = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
    if end > 0 {
        let s = String::from_utf8_lossy(&buf[..end]).to_string();
        if !s.is_empty() && s.chars().all(|c| !c.is_control() || c == ' ') {
            return s;
        }
    }
    String::new()
}

pub fn read_wstring_at(handle: HANDLE, address: usize, max_chars: usize) -> String {
    let buf = match read_memory(handle, address, max_chars * 2) {
        Ok(b) => b,
        Err(_) => return String::new(),
    };
    let u16_buf: Vec<u16> = buf.chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .take_while(|&c| c != 0)
        .collect();
    if u16_buf.is_empty() { return String::new(); }
    String::from_utf16_lossy(&u16_buf)
}

pub fn read_string_ptr(handle: HANDLE, ptr_address: usize, max_len: usize) -> String {
    let str_ptr = match read_ptr(handle, ptr_address) {
        Ok(p) if p > 0x10000 => p,
        _ => return String::new(),
    };
    let ws = read_wstring_at(handle, str_ptr, max_len / 2);
    if !ws.is_empty() && ws.len() > 1 {
        return ws;
    }
    read_string_at(handle, str_ptr, max_len)
}

pub fn resolve_pointer_chain(handle: HANDLE, base: usize, offsets: &[usize]) -> std::result::Result<usize, String> {
    let mut addr = base;
    for (i, &offset) in offsets.iter().enumerate() {
        if i < offsets.len() - 1 {
            addr = read_ptr(handle, addr + offset)?;
            if addr == 0 || addr < 0x10000 {
                return Err(format!("Null/invalid pointer at step {} (offset 0x{:X})", i, offset));
            }
        } else {
            addr += offset;
        }
    }
    Ok(addr)
}

pub fn scan_memory_regions(handle: HANDLE) -> Vec<(usize, usize)> {
    let mut regions = Vec::new();
    let mut address: usize = 0x10000;

    loop {
        let mut mbi = MEMORY_BASIC_INFORMATION::default();
        let result = unsafe {
            VirtualQueryEx(
                handle,
                Some(address as *const c_void),
                &mut mbi,
                mem::size_of::<MEMORY_BASIC_INFORMATION>(),
            )
        };

        if result == 0 {
            break;
        }

        if mbi.State == MEM_COMMIT
            && (mbi.Protect == PAGE_READWRITE
                || mbi.Protect == PAGE_READONLY
                || mbi.Protect == PAGE_EXECUTE_READ
                || mbi.Protect == PAGE_EXECUTE_READWRITE
                || mbi.Protect == PAGE_WRITECOPY)
        {
            regions.push((mbi.BaseAddress as usize, mbi.RegionSize));
        }

        let next = mbi.BaseAddress as usize + mbi.RegionSize;
        if next <= address {
            break;
        }
        address = next;
    }

    regions
}

/// Scan private (heap/stack) memory regions only — excludes mapped/image memory
pub fn scan_private_regions(handle: HANDLE, max_bytes: usize) -> Vec<(usize, usize)> {
    let mut regions = Vec::new();
    let mut address: usize = 0x10000;
    let mut total = 0usize;

    loop {
        let mut mbi = MEMORY_BASIC_INFORMATION::default();
        let result = unsafe {
            VirtualQueryEx(
                handle,
                Some(address as *const c_void),
                &mut mbi,
                mem::size_of::<MEMORY_BASIC_INFORMATION>(),
            )
        };

        if result == 0 { break; }

        let is_private_committed = mbi.State == MEM_COMMIT
            && mbi.Type == PAGE_TYPE(0x20000) // MEM_PRIVATE
            && (mbi.Protect.0 & 0x01 == 0)  // not PAGE_NOACCESS
            && (mbi.Protect.0 & 0x100 == 0); // not PAGE_GUARD

        if is_private_committed && total + mbi.RegionSize <= max_bytes {
            regions.push((mbi.BaseAddress as usize, mbi.RegionSize));
            total += mbi.RegionSize;
        }

        let next = mbi.BaseAddress as usize + mbi.RegionSize;
        if next <= address { break; }
        address = next;
    }

    regions
}

/// Scan a data buffer for a byte pattern with wildcard support
pub fn scan_data_for_pattern(data: &[u8], pattern: &[Option<u8>]) -> Vec<usize> {
    let mut results = Vec::new();
    let pat_len = pattern.len();
    if data.len() < pat_len || pat_len == 0 {
        return results;
    }

    for i in 0..=data.len() - pat_len {
        let matched = pattern.iter().enumerate().all(|(j, expected)| {
            expected.is_none() || *expected == Some(data[i + j])
        });
        if matched {
            results.push(i);
        }
    }
    results
}

pub fn scan_for_pattern(handle: HANDLE, regions: &[(usize, usize)], pattern: &[Option<u8>]) -> Vec<usize> {
    let mut results = Vec::new();
    let pat_len = pattern.len();

    for &(base, size) in regions {
        if size > 50_000_000 || size < pat_len {
            continue;
        }
        let data = match read_memory(handle, base, size) {
            Ok(d) => d,
            Err(_) => continue,
        };
        for offset in scan_data_for_pattern(&data, pattern) {
            results.push(base + offset);
        }
    }

    results
}
