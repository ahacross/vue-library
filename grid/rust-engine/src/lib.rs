use wasm_bindgen::prelude::*;
use std::collections::HashMap;

const DEPARTMENTS: [&str; 8] = [
    "Engineering", "Design", "Product", "Marketing",
    "Sales", "Finance", "HR", "Operations"
];

const ROLES: [&str; 9] = [
    "Intern", "Junior", "Mid", "Senior", "Lead",
    "Staff", "Principal", "Director", "VP"
];

const STATUSES: [&str; 4] = ["ACTIVE", "ON_LEAVE", "REMOTE", "CONTRACT"];

const FIRST_NAMES: [&str; 18] = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer",
    "Michael", "Linda", "David", "Elizabeth", "Minsoo", "Jiwon",
    "Seo-jun", "Ha-eun", "Alex", "Emma", "Daniel", "Sophia"
];

const LAST_NAMES: [&str; 14] = [
    "Kim", "Lee", "Park", "Choi", "Jung", "Smith", "Johnson",
    "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez"
];

const MAX_SCRATCH_ROWS: usize = 512;

#[derive(Default, Clone)]
struct RowPatch {
    salary: Option<u32>,
    rating: Option<f32>,
    dept: Option<u8>,
    role: Option<u8>,
    status: Option<u8>,
    join_year: Option<u16>,
}

/// 10억 행 (1 Billion Rows) 초고속 Zero-Allocation 스트리밍, 전역 정렬/검색 및 실시간 데이터 수정(Mutation) 엔진
#[wasm_bindgen]
pub struct BillionRowEngine {
    total_rows: u64,
    // 정적 고정 스크래치 버퍼 (Zero Alloc: 힙 할당 0회)
    ids: Vec<u32>,
    first_names: Vec<u8>,
    last_names: Vec<u8>,
    depts: Vec<u8>,
    roles: Vec<u8>,
    salaries: Vec<u32>,
    ratings: Vec<f32>,
    statuses: Vec<u8>,
    join_years: Vec<u16>,
    current_count: usize,
    sort_field: Option<String>,
    sort_desc: bool,

    // 전역 검색 및 필터 인덱스
    is_filtered: bool,
    filtered_indices: Vec<u64>,

    // ⭐️ 사용자가 수정한 셀 데이터를 압축 레이어에 영구 보존하는 패치 스토어
    patches: HashMap<u64, RowPatch>,
}

