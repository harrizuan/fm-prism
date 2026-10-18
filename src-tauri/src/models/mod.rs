use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Player {
    pub id: u32,
    pub first_name: String,
    pub last_name: String,
    pub common_name: String,
    pub age: u8,
    pub nationality: String,
    pub second_nationality: String,
    pub club_name: String,
    pub league_name: String,
    pub current_ability: i16,
    pub potential_ability: i16,
    pub reputation: u32,
    pub home_reputation: u16,
    pub current_reputation: u16,
    pub world_reputation: u16,
    pub value: u64,
    pub wage: u32,
    pub asking_price: u64,
    pub release_clause: u64,
    pub natural_position: String,
    pub preferred_foot: String,
    pub contract_expiry: String,
    pub transfer_status: String,
    pub is_on_loan: bool,
    pub is_listed: bool,
    pub morale: u8,
    pub happiness: u8,
    pub height: u16,
    pub squad_number: u8,
    pub condition: u16,
    pub form: f32,
    pub fitness: f32,
    pub weight: u16,
    pub left_foot: u8,
    pub right_foot: u8,
    pub international_caps: u16,
    pub international_goals: u16,
    pub technical: TechnicalAttributes,
    pub mental: MentalAttributes,
    pub physical: PhysicalAttributes,
    pub hidden: HiddenAttributes,
    pub goalkeeping: GoalkeepingAttributes,
    pub positions: PositionMap,
}

impl Player {
    pub fn display_name(&self) -> String {
        if !self.common_name.is_empty() {
            self.common_name.clone()
        } else if !self.last_name.is_empty() {
            if !self.first_name.is_empty() {
                format!("{} {}", self.first_name, self.last_name)
            } else {
                self.last_name.clone()
            }
        } else {
            self.first_name.clone()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TechnicalAttributes {
    pub corners: u8,
    pub crossing: u8,
    pub dribbling: u8,
    pub finishing: u8,
    pub first_touch: u8,
    pub free_kick: u8,
    pub heading: u8,
    pub long_shots: u8,
    pub long_throws: u8,
    pub marking: u8,
    pub passing: u8,
    pub penalty: u8,
    pub tackling: u8,
    pub technique: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MentalAttributes {
    pub aggression: u8,
    pub anticipation: u8,
    pub bravery: u8,
    pub composure: u8,
    pub concentration: u8,
    pub creativity: u8,
    pub decisions: u8,
    pub determination: u8,
    pub flair: u8,
    pub leadership: u8,
    pub off_the_ball: u8,
    pub positioning: u8,
    pub teamwork: u8,
    pub vision: u8,
    pub work_rate: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PhysicalAttributes {
    pub acceleration: u8,
    pub agility: u8,
    pub balance: u8,
    pub jumping: u8,
    pub natural_fitness: u8,
    pub pace: u8,
    pub stamina: u8,
    pub strength: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HiddenAttributes {
    pub adaptability: u8,
    pub ambition: u8,
    pub controversy: u8,
    pub loyalty: u8,
    pub pressure: u8,
    pub professionalism: u8,
    pub sportsmanship: u8,
    pub temperament: u8,
    pub consistency: u8,
    pub dirtiness: u8,
    pub important_matches: u8,
    pub injury_proneness: u8,
    pub versatility: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GoalkeepingAttributes {
    pub aerial_reach: u8,
    pub command_of_area: u8,
    pub communication: u8,
    pub eccentricity: u8,
    pub handling: u8,
    pub kicking: u8,
    pub one_on_ones: u8,
    pub punching: u8,
    pub reflexes: u8,
    pub rushing_out: u8,
    pub throwing: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PositionMap {
    pub goalkeeper: u8,
    pub sweeper: u8,
    pub defender_central: u8,
    pub defender_left: u8,
    pub defender_right: u8,
    pub wing_back_left: u8,
    pub wing_back_right: u8,
    pub defensive_midfielder: u8,
    pub midfielder_central: u8,
    pub midfielder_left: u8,
    pub midfielder_right: u8,
    pub attacking_midfielder: u8,
    pub winger_left: u8,
    pub winger_right: u8,
    pub striker: u8,
}

impl PositionMap {
    pub fn best_position(&self) -> &str {
        let positions = [
            (self.goalkeeper, "GK"),
            (self.sweeper, "SW"),
            (self.defender_central, "DC"),
            (self.defender_left, "DL"),
            (self.defender_right, "DR"),
            (self.wing_back_left, "WBL"),
            (self.wing_back_right, "WBR"),
            (self.defensive_midfielder, "DM"),
            (self.midfielder_central, "MC"),
            (self.midfielder_left, "ML"),
            (self.midfielder_right, "MR"),
            (self.attacking_midfielder, "AMC"),
            (self.winger_left, "AML"),
            (self.winger_right, "AMR"),
            (self.striker, "ST"),
        ];
        positions.iter().max_by_key(|(v, _)| *v).map(|(_, n)| *n).unwrap_or("?")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Club {
    pub id: u32,
    pub name: String,
    pub nation: String,
    pub league: String,
    pub reputation: u32,
    pub balance: i64,
    pub transfer_budget: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nation {
    pub id: u32,
    pub name: String,
    pub reputation: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameInfo {
    pub connected: bool,
    pub process_id: u32,
    pub window_title: String,
    pub game_version: String,
    pub build_number: u32,
    pub player_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ManagerProfile {
    pub name: String,
    pub club_name: String,
    pub nationality: String,
    pub club_reputation: u16,
    pub league_name: String,
    pub squad_size: usize,
    pub squad_avg_ca: f32,
    pub squad_avg_age: f32,
    pub squad_avg_world_rep: f32,
    pub squad_total_value: u64,
    pub squad_total_wage: u64,
    pub squad_highest_wage: u32,
    pub game_year: u16,
    pub national_team_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadProgress {
    pub stage: String,
    pub current: usize,
    pub total: usize,
    pub message: String,
}
