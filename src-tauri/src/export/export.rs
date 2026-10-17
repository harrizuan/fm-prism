use crate::models::Player;

pub fn to_html(players: &[Player]) -> String {
    let mut html = String::from(r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>FM Scout Pro Export</title>
<style>
body{font-family:system-ui;background:#0a0a0a;color:#fafafa;padding:20px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #333;padding:6px 10px;text-align:left;font-size:13px}
th{background:#1a472a;color:#fff;position:sticky;top:0}
tr:hover{background:#1c1c1c}
.attr{text-align:center}
</style></head><body>
<h1>FM Scout Pro — Player Export</h1>
<table><thead><tr>
<th>Name</th><th>Age</th><th>Pos</th><th>Club</th><th>CA</th><th>PA</th>
<th>Fin</th><th>Pas</th><th>Dri</th><th>Tac</th><th>Hea</th><th>Pac</th><th>Str</th>
</tr></thead><tbody>"#);

    for p in players {
        html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td class='attr'>{}</td><td class='attr'>{}</td>\
             <td class='attr'>{}</td><td class='attr'>{}</td><td class='attr'>{}</td>\
             <td class='attr'>{}</td><td class='attr'>{}</td><td class='attr'>{}</td><td class='attr'>{}</td></tr>",
            p.display_name(), p.age, p.natural_position, p.club_name,
            p.current_ability, p.potential_ability,
            p.technical.finishing, p.technical.passing, p.technical.dribbling,
            p.technical.tackling, p.technical.heading, p.physical.pace, p.physical.strength,
        ));
    }

    html.push_str("</tbody></table></body></html>");
    html
}

pub fn write_html(players: &[Player], path: &str) -> Result<(), String> {
    let html = to_html(players);
    std::fs::write(path, html).map_err(|e| e.to_string())
}