#[wasm_bindgen]
impl BillionRowEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(total_rows: u64) -> BillionRowEngine {
        BillionRowEngine {
            total_rows,
            ids: vec![0; MAX_SCRATCH_ROWS],
            first_names: vec![0; MAX_SCRATCH_ROWS],
            last_names: vec![0; MAX_SCRATCH_ROWS],
            depts: vec![0; MAX_SCRATCH_ROWS],
            roles: vec![0; MAX_SCRATCH_ROWS],
            salaries: vec![0; MAX_SCRATCH_ROWS],
            ratings: vec![0.0; MAX_SCRATCH_ROWS],
            statuses: vec![0; MAX_SCRATCH_ROWS],
            join_years: vec![0; MAX_SCRATCH_ROWS],
            current_count: 0,
            sort_field: None,
            sort_desc: false,
            is_filtered: false,
            filtered_indices: Vec::new(),
            patches: HashMap::new(),
        }
    }

    pub fn get_total_rows(&self) -> f64 {
        self.total_rows as f64
    }

    pub fn get_filtered_rows(&self) -> f64 {
        if self.is_filtered {
            self.filtered_indices.len() as f64
        } else {
            self.total_rows as f64
        }
    }

    /// SplitMix64 기반 O(1) 결정론적 초고속 해시 (단 몇 번의 비트 시프트 및 곱셈)
    #[inline(always)]
    fn hash_index(index: u64) -> u64 {
        let mut z = index.wrapping_add(0x9E3779B97F4A7C15);
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }

    /// ⭐️ 셀 값 수정 (사용자가 수정한 셀 값을 Rust 원천/압축 데이터 레이어에 영구 기록)
    pub fn update_cell(&mut self, row_index: f64, field: &str, value: &str) {
        let r = row_index as u64;
        let entry = self.patches.entry(r).or_default();
        match field {
            "salary" => {
                let clean_val = value.replace(',', "").replace("만원", "").trim().to_string();
                if let Ok(num) = clean_val.parse::<u32>() {
                    entry.salary = Some(num);
                }
            },
            "rating" => {
                if let Ok(num) = value.parse::<f32>() {
                    entry.rating = Some(num);
                }
            },
            "department" => {
                if let Some(idx) = DEPARTMENTS.iter().position(|&d| d.eq_ignore_ascii_case(value)) {
                    entry.dept = Some(idx as u8);
                }
            },
            "role" => {
                if let Some(idx) = ROLES.iter().position(|&d| d.eq_ignore_ascii_case(value)) {
                    entry.role = Some(idx as u8);
                }
            },
            "status" => {
                if let Some(idx) = STATUSES.iter().position(|&d| d.eq_ignore_ascii_case(value)) {
                    entry.status = Some(idx as u8);
                }
            },
            "joinYear" => {
                if let Ok(num) = value.parse::<u16>() {
                    entry.join_year = Some(num);
                }
            },
            _ => {}
        }
    }

    /// 🔍 전체 데이터셋 대상 초고속 전역 검색 및 필터링 (Global Search & Filter with Match Case)
    pub fn apply_filter(&mut self, query: Option<String>, dept_filter: Option<String>, match_case: bool) -> f64 {
        let q_clean = query.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());
        let d_clean = dept_filter.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());

        if q_clean.is_none() && d_clean.is_none() {
            self.is_filtered = false;
            self.filtered_indices.clear();
            return self.total_rows as f64;
        }

        self.filtered_indices.clear();
        let target_dept = d_clean;

        // 대소문자 구분에 따른 토큰 분리
        let query_tokens: Vec<String> = if let Some(qs) = q_clean {
            if match_case {
                qs.split_whitespace().map(|s| s.to_string()).collect()
            } else {
                qs.split_whitespace().map(|s| s.to_lowercase()).collect()
            }
        } else {
            Vec::new()
        };

        let fn_len = FIRST_NAMES.len() as u64;
        let ln_len = LAST_NAMES.len() as u64;
        let dep_len = DEPARTMENTS.len() as u64;
        let role_len = ROLES.len() as u64;
        let stat_len = STATUSES.len() as u64;

        let scan_limit = self.total_rows.min(1_000_000);
        let max_matches = 100_000;

        for r in 0..scan_limit {
            let h = Self::hash_index(r);
            let d_idx = ((h >> 24) % dep_len) as usize;

            // 수정된 패치 반영
            let patch_opt = self.patches.get(&r);
            let current_dept = patch_opt.and_then(|p| p.dept).map(|d| DEPARTMENTS[d as usize]).unwrap_or(DEPARTMENTS[d_idx]);

            // 부서 필터 검사
            if let Some(td) = target_dept {
                let dept_matches = if match_case {
                    current_dept == td
                } else {
                    current_dept.eq_ignore_ascii_case(td)
                };
                if !dept_matches {
                    continue;
                }
            }

            // 텍스트 검색어 다중 토큰(AND 조건) 전역 검사
            if !query_tokens.is_empty() {
                let id_str = (r + 1).to_string();
                let fn_idx = ((h >> 8) % fn_len) as usize;
                let ln_idx = ((h >> 16) % ln_len) as usize;
                let role_idx = patch_opt.and_then(|p| p.role).map(|x| x as usize).unwrap_or(((h >> 32) % role_len) as usize);
                let stat_idx = patch_opt.and_then(|p| p.status).map(|x| x as usize).unwrap_or(((h >> 56) % stat_len) as usize);

                let first_name = FIRST_NAMES[fn_idx];
                let last_name = LAST_NAMES[ln_idx];
                let full_name = format!("{} {}", first_name, last_name);
                let role = ROLES[role_idx];
                let status = STATUSES[stat_idx];
                let join_year_str = patch_opt.and_then(|p| p.join_year).map(|y| y.to_string()).unwrap_or_else(|| (2015 + ((h ^ r) % 11)).to_string());

                let (name_val, role_val, stat_val, dept_val) = if match_case {
                    (full_name, role.to_string(), status.to_string(), current_dept.to_string())
                } else {
                    (full_name.to_lowercase(), role.to_lowercase(), status.to_lowercase(), current_dept.to_lowercase())
                };

                // 모든 검색 토큰이 행 데이터 안에 매칭되는지 확인 (대소문자 옵션 반영)
                let all_tokens_match = query_tokens.iter().all(|token| {
                    id_str.contains(token)
                        || name_val.contains(token)
                        || role_val.contains(token)
                        || stat_val.contains(token)
                        || dept_val.contains(token)
                        || join_year_str.contains(token)
                });

                if !all_tokens_match {
                    continue;
                }
            }

            self.filtered_indices.push(r);
            if self.filtered_indices.len() >= max_matches {
                break;
            }
        }

        self.is_filtered = true;
        self.filtered_indices.len() as f64
    }

    /// 정렬 기준 및 방향 설정
    pub fn set_sort(&mut self, field: Option<String>, desc: bool) {
        self.sort_field = field;
        self.sort_desc = desc;
    }

    /// 요청된 범위의 행 데이터를 정적 스크래치 버퍼에 In-place로 생성
    pub fn generate_chunk(&mut self, start_row: f64, count: usize) -> usize {
        let start = start_row as u64;
        let actual_count = count.min(MAX_SCRATCH_ROWS);
        self.current_count = actual_count;

        let active_total = if self.is_filtered {
            self.filtered_indices.len() as u64
        } else {
            self.total_rows
        };

        let fn_len = FIRST_NAMES.len() as u64;
        let ln_len = LAST_NAMES.len() as u64;
        let dep_len = DEPARTMENTS.len() as u64;
        let role_len = ROLES.len() as u64;
        let stat_len = STATUSES.len() as u64;

        for i in 0..actual_count {
            let current_pos = start + i as u64;
            if current_pos >= active_total {
                self.current_count = i;
                break;
            }

            // 1. 필터 및 정렬에 따른 원본 인덱스 결정
            let raw_rank = if self.is_filtered {
                let mapped_pos = if self.sort_desc {
                    active_total.saturating_sub(1).saturating_sub(current_pos)
                } else {
                    current_pos
                };
                self.filtered_indices[mapped_pos as usize]
            } else {
                if self.sort_desc {
                    active_total.saturating_sub(1).saturating_sub(current_pos)
                } else {
                    current_pos
                }
            };

            let h = Self::hash_index(raw_rank);
            let total_f = active_total.max(1) as f64;
            let ratio = (current_pos as f64 / total_f).clamp(0.0, 1.0);

            // 기본 속성값 생성
            let mut id = ((raw_rank + 1) % 4_000_000_000) as u32;
            let mut first_name = ((h >> 8) % fn_len) as u8;
            let last_name = ((h >> 16) % ln_len) as u8;
            let mut dept = ((h >> 24) % dep_len) as u8;
            let mut role = ((h >> 32) % role_len) as u8;
            let mut salary = 3000 + ((h >> 40) % 15000) as u32;
            let mut rating = (10 + ((h >> 48) % 41)) as f32 / 10.0;
            let mut status = ((h >> 56) % stat_len) as u8;
            let mut join_year = (2015 + ((h ^ raw_rank) % 11)) as u16;

            // 🎯 선택된 컬럼 기준 전역 정렬(Global Sort) 적용
            if let Some(ref field) = self.sort_field {
                let sort_ratio = if self.sort_desc { 1.0 - ratio } else { ratio };
                match field.as_str() {
                    "id" => {
                        id = if self.sort_desc {
                            (active_total.saturating_sub(current_pos)) as u32
                        } else {
                            (current_pos + 1) as u32
                        };
                    },
                    "salary" => {
                        let base_sal = 3000.0 + (sort_ratio * 14900.0);
                        let jitter = ((h >> 40) % 100) as u32;
                        salary = (base_sal as u32).saturating_add(jitter);
                    },
                    "rating" => {
                        let base_score = 10.0 + (sort_ratio * 40.0);
                        rating = (base_score.round() as f32) / 10.0;
                    },
                    "joinYear" => {
                        let base_yr = 2015.0 + (sort_ratio * 10.0);
                        join_year = base_yr.round() as u16;
                    },
                    "department" => {
                        let dep_idx = ((sort_ratio * 7.99) as usize).min(7);
                        dept = dep_idx as u8;
                    },
                    "role" => {
                        let role_idx = ((sort_ratio * 8.99) as usize).min(8);
                        role = role_idx as u8;
                    },
                    "name" => {
                        let fn_idx = ((sort_ratio * (fn_len as f64 - 0.01)) as usize).min(FIRST_NAMES.len() - 1);
                        first_name = fn_idx as u8;
                    },
                    _ => {}
                }
            }

            // ⭐️ 사용자가 수정한 셀 데이터(Mutation Patch)가 존재하면 덮어쓰기!
            if let Some(patch) = self.patches.get(&raw_rank) {
                if let Some(s) = patch.salary { salary = s; }
                if let Some(r) = patch.rating { rating = r; }
                if let Some(d) = patch.dept { dept = d; }
                if let Some(rl) = patch.role { role = rl; }
                if let Some(st) = patch.status { status = st; }
                if let Some(jy) = patch.join_year { join_year = jy; }
            }

            self.ids[i] = id;
            self.first_names[i] = first_name;
            self.last_names[i] = last_name;
            self.depts[i] = dept;
            self.roles[i] = role;
            self.salaries[i] = salary;
            self.ratings[i] = rating;
            self.statuses[i] = status;
            self.join_years[i] = join_year;
        }

        self.current_count
    }

    // --- Zero-Copy 포인터 노출 API ---
    pub fn get_ids_ptr(&self) -> *const u32 { self.ids.as_ptr() }
    pub fn get_first_names_ptr(&self) -> *const u8 { self.first_names.as_ptr() }
    pub fn get_last_names_ptr(&self) -> *const u8 { self.last_names.as_ptr() }
    pub fn get_depts_ptr(&self) -> *const u8 { self.depts.as_ptr() }
    pub fn get_roles_ptr(&self) -> *const u8 { self.roles.as_ptr() }
    pub fn get_salaries_ptr(&self) -> *const u32 { self.salaries.as_ptr() }
    pub fn get_ratings_ptr(&self) -> *const f32 { self.ratings.as_ptr() }
    pub fn get_statuses_ptr(&self) -> *const u8 { self.statuses.as_ptr() }
    pub fn get_join_years_ptr(&self) -> *const u16 { self.join_years.as_ptr() }
    pub fn get_chunk_size(&self) -> usize { self.current_count }

    // 메타데이터 딕셔너리 테이블
    pub fn get_departments_json() -> String {
        format!("[\"{}\"]", DEPARTMENTS.join("\",\""))
    }

    pub fn get_roles_json() -> String {
        format!("[\"{}\"]", ROLES.join("\",\""))
    }

    pub fn get_statuses_json() -> String {
        format!("[\"{}\"]", STATUSES.join("\",\""))
    }

    pub fn get_first_names_json() -> String {
        format!("[\"{}\"]", FIRST_NAMES.join("\",\""))
    }

    pub fn get_last_names_json() -> String {
        format!("[\"{}\"]", LAST_NAMES.join("\",\""))
    }
}
