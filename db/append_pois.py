pois = [
    # Mariánské Lázně
    ("Mariánské Lázně", "Zpívající fontána", "Unikátní fontána hrající světoznámé skladby.", "SIGHTSEEING", 30, 49.9765, 12.7068, "https://images.unsplash.com/photo-1543158021-3e3c0b0213d4?auto=format&fit=crop&w=400&q=80"),
    ("Mariánské Lázně", "Kolonáda Maxima Gorkého", "Hlavní lázeňská kolonáda s prameny.", "SIGHTSEEING", 60, 49.9772, 12.7075, "https://images.unsplash.com/photo-1572004245941-8608eb82f1b7?auto=format&fit=crop&w=400&q=80"),
    ("Mariánské Lázně", "Park Boheminium", "Miniatury významných českých památek.", "PARK", 120, 49.9720, 12.7180, "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80"),

    # Loket
    ("Loket", "Hrad Loket", "Gotický královský hrad tyčící se nad řekou Ohří.", "SIGHTSEEING", 120, 50.1873, 12.7540, "https://images.unsplash.com/photo-1584348003666-48c9038ba7b8?auto=format&fit=crop&w=400&q=80"),
    
    # Bečov nad Teplou
    ("Bečov nad Teplou", "Zámek Bečov a Relikviář sv. Maura", "Unikátní památka celoevropského významu.", "SIGHTSEEING", 90, 50.0847, 12.8392, "https://images.unsplash.com/photo-1590483864508-466d3cfc64a3?auto=format&fit=crop&w=400&q=80"),

    # Jáchymov
    ("Jáchymov", "Královská mincovna", "Muzeum mapující těžbu stříbra a ražbu tolarů.", "SIGHTSEEING", 60, 50.3662, 12.9135, "https://images.unsplash.com/photo-1555529902-5261145633bf?auto=format&fit=crop&w=400&q=80"),

    # Sokolov
    ("Sokolov", "Sokolovský zámek", "Klasicistní zámek v centru města.", "SIGHTSEEING", 60, 50.1805, 12.6415, "https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?auto=format&fit=crop&w=400&q=80"),

    # Karlovy Vary (další památky)
    ("Karlovy Vary", "Mlýnská kolonáda", "Největší z karlovarských kolonád se 124 sloupy.", "SIGHTSEEING", 45, 50.2255, 12.8805, "https://images.unsplash.com/photo-1563200925-8ba948b89417?auto=format&fit=crop&w=400&q=80"),

    # Františkovy Lázně
    ("Františkovy Lázně", "Socha Františka", "Symbol Františkových Lázní pro štěstí.", "SIGHTSEEING", 20, 50.1202, 12.3510, "https://images.unsplash.com/photo-1616428751515-3b95dc046cd4?auto=format&fit=crop&w=400&q=80")
]

sql_statements = []
for p in pois:
    loc_name, poi_name, desc, cat, dur, lat, lng, img = p
    sql = f"INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) " \
          f"VALUES ((SELECT id FROM locations WHERE name = '{loc_name}' LIMIT 1), '{poi_name}', '{desc}', '{cat}', {dur}, {lat}, {lng}, '{img}');\n"
    sql_statements.append(sql)

with open('c:/Users/sanco/OneDrive/Plocha/Hacaton/db/init.sql', 'a', encoding='utf-8') as f:
    f.writelines(sql_statements)

print("POIs appended to init.sql!")
