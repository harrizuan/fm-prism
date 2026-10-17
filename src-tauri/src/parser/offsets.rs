use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OffsetConfig {
    pub game: String,
    pub build: u32,
    pub platform: String,
    pub version_string_offsets: Option<Vec<usize>>,
    pub base_signature: Option<String>,
    pub base_offset: Option<String>,
    pub pointers: PointerConfig,
    pub player: EntityOffsets,
    pub club: Option<EntityOffsets>,
    pub nation: Option<EntityOffsets>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointerConfig {
    pub player_list: Vec<usize>,
    pub club_list: Option<Vec<usize>>,
    pub nation_list: Option<Vec<usize>>,
    pub league_list: Option<Vec<usize>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityOffsets {
    pub struct_size: Option<usize>,
    pub list_count_offset: Option<usize>,
    pub next_ptr_offset: Option<usize>,
    pub fields: HashMap<String, FieldOffset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldOffset {
    pub offset: String,
    #[serde(rename = "type")]
    pub field_type: String,
}

impl FieldOffset {
    pub fn offset_val(&self) -> usize {
        usize::from_str_radix(self.offset.trim_start_matches("0x"), 16).unwrap_or(0)
    }
}

pub fn load_offset_config(offsets_dir: &Path, build_number: u32) -> Option<OffsetConfig> {
    // Try exact build match first
    let exact_path = offsets_dir.join(format!("fm26_build_{}.json", build_number));
    if exact_path.exists() {
        if let Ok(content) = fs::read_to_string(&exact_path) {
            if let Ok(config) = serde_json::from_str::<OffsetConfig>(&content) {
                return Some(config);
            }
        }
    }

    // Try default/generic config
    let default_path = offsets_dir.join("fm26_default.json");
    if default_path.exists() {
        if let Ok(content) = fs::read_to_string(&default_path) {
            if let Ok(config) = serde_json::from_str::<OffsetConfig>(&content) {
                return Some(config);
            }
        }
    }

    None
}

pub fn parse_signature(sig_str: &str) -> Vec<Option<u8>> {
    sig_str
        .split_whitespace()
        .map(|byte| {
            if byte == "??" {
                None
            } else {
                Some(u8::from_str_radix(byte, 16).unwrap_or(0))
            }
        })
        .collect()
}
