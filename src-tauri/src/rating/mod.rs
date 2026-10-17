use serde::{Deserialize, Serialize};
use crate::models::Player;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleFormula {
    pub name: String,
    pub category: String,
    pub weights: Vec<(String, f32)>,
}

pub fn compute_role_rating(player: &Player, formula: &RoleFormula) -> f32 {
    let mut total = 0.0f32;
    let mut weight_sum = 0.0f32;

    for (attr, weight) in &formula.weights {
        let val = get_attribute_value(player, attr) as f32;
        total += val * weight;
        weight_sum += weight;
    }

    if weight_sum > 0.0 {
        (total / weight_sum) * 5.0 // Scale to 0-100
    } else {
        0.0
    }
}

pub fn get_attribute_value(player: &Player, attr: &str) -> u8 {
    match attr {
        "corners" => player.technical.corners,
        "crossing" => player.technical.crossing,
        "dribbling" => player.technical.dribbling,
        "finishing" => player.technical.finishing,
        "first_touch" => player.technical.first_touch,
        "free_kick" => player.technical.free_kick,
        "heading" => player.technical.heading,
        "long_shots" => player.technical.long_shots,
        "marking" => player.technical.marking,
        "passing" => player.technical.passing,
        "penalty" => player.technical.penalty,
        "tackling" => player.technical.tackling,
        "technique" => player.technical.technique,
        "aggression" => player.mental.aggression,
        "anticipation" => player.mental.anticipation,
        "bravery" => player.mental.bravery,
        "composure" => player.mental.composure,
        "concentration" => player.mental.concentration,
        "creativity" => player.mental.creativity,
        "decisions" => player.mental.decisions,
        "determination" => player.mental.determination,
        "flair" => player.mental.flair,
        "leadership" => player.mental.leadership,
        "off_the_ball" => player.mental.off_the_ball,
        "positioning" => player.mental.positioning,
        "teamwork" => player.mental.teamwork,
        "vision" => player.mental.vision,
        "work_rate" => player.mental.work_rate,
        "acceleration" => player.physical.acceleration,
        "agility" => player.physical.agility,
        "balance" => player.physical.balance,
        "jumping" => player.physical.jumping,
        "natural_fitness" => player.physical.natural_fitness,
        "pace" => player.physical.pace,
        "stamina" => player.physical.stamina,
        "strength" => player.physical.strength,
        _ => 0,
    }
}

pub fn get_builtin_formulas() -> Vec<RoleFormula> {
    vec![
        RoleFormula {
            name: "Advanced Forward (A)".into(),
            category: "Striker".into(),
            weights: vec![
                ("finishing".into(), 5.0), ("composure".into(), 4.0),
                ("first_touch".into(), 4.0), ("technique".into(), 3.0),
                ("off_the_ball".into(), 4.0), ("anticipation".into(), 3.0),
                ("decisions".into(), 3.0), ("dribbling".into(), 3.0),
                ("pace".into(), 3.0), ("acceleration".into(), 3.0),
            ],
        },
        RoleFormula {
            name: "Box-to-Box Midfielder (S)".into(),
            category: "Midfielder".into(),
            weights: vec![
                ("passing".into(), 4.0), ("tackling".into(), 4.0),
                ("stamina".into(), 5.0), ("work_rate".into(), 5.0),
                ("teamwork".into(), 4.0), ("decisions".into(), 3.0),
                ("first_touch".into(), 3.0), ("technique".into(), 3.0),
                ("anticipation".into(), 3.0), ("positioning".into(), 3.0),
            ],
        },
        RoleFormula {
            name: "Inverted Winger (A)".into(),
            category: "Winger".into(),
            weights: vec![
                ("dribbling".into(), 5.0), ("technique".into(), 4.0),
                ("acceleration".into(), 5.0), ("pace".into(), 4.0),
                ("agility".into(), 4.0), ("flair".into(), 3.0),
                ("finishing".into(), 3.0), ("long_shots".into(), 3.0),
                ("off_the_ball".into(), 3.0), ("first_touch".into(), 3.0),
            ],
        },
        RoleFormula {
            name: "Ball-Winning Midfielder (D)".into(),
            category: "Midfielder".into(),
            weights: vec![
                ("tackling".into(), 5.0), ("marking".into(), 4.0),
                ("aggression".into(), 4.0), ("anticipation".into(), 4.0),
                ("positioning".into(), 4.0), ("work_rate".into(), 4.0),
                ("stamina".into(), 3.0), ("strength".into(), 3.0),
                ("bravery".into(), 3.0), ("concentration".into(), 3.0),
            ],
        },
        RoleFormula {
            name: "Complete Forward (S)".into(),
            category: "Striker".into(),
            weights: vec![
                ("finishing".into(), 5.0), ("heading".into(), 4.0),
                ("first_touch".into(), 4.0), ("technique".into(), 4.0),
                ("composure".into(), 4.0), ("off_the_ball".into(), 4.0),
                ("passing".into(), 3.0), ("dribbling".into(), 3.0),
                ("strength".into(), 3.0), ("decisions".into(), 3.0),
            ],
        },
    ]
}
