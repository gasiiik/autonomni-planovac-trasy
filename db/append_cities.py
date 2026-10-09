cities = [
('Abertamy', 50.368, 12.818), ('Bečov nad Teplou', 50.084, 12.839), ('Bochov', 50.149, 13.048),
('Boží Dar', 50.410, 12.923), ('Horní Blatná', 50.390, 12.771), ('Hroznětín', 50.309, 12.873),
('Chyše', 50.106, 13.254), ('Jáchymov', 50.361, 12.929), ('Nejdek', 50.324, 12.733),
('Nová Role', 50.270, 12.780), ('Ostrov', 50.305, 12.939), ('Toužim', 50.060, 12.984),
('Žlutice', 50.091, 13.161), ('Sokolov', 50.181, 12.639), ('Březová', 50.145, 12.646),
('Habartov', 50.185, 12.533), ('Horní Slavkov', 50.138, 12.805), ('Chodov', 50.241, 12.748),
('Kraslice', 50.327, 12.502), ('Kynšperk nad Ohří', 50.119, 12.532), ('Loket', 50.187, 12.753),
('Nové Sedlo', 50.207, 12.735), ('Oloví', 50.258, 12.556), ('Přebuz', 50.370, 12.617),
('Rotava', 50.300, 12.574), ('Aš', 50.224, 12.186), ('Hranice', 50.305, 12.176),
('Lázně Kynžvart', 50.010, 12.625), ('Luby', 50.252, 12.404), ('Mariánské Lázně', 49.973, 12.702),
('Plesná', 50.222, 12.350), ('Skalná', 50.170, 12.360), ('Teplá', 49.977, 12.863)
]

with open('c:/Users/sanco/OneDrive/Plocha/Hacaton/db/init.sql', 'a', encoding='utf-8') as f:
    for c in cities:
        f.write(f"INSERT INTO locations (name, lat, lng) VALUES ('{c[0]}', {c[1]}, {c[2]});\n")

print("Cities appended!")
